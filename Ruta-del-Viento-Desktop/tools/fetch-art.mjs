import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const destination = new URL('../Assets/Resources/Coast/Art/', import.meta.url);
await mkdir(destination, { recursive: true });
const headers = { 'User-Agent': 'RutaDelVientoDesktop prototype (asset preparation)' };
async function save(name, address) {
  const target = new URL(name, destination);
  const existing = await readFile(target).catch(() => null);
  if (existing?.length > 1000) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const reply = await fetch(address, { headers, signal: AbortSignal.timeout(45_000) });
      if (!reply.ok) throw new Error(`HTTP ${reply.status} from ${address}`);
      const result = Buffer.from(await reply.arrayBuffer());
      if (result.length < 1000) throw new Error(`Invalid response from ${address}`);
      await writeFile(target, result);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

async function material(name, id, resolution = '1k') {
  const reply = await fetch(`https://api.polyhaven.com/files/${id}`, { headers });
  if (!reply.ok) throw new Error(`${id}: ${reply.status}`);
  const maps = await reply.json();
  await Promise.all([
    save(`${name}.jpg`, maps.Diffuse[resolution].jpg.url),
    save(`${name}Normal.jpg`, maps.nor_gl[resolution].jpg.url),
  ]);
}

await Promise.all([
  material('Sand', 'coast_sand_01', '2k'),
  material('BeachGrain', 'sand_01', '2k'),
  material('RoadAggregate', 'asphalt_04', '2k'),
  material('Cliff', 'coast_land_rocks_01', '2k'),
  material('Soil', 'brown_mud_dry'),
  material('Scrub', 'aerial_grass_rock'),
  material('Bark', 'palm_bark'),
  material('Plaster', 'plastered_wall_02'),
  material('Tiles', 'roof_tiles_14'),
  save('Sky.hdr', 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr'),
  (async () => {
    const files = await (await fetch('https://api.polyhaven.com/files/island_tree_02', { headers })).json();
    await Promise.all([save('CanopyColor.png', files.leaves_diff['1k'].png.url),
      save('CanopyMask.png', files.leaves_alpha['1k'].png.url)]);
  })(),
  save('CarConcept.glb', 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb'),
  (async () => {
    const maps = await (await fetch('https://api.polyhaven.com/files/boulder_01', { headers })).json();
    const file = maps.fbx['1k'].fbx;
    await Promise.all([save('BoulderScan.fbx', file.url), save('Boulder.jpg', maps.Diffuse['1k'].jpg.url),
      save('BoulderNormal.jpg', maps.nor_gl['1k'].jpg.url)]);
  })(),
  (async () => {
    const archive = join(tmpdir(), 'RutaDelViento-Asphalt025A.zip');
    const reply = await fetch('https://ambientcg.com/get?file=Asphalt025A_1K-JPG.zip', { headers });
    if (!reply.ok) throw new Error(`Asphalt025A: HTTP ${reply.status}`);
    await writeFile(archive, Buffer.from(await reply.arrayBuffer()));
    for (const [source, name] of [['Color', 'Asphalt'], ['NormalGL', 'AsphaltNormal']]) {
      const map = execFileSync('tar', ['-xOf', archive, `Asphalt025A_1K-JPG_${source}.jpg`], { maxBuffer: 16 * 1024 * 1024 });
      await writeFile(new URL(`${name}.jpg`, destination), map);
    }
  })(),
]);
console.log('Coastal textures, HDRI sky, rock scan and concept car are ready.');
