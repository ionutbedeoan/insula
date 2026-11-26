function tenerifeWalk(rt, input, dt) {
  const person = rt.walker;
  const ahead = Number(input.throttle) - Number(input.reverse);
  const side = Number(input.right) - Number(input.left);
  const length = Math.max(1, Math.hypot(side, ahead));
  const stride = (rt.keys.has('ShiftLeft') ? 5.9 : 3.65) * dt / length;
  const sin = Math.sin(person.heading);
  const cos = Math.cos(person.heading);
  const canStand = (x, z) => {
    const ground = tenerifeTerrainHeight(x, z);
    if (ground < .12 || tenerifeWetBlocked(x, z, ground) || Math.abs(ground - tenerifeTerrainHeight(person.x, person.z)) > .17) return false;
    if (Math.hypot(x - rt.car.x, z - rt.car.z) < 3 && xxPersonCar(x, z, rt.car)) return false;
    return !tenerifePersonHits(x, z);
  };
  const dx = (sin * ahead + cos * side) * stride;
  const dz = (-cos * ahead + sin * side) * stride;
  if (dx && canStand(person.x + dx, person.z)) person.x += dx;
  if (dz && canStand(person.x, person.z + dz)) person.z += dz;
}

function xxPersonCar(x, z, car) {
  const dx = x - car.x;
  const dz = z - car.z;
  const sin = Math.sin(car.heading);
  const cos = Math.cos(car.heading);
  return Math.abs(dx * cos + dz * sin) < 1.35 && Math.abs(dx * sin - dz * cos) < 2.6;
}

function tenerifePersonHits(x, z) {
  return [...VF(x, z), ...JF(x, z)].some(obstacle => {
    const dx = x - obstacle.x;
    const dz = z - obstacle.z;
    if (!obstacle.halfX || !obstacle.halfZ) return Math.hypot(dx, dz) < obstacle.radius + .28;
    const sin = Math.sin(obstacle.angle ?? 0);
    const cos = Math.cos(obstacle.angle ?? 0);
    return Math.abs(dx * cos - dz * sin) < obstacle.halfX + .3
      && Math.abs(dx * sin + dz * cos) < obstacle.halfZ + .3;
  });
}

const tenerifePoseFields = ['x', 'y', 'z', 'heading', 'pitch', 'roll'];

function wO({ runtime, onTelemetry, audio, muted, onReady }) {
  const time = ee.useRef({ physics: 0, sample: 0, audio: 0, ready: false, previous: {}, visual: {} });
  const input = ee.useRef({ ...KM });
  rs(({ camera }, delta) => {
    const dt = Math.min(.10, delta);
    const frame = time.current;
    const rt = runtime.current;
    const car = rt.car;
    const previous = frame.previous;
    if (frame.car !== car || rt.resetCamera) {
      frame.car = car;
      frame.physics = 0;
      for (const field of tenerifePoseFields) previous[field] = car[field];
      previous.recoveries = car.recoveries;
    }
    pO(rt.keys, input.current);
    if (rt.active && !rt.paused) {
      frame.physics += dt;
      while (frame.physics >= X4) {
        if (rt.walker) tenerifeWalk(rt, input.current, X4);
        else {
          for (const field of tenerifePoseFields) previous[field] = car[field];
          previous.recoveries = car.recoveries;
          DO(car, input.current, X4);
        }
        frame.physics -= X4;
      }
    } else frame.physics = 0;
    const visual = frame.visual;
    const blend = rt.active && !rt.paused && !rt.walker && previous.recoveries === car.recoveries
      ? Math.min(1, frame.physics / X4) : 1;
    for (const field of tenerifePoseFields) visual[field] = Ua(previous[field], car[field], blend);
    visual.wheel = car.wheel;
    visual.steer = car.steer;
    visual.braking = car.braking;
    if (blend < 1 && (visual.x !== car.x || visual.z !== car.z)) {
      visual.groundY = visual.y;
      visual.groundPitch = visual.pitch;
      visual.groundRoll = visual.roll;
      tenerifeGroundCar(visual, 0, tenerifeTerrainHeight);
    }
    rt.visualCar = visual;
    const walker = rt.walker;
    const orbit = rt.orbit ?? 0;
    const tilt = rt.tilt ?? 0;
    const heading = visual.heading;
    const east = Math.sin(heading);
    const north = -Math.cos(heading);
    const cockpit = rt.active && rt.camera === 1 && !walker;
    if (!rt.active) {
      Yc.set(visual.x - east * 6.25 - north * 7.05, visual.y + 3.05, visual.z - north * 6.25 + east * 7.05);
      KD.set(visual.x + east * 5.5 + north * 3, visual.y + 1.37, visual.z + north * 5.5 - east * 3);
    } else if (walker) {
      const y = tenerifeTerrainHeight(walker.x, walker.z) + 1.68;
      Yc.set(walker.x, y, walker.z);
      KD.set(walker.x + Math.sin(walker.heading) * 8, y + Math.tan(walker.pitch) * 8, walker.z - Math.cos(walker.heading) * 8);
    } else if (cockpit) {
      const look = heading + Vc(orbit, -1.14, 1.14);
      Yc.set(visual.x - .34 * Math.cos(heading) + east * .36, visual.y + 1.24, visual.z - .34 * Math.sin(heading) + north * .36);
      KD.set(Yc.x + Math.sin(look) * 14, Yc.y + (Math.tan(visual.pitch) + tilt * .62) * 14, Yc.z - Math.cos(look) * 14);
    } else {
      const panoramic = rt.camera === 2;
      const azimuth = heading + orbit;
      const distance = (panoramic ? 12.5 : 7.5) + Math.min(2, Math.abs(car.speed) * .035);
      Yc.set(visual.x - Math.sin(azimuth) * distance, visual.y + (panoramic ? 6.9 : 3.05) + tilt * 4.2, visual.z + Math.cos(azimuth) * distance);
      KD.set(visual.x, visual.y + .88, visual.z);
    }
    Yc.y = Math.max(Yc.y, tenerifeTerrainHeight(Yc.x, Yc.z) + .75);
    if (rt.resetCamera || !frame.ready || previous.recoveries !== car.recoveries) camera.position.copy(Yc);
    else camera.position.lerp(Yc, 1 - Math.exp(-dt * (walker || cockpit ? 28 : 12)));
    camera.position.y = Math.max(camera.position.y, tenerifeTerrainHeight(camera.position.x, camera.position.z) + .75);
    rt.resetCamera = false;
    camera.lookAt(KD);
    if (!frame.ready && tenerifeTerrainNearReady && tenerifeSceneryNearReady && tenerifeShadersReady) {
      frame.ready = true;
      onReady();
    }
    frame.sample += dt;
    frame.audio += dt;
    if (frame.sample > .1) {
      frame.sample = 0;
      onTelemetry(walker ? { ...car, walker: { ...walker } } : car);
      rt.refreshHud?.();
    }
    if (frame.audio > .06) {
      frame.audio = 0;
      audio.update(car, input.current.throttle && !walker, !muted && rt.active && !rt.paused && !walker);
      audio.environment(walker?.z ?? car.z, walker ? 0 : Math.abs(car.speed), !muted && rt.active && !rt.paused);
    }
  }, -2);
  return null;
}

function TenerifeCockpit({ runtime }) {
  const interior = ee.useRef(null);
  rs(() => {
    const rt = runtime.current;
    const group = interior.current;
    if (!group) return;
    group.visible = rt.active && rt.camera === 1 && !rt.walker;
    const car = rt.visualCar ?? rt.car;
    group.position.set(car.x, car.y, car.z);
    group.rotation.set(car.pitch * .65, -car.heading, 0, 'YXZ');
  });
  const panel = (position, dimensions, color, roughness = .68) => E.jsxs('mesh', { position, children: [
    E.jsx('boxGeometry', { args: dimensions }),
    E.jsx('meshStandardMaterial', { color, roughness })
  ] });
  return E.jsxs('group', { ref: interior, visible: false, children: [
    E.jsx('mesh', { geometry: UF, material: q4 }),
    panel([0, .855, -.88], [1.65, .19, .27], '#171d22'),
    panel([0, .782, -.738], [1.61, .037, .033], '#81664b', .39),
    ...[-.46,-.33,-.2].map((x,index) => E.jsxs('mesh', { position: [x,.976,-.82], key: x, children: [
      E.jsx('torusGeometry', { args: [index === 1 ? .047 : .035, .0035, 8, 24] }),
      E.jsx('meshStandardMaterial', { color: '#dcd9ba', emissive: '#746e47', emissiveIntensity: .21, roughness: .6 })
    ] })),
    E.jsxs('mesh', { position: [-.34, 1.005, -.75], rotation: [-.27, 0, 0], children: [
      E.jsx('torusGeometry', { args: [.135, .022, 10, 32] }),
      E.jsx('meshStandardMaterial', { color: '#1a1f24', roughness: .79 })
    ] }),
    panel([-.34, 1.005, -.75], [.23, .025, .045], '#353840', .48)
  ] });
}

function TenerifeFinds({ runtime }) {
  const markers = ee.useRef([]);
  rs(({ clock }) => markers.current.forEach((mark, index) => {
    if (!mark) return;
    const rt = runtime.current;
    const clue = tenerifeFinds[index];
    mark.visible = !!rt.walker && !rt.finds?.has(clue.id)
      && Math.hypot(rt.walker.x - clue.x, rt.walker.z - clue.z) < 34;
    mark.rotation.y = clock.elapsedTime * .62;
  }));
  return tenerifeFinds.map((clue, index) => E.jsxs('mesh', {
    ref: node => { markers.current[index] = node; },
    visible: false,
    position: [clue.x, tenerifeTerrainHeight(clue.x, clue.z) + .57, clue.z],
    children: [
      E.jsx('octahedronGeometry', { args: [.25, 0] }),
      E.jsx('meshStandardMaterial', { color: '#edc57e', emissive: '#c88b39', emissiveIntensity: .7, metalness: .3, roughness: .39 })
    ]
  }, clue.id));
}
