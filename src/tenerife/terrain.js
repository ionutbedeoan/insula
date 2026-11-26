// Near tiles and contact queries use the same 4 m grid and triangle diagonal.
const tenerifeTerrainStep = 4;
const tenerifeTerrainRow = 40;
const tenerifeTerrainTileSize = tenerifeTerrainStep * tenerifeTerrainRow;
const tenerifeTerrainSamples = new Map();
let tenerifeRoadTriangles;
let tenerifeTerrainNearReady = false;
let tenerifeSceneryNearReady = false;
let tenerifeShadersReady = false;

function tenerifeTerrainVertex(x, z, road) {
  const tx = Math.floor(x / tenerifeTerrainTileSize), tz = Math.floor(z / tenerifeTerrainTileSize);
  const key = tx * 1024 + tz;
  let tile = tenerifeTerrainSamples.get(key);
  if (!tile) {
    // Evict whole tiles so rolling terrain generation never prunes a large map one vertex at a time.
    if (tenerifeTerrainSamples.size >= 384) tenerifeTerrainSamples.delete(tenerifeTerrainSamples.keys().next().value);
    tile = new Float32Array(tenerifeTerrainRow * tenerifeTerrainRow).fill(NaN);
    tenerifeTerrainSamples.set(key, tile);
  }
  const column = (x - tx * tenerifeTerrainTileSize) / tenerifeTerrainStep;
  const row = (z - tz * tenerifeTerrainTileSize) / tenerifeTerrainStep;
  const index = row * tenerifeTerrainRow + column;
  if (Number.isNaN(tile[index])) tile[index] = Ts(x, z, road);
  return tile[index];
}

function tenerifeRoadRibbons(draw, surface) {
  for (const road of DA) {
    if (surface === 'shoulder') {
      draw(road.points, -road.half - 1.15, road.half + 1.15, -.095);
    } else if (road.surface === surface) {
      const lanes = surface === 'asphalt' ? [-road.half, -2.8, 0, 2.8, road.half] : [-road.half, road.half];
      for (let i = 1; i < lanes.length; i++) {
        draw(road.points, lanes[i - 1], lanes[i], road.main ? 0 : .065, surface === 'gravel' ? 1.6 : 1);
      }
    }
  }
}

function tenerifeIndexRoadSurfaces() {
  const bins = new Map();
  for (const surface of ['shoulder', 'asphalt', 'gravel']) {
    const mesh = vg(draw => tenerifeRoadRibbons(draw, surface));
    const points = mesh.attributes.position.array;
    const triangles = mesh.index.array;
    for (let i = 0; i < triangles.length; i += 3) {
      const a = triangles[i] * 3, b = triangles[i + 1] * 3, c = triangles[i + 2] * 3;
      const [x, y, z] = points.subarray(c, c + 3);
      const ax = points[a] - x, az = points[a + 2] - z;
      const bx = points[b] - x, bz = points[b + 2] - z;
      const area = ax * bz - az * bx;
      if (Math.abs(area) < .00001) continue;
      const triangle = { x, y, z, ax, az, bx, bz, area, ay: points[a + 1] - y, by: points[b + 1] - y };
      const minX = Math.floor((x + Math.min(0, ax, bx)) / 8), maxX = Math.floor((x + Math.max(0, ax, bx)) / 8);
      const minZ = Math.floor((z + Math.min(0, az, bz)) / 8), maxZ = Math.floor((z + Math.max(0, az, bz)) / 8);
      for (let iz = minZ; iz <= maxZ; iz++) for (let ix = minX; ix <= maxX; ix++) {
        const key = ix * 1024 + iz;
        if (!bins.has(key)) bins.set(key, []);
        bins.get(key).push(triangle);
      }
    }
    mesh.dispose();
  }
  return bins;
}

function tenerifeTerrainHeight(x, z) {
  const step = tenerifeTerrainStep;
  const gx = Math.floor(x / step) * step, gz = Math.floor(z / step) * step;
  const u = (x - gx) / step, v = (z - gz) / step;
  const east = tenerifeTerrainVertex(gx + step, gz), south = tenerifeTerrainVertex(gx, gz + step);
  let height = u + v <= 1
    ? (1 - u - v) * tenerifeTerrainVertex(gx, gz) + u * east + v * south
    : (u + v - 1) * tenerifeTerrainVertex(gx + step, gz + step) + (1 - v) * east + (1 - u) * south;
  const road = (tenerifeRoadTriangles ??= tenerifeIndexRoadSurfaces()).get(Math.floor(x / 8) * 1024 + Math.floor(z / 8));
  if (!road) return height;
  for (const t of road) {
    const dx = x - t.x, dz = z - t.z;
    const u = (dx * t.bz - dz * t.bx) / t.area, v = (t.ax * dz - t.az * dx) / t.area;
    if (u >= -.0001 && v >= -.0001 && u + v <= 1.0001) height = Math.max(height, t.y + u * t.ay + v * t.by);
  }
  return height;
}

function TenerifeTerrain({ tiles, tx, tz }) {
  const group = ee.useRef(null);
  const meshes = ee.useRef(new Map());
  const work = ee.useRef({ pending: [], obsolete: [] });
  ee.useLayoutEffect(() => {
    const desired = new Set();
    const priority = (tile) => Math.max(Math.abs(tile.x - tx), Math.abs(tile.z - tz));
    const pending = tiles.flatMap(tile => {
      const key = tile.x + ',' + tile.z;
      desired.add(key);
      return meshes.current.get(key)?.detail === tile.detail ? [] : [{ ...tile, key }];
    });
    pending.sort((a, b) => priority(a) - priority(b) || (a.x - tx) ** 2 + (a.z - tz) ** 2 - (b.x - tx) ** 2 - (b.z - tz) ** 2);
    work.current = { pending, obsolete: [...meshes.current.keys()].filter(key => !desired.has(key)) };
  }, [tiles, tx, tz]);
  ee.useEffect(() => () => {
    for (const item of meshes.current.values()) item.mesh.geometry.dispose();
    meshes.current.clear();
    tenerifeTerrainNearReady = false;
  }, []);
  rs(() => {
    const { pending, obsolete } = work.current;
    const start = performance.now();
    for (let count = 0; pending.length && count < 6; count++) {
      if (count && performance.now() - start >= 2.2) break;
      const tile = pending.shift();
      const geometry = XF(tile.x, tile.z, tile.detail);
      let item = meshes.current.get(tile.key);
      if (item) {
        item.mesh.geometry.dispose();
        item.mesh.geometry = geometry;
        item.mesh.receiveShadow = tile.detail >= 20;
        item.detail = tile.detail;
      } else {
        const mesh = new di(geometry, OM);
        mesh.receiveShadow = tile.detail >= 20;
        group.current.add(mesh);
        meshes.current.set(tile.key, { mesh, detail: tile.detail });
      }
    }
    for (let count = 0; obsolete.length && count < 8; count++) {
      const key = obsolete.pop();
      const { mesh } = meshes.current.get(key);
      mesh.removeFromParent();
      mesh.geometry.dispose();
      meshes.current.delete(key);
    }
    if (meshes.current.get(tx + ',' + tz)?.detail === 40 && meshes.current.size >= 5) tenerifeTerrainNearReady = true;
  }, -4);
  return E.jsx('group', { ref: group });
}

function TenerifeScenery({ tx, tz, mobile }) {
  const group = ee.useRef(null);
  const cache = ee.useRef(new Map());
  const meshes = ee.useRef(new Map());
  const work = ee.useRef({ desired: [], pending: [], uploads: null });
  const transform = ee.useMemo(() => new dn(), []);
  const color = ee.useMemo(() => new Ue(), []);
  ee.useLayoutEffect(() => {
    const desired = [], pending = [];
    const range = mobile ? 2 : 3;
    for (let distance = 0; distance <= range; distance++) {
      for (let z = -distance; z <= distance; z++) for (let x = -distance; x <= distance; x++) {
        if (Math.max(Math.abs(x), Math.abs(z)) !== distance) continue;
        const detail = distance <= (mobile ? 1 : 2);
        const key = (tx + x) + ',' + (tz + z) + ',' + detail;
        desired.push(key);
        if (!cache.current.has(key)) pending.push({ x: tx + x, z: tz + z, key, detail });
      }
    }
    work.current = { desired, pending, uploads: null };
  }, [tx, tz, mobile]);
  ee.useEffect(() => () => {
    for (const mesh of meshes.current.values()) mesh.dispose();
    meshes.current.clear();
    cache.current.clear();
    tenerifeSceneryNearReady = false;
  }, []);
  rs(() => {
    const workItem = work.current;
    const start = performance.now();
    for (let count = 0; workItem.pending.length && count < 3; count++) {
      if (count && performance.now() - start >= 1.5) break;
      const tile = workItem.pending.shift();
      const kinds = new Map();
      const include = item => {
        if (!tile.detail && (item.kind === 'grass' || item.kind === 'fern' || item.kind === 'shadow')) return;
        if (!kinds.has(item.kind)) kinds.set(item.kind, []);
        kinds.get(item.kind).push(item);
      };
      GM(tile.x, tile.z).forEach(include);
      PO(tile.x, tile.z, tile.detail).forEach(include);
      for (const rock of vO) {
        if (Math.floor(rock.x / pA) === tile.x && Math.floor(rock.z / pA) === tile.z) include(rock);
      }
      const packed = new Map();
      for (const [kind, items] of kinds) {
        const matrices = new Float32Array(items.length * 16);
        const colors = new Float32Array(items.length * 3);
        items.forEach((item, index) => {
          transform.position.set(item.x, item.y, item.z);
          transform.rotation.set(0, item.angle, 0);
          transform.scale.set(item.w, item.h, item.d);
          transform.updateMatrix();
          matrices.set(transform.matrix.elements, index * 16);
          color.set(item.color).toArray(colors, index * 3);
        });
        packed.set(kind, { matrices, colors });
      }
      cache.current.set(tile.key, packed);
    }
    if (workItem.pending.length) return;
    if (!workItem.uploads) {
      const byKind = new Map();
      for (const key of workItem.desired) for (const [kind, batch] of cache.current.get(key)) {
        if (!byKind.has(kind)) byKind.set(kind, []);
        byKind.get(kind).push(batch);
      }
      for (const [kind, mesh] of meshes.current) mesh.visible = byKind.has(kind);
      workItem.uploads = [...byKind];
      if (cache.current.size > 96) {
        const keep = new Set(workItem.desired);
        for (const key of cache.current.keys()) {
          if (!keep.has(key)) cache.current.delete(key);
          if (cache.current.size <= 96) break;
        }
      }
    }
    for (let i = 0; workItem.uploads.length && i < 5; i++) {
      if (i && performance.now() - start >= 2.5) break;
      const [kind, batches] = workItem.uploads.shift();
      const count = batches.reduce((total, batch) => total + batch.matrices.length / 16, 0);
      let mesh = meshes.current.get(kind);
      if (!mesh || mesh.instanceMatrix.count < count) {
        if (mesh) {
          mesh.removeFromParent();
          mesh.dispose();
        }
        const capacity = Math.max(16, count * 2);
        mesh = new e9(cO[kind], uO[kind], capacity);
        mesh.instanceColor = new gf(new Float32Array(capacity * 3), 3);
        const solid = kind === 'box' || kind === 'roof' || kind === 'rock' || kind === 'lava' || kind === 'trunk';
        mesh.receiveShadow = solid || kind.startsWith('house') || kind.startsWith('forestTrunk');
        mesh.castShadow = solid || kind.startsWith('forest') && !kind.endsWith('Far') && kind !== 'forestBase';
        mesh.renderOrder = kind === 'shadow' ? 1 : 0;
        group.current.add(mesh);
        meshes.current.set(kind, mesh);
      }
      let offset = 0;
      for (const batch of batches) {
        mesh.instanceMatrix.array.set(batch.matrices, offset * 16);
        mesh.instanceColor.array.set(batch.colors, offset * 3);
        offset += batch.matrices.length / 16;
      }
      mesh.count = count;
      mesh.visible = true;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
    if (!workItem.uploads.length) tenerifeSceneryNearReady = true;
  }, -4);
  return E.jsx('group', { ref: group });
}

function TenerifeShaderWarmup() {
  const started = ee.useRef(false);
  const mounted = ee.useRef(true);
  ee.useEffect(() => () => {
    mounted.current = false;
    tenerifeShadersReady = false;
  }, []);
  rs(({ gl, camera, scene }) => {
    if (started.current) return;
    started.current = true;
    const palette = new dn();
    for (const [kind, geometry] of Object.entries(cO)) {
      if (!uO[kind]) continue;
      const preview = new e9(geometry, uO[kind], 1);
      preview.setColorAt(0, new Ue());
      palette.add(preview);
    }
    const prepare = async () => {
      try {
        await gl.compileAsync(palette, camera, scene);
        if (mounted.current) {
          // Initialize the linked programs' uniforms before they are first drawn on the route.
          for (const program of gl.info.programs) program.getUniforms?.();
        }
      } catch (error) {
        console.warn('Tenerife shader preparation:', error.message);
      } finally {
        for (const preview of palette.children) preview.dispose();
        if (mounted.current) tenerifeShadersReady = true;
      }
    };
    void prepare();
  });
  return null;
}

function TenerifeFrameBudget({ quality, mobile }) {
  const { setDpr, viewport } = Wc();
  const stats = ee.useRef({ time: 0, frames: 0, stable: 0, slow: 0 });
  rs((_, delta) => {
    const sample = stats.current;
    // Background tab time has no bearing on rendering capacity.
    if (document.hidden) {
      sample.time = sample.frames = sample.stable = sample.slow = 0;
      return;
    }
    sample.time += Math.min(delta, .5);
    sample.frames++;
    if (sample.time < .75 || sample.frames < 5) return;
    const fps = sample.frames / sample.time;
    const limit = quality ? Math.max(1, Math.min(devicePixelRatio, mobile ? 1.31 : 1.6)) : .92;
    sample.slow = fps < 38 ? sample.slow + 1 : 0;
    if (sample.slow >= 2 && viewport.dpr > .68) {
      setDpr(Math.max(.68, viewport.dpr * .86));
      sample.stable = sample.slow = 0;
    } else if (fps > 56) {
      if (++sample.stable >= 4 && viewport.dpr < limit - .03) {
        setDpr(Math.min(limit, viewport.dpr + .06));
        sample.stable = 0;
      }
    } else sample.stable = 0;
    sample.time = sample.frames = 0;
  }, -3);
  return null;
}
