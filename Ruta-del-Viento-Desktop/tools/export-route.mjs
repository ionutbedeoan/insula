import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { CatmullRomCurve3, Vector3, MathUtils } from 'three';

// The web edition ships this route in its standalone bundle. Sample its own
// spline and terrain functions to keep the desktop route tied to the original.
const original = readFileSync(new URL('../../Ruta-del-Viento/dist/The-Forgotten-Island.html', import.meta.url), 'utf8');
const begin = original.indexOf('function Vg(s){return-930');
const end = original.indexOf('function IM(', begin);
if (begin < 0 || end < 0) throw new Error('The standalone route definitions changed.');
const Vc = MathUtils.clamp;
const Ua = MathUtils.lerp;
const ar = (start, end, value) => {
  const t = Vc((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
};
const streetSource = readFileSync(new URL('../../src/tenerife/world.js', import.meta.url), 'utf8');
const streetEnd = streetSource.indexOf('function tenerifePlantRoads');
const route = runInNewContext(`
  ${original.slice(begin, end)}
  ${streetSource.slice(0, streetEnd)}
  const extra = tenerifeRoads(Fg, X0);
  for (const road of extra) for (let i = 1; i < road.points.length; i++) {
    const a = road.points[i - 1], b = road.points[i];
    for (let x = Math.floor((Math.min(a.x,b.x)-43)/Bg); x <= Math.floor((Math.max(a.x,b.x)+43)/Bg); x++) {
      for (let z = Math.floor((Math.min(a.z,b.z)-43)/Bg); z <= Math.floor((Math.max(a.z,b.z)+43)/Bg); z++) {
        const key = x + ',' + z;
        if (!BT.has(key)) BT.set(key, []);
        BT.get(key).push({road,a,b});
      }
    }
  }
  const homes = [];
  tenerifeSettlements((x,z,width,depth,height,angle,style) => {
    homes.push({x,z,width,depth,height,angle,style});
  }, Ws);
  ({xi, mF, DF, extra, homes, pl, Ts, e0, Vg});
`, { r9: CatmullRomCurve3, q: Vector3, Vc, Ua, ar }, { timeout: 10_000 });

const start = 13;
const finish = 1140;
const roadEnd = 1260;
const origin = { x: -714, z: 1550 };
const bounds = { minX: -600, minZ: -240, width: 1700, depth: 1680, minY: -58, height: 335, resolution: 1025 };
const place = (x, y, z) => ({ x: +(x - origin.x).toFixed(4), y: +y.toFixed(4), z: +(origin.z - z).toFixed(4) });
const sample = (road, distance) => {
  const p = route.pl(road, distance);
  return { ...place(p.x, p.y, p.z), s: +p.s.toFixed(4) };
};
const pack = (road, name, limit = road.length) => {
  const steps = Math.ceil(limit / 1.8);
  return { name, half: road.half, points: Array.from({ length: steps + 1 }, (_, i) => sample(road, limit * i / steps)) };
};
const roads = [pack(route.xi, 'Ruta del Viento', roadEnd), pack(route.mF, 'Playa del Viento'),
  pack(route.extra[3], 'Caleta Sur'), pack(route.extra[4], 'Caleta Sur · strada de sus')];
const houses = route.homes.filter(p => p.z > 1100 && p.z < 1320).map(p => ({
  ...place(p.x, route.Ts(p.x, p.z), p.z), width: p.width, depth: p.depth, height: p.height, angle: p.angle, style: p.style,
}));

const grades = [route.xi, route.mF, route.DF, ...route.extra.slice(0, 5)];
const cellSize = 32;
const bins = new Map();
for (const road of grades) for (let i = 1; i < road.points.length; i++) {
  const a = road.points[i - 1];
  const b = road.points[i];
  const segment = { a, b, road, dx: b.x - a.x, dz: b.z - a.z };
  segment.inverseLengthSquared = 1 / (segment.dx ** 2 + segment.dz ** 2);
  for (let x = Math.floor((Math.min(a.x, b.x) - 44) / cellSize); x <= Math.floor((Math.max(a.x, b.x) + 44) / cellSize); x++) {
    for (let z = Math.floor((Math.min(a.z, b.z) - 44) / cellSize); z <= Math.floor((Math.max(a.z, b.z) + 44) / cellSize); z++) {
      const key = x * 1000 + z;
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(segment);
    }
  }
}

function heightAt(x, z) {
  const natural = route.e0(x, z);
  let minimum = Infinity;
  let grade = natural;
  let width = 0;
  for (const { a, b, road, dx, dz, inverseLengthSquared } of bins.get(Math.floor(x / cellSize) * 1000 + Math.floor(z / cellSize)) ?? []) {
    const ratio = Vc(((x - a.x) * dx + (z - a.z) * dz) * inverseLengthSquared, 0, 1);
    const distanceSquared = (x - a.x - ratio * dx) ** 2 + (z - a.z - ratio * dz) ** 2;
    if (distanceSquared >= minimum) continue;
    minimum = distanceSquared;
    grade = Ua(a.y, b.y, ratio) - .24;
    width = road.half;
  }
  const gradient = Ua(grade, natural, ar(width + 2, width + 38, Math.sqrt(minimum)));
  // Extend the heightmap below sea level beyond the original scene boundary.
  return Math.max(bounds.minY, gradient - ar(bounds.minX + 45, bounds.minX, x - origin.x) * 30);
}

const { resolution } = bounds;
const terrain = Buffer.alloc(resolution ** 2 * 2);
for (let row = 0; row < resolution; row++) {
  const z = origin.z - (bounds.minZ + row * bounds.depth / (resolution - 1));
  for (let column = 0; column < resolution; column++) {
    const x = origin.x + bounds.minX + column * bounds.width / (resolution - 1);
    const normalized = Vc((heightAt(x, z) - bounds.minY) / bounds.height, 0, 1);
    terrain.writeUInt16LE(Math.round(normalized * 65535), 2 * (row * resolution + column));
  }
}

const output = new URL('../Assets/Resources/Coast/', import.meta.url);
mkdirSync(output, { recursive: true });
writeFileSync(new URL('Route.json', output), JSON.stringify({ start, finish, bounds, roads, houses }));
writeFileSync(new URL('Heights.bytes', output), terrain);
if (roads.length !== 4 || houses.length < 5 || finish - start !== 1127) throw new Error('Unexpected route coverage.');
for (const road of roads) for (const point of road.points) {
  const clearance = point.y - heightAt(point.x + origin.x, origin.z - point.z);
  if (!Number.isFinite(clearance) || clearance < -.7) throw new Error(`Terrain blocks ${road.name} at ${point.s} m.`);
}
console.log(`${finish - start} m from Playa del Viento, ${roads.length - 1} branches, ${houses.length} house positions, ${resolution}² height samples`);
