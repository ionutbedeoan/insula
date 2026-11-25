// Junctions use the existing route elevation at each connection.
function tenerifeRoads(mainPoint, makeRoad) {
  const street = (points, width = 3.45, surface = 'asphalt') => makeRoad(points, width, surface);
  return [
    street([mainPoint(-393, 486), [-420, 85, 485], [-432, 85, 492], [-462, 90, 506], [-514, 91, 487], [-554, 91, 433], [-585, 92, 366], [-574, 93, 291], [-528, 92, 246], [-465, 92, 220], mainPoint(-388, 226)], 4),
    street([[-554, 91, 433], [-573, 91, 419], [-576, 92, 388], [-551, 92, 380], [-521, 90.5, 370], [-490, 91, 361], [-453, 91, 366], [-431, 91, 373], mainPoint(-396, 368)], 3.2),
    street([[-574, 93, 291], [-550, 93, 281], [-528, 92, 292], [-507, 92, 306], [-476, 92, 298], [-456, 92, 284]]),
    street([mainPoint(-650, 1190), [-599, 21, 1206], [-567, 22, 1248], [-519, 23, 1256], [-477, 24, 1221], [-482, 27, 1180], [-516, 28, 1160], [-566, 27, 1142], mainPoint(-618, 1142)], 4),
    street([[-567, 22, 1248], [-541, 24, 1217], [-504, 25, 1204], [-482, 27, 1180]], 3.2),
    street([mainPoint(-338, -422), [-309, 236, -447], [-286, 234, -490], [-223, 229, -514], [-176, 225, -494], [-150, 226, -461], [-173, 229, -434], mainPoint(-171, -411)], 4),
    street([[-286, 234, -490], [-270, 226, -525], [-257, 218.2, -560], [-228, 226, -599], [-200, 234, -625], [-136, 251, -636], [-91, 269, -662]], 3.1, 'gravel'),
    street([[-173, 229, -434], [-190, 230, -454], [-212, 229, -477], [-247, 230, -483], [-286, 234, -490]], 3.15)
  ];
}

function tenerifeSettlements(addHouse, nearestRoad) {
  const districts = [
    [-561, 323, 4, 8, 16, 18],
    [-559, 1164, 5, 5, 17, 19],
    [-267, -483, 6, 6, 15, 17]
  ];
  const placed = [];
  for (const [left, top, columns, rows, dx, dz] of districts) {
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const x = left + column * dx + (row % 2) * 2;
        const z = top + row * dz;
        const road = nearestRoad(x, z);
        if (!road || road.distance < road.road.half + 10 || road.distance > 30) continue;
        if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 13)) continue;
        placed.push([x, z]);
        addHouse(x, z, 7.4 + column % 3, 7.8 + row % 3, 4.8 + (row + column) % 4, .07 * (column % 3 - 1), 70 + placed.length, false);
      }
    }
  }
}

function tenerifePlantRoads(roads, heightAt, nearestRoad, addProp, obstacles) {
  for (const [index, road] of roads.entries()) {
    for (let step = 5; step < road.points.length - 4; step += 6) {
      const point = road.points[step];
      const side = step % 4 < 2 ? 1 : -1;
      const offset = side * (road.half + 5 + step % 3);
      const x = point.x - point.dz * offset;
      const z = point.z + point.dx * offset;
      const nearest = nearestRoad(x, z);
      if (nearest?.distance < nearest?.road.half + 3 || obstacles.some(o => Math.hypot(o.x - x, o.z - z) < 4 + o.radius)) continue;
      const y = heightAt(x, z);
      const pine = index >= 5;
      const size = (pine ? 8 : 5.6) + step % 5 * .48;
      addProp('trunk', x, y + size * .32, z, .41, size * .7, .43, '#5f5043', step);
      addProp(pine ? 'pine' : 'canopy', x, y + size * .68, z, size * .59, size * .74, size * .54, pine ? '#94a481' : '#a3ad80', step);
      obstacles.push({ x, z, radius: .28 });
    }
  }
}

const tenerifeFinds = [
  { id: 'shell', title: 'Scoica de la Playa del Viento', text: 'O scoică albă, lustruită de valurile Atlanticului.', x: -713.04, z: 1533.7 },
  { id: 'compass', title: 'Busola pescarului', text: 'Capacul păstrează inițialele unui pescar din golful de sud.', x: -550, z: 1235 },
  { id: 'postcard', title: 'Carte poștală din San Bruma', text: 'O fotografie veche arată satul înainte de drumul de munte.', x: -575, z: 430 },
  { id: 'seed', title: 'Semințe de pin canarian', text: 'Un plic marcat de pepiniera din vale.', x: -196, z: -490 },
  { id: 'obsidian', title: 'Fragment de obsidian', text: 'Muchiile sticloase lucitoare trădează originea vulcanică.', x: -99, z: -658 },
  { id: 'survey', title: 'Carnetul de pe creastă', text: 'Un desen în creion leagă potecile de pe creasta vulcanică.', x: -750, z: -1572 }
];

function TenerifeWorldDetails() {
  const falls = ee.useMemo(() => {
    const x = -80;
    const z = -680;
    const base = Ts(x, z);
    const cliff = Ts(x + 6, z) + 18;
    return { x, z, base, height: Math.max(13, cliff - base) };
  }, []);
  const water = ee.useRef(null);
  const uniforms = ee.useMemo(() => ({ time: { value: 0 } }), []);
  rs(({ clock }) => { if (water.current) uniforms.time.value = clock.elapsedTime; });
  const { x, z, base, height } = falls;
  return E.jsxs('group', { children: [
    E.jsxs('mesh', { position: [x + 1.9, base + height * .42, z], scale: [4.2, height, 10], rotation: [.08, .1, .09], children: [
      E.jsx('dodecahedronGeometry', { args: [.72, 1] }),
      E.jsx('meshStandardMaterial', { color: '#4a4d45', roughness: .93 })
    ] }),
    E.jsxs('mesh', { position: [x - .66, base + height * .56, z], rotation: [0, Math.PI / 2, -.055], children: [
      E.jsx('planeGeometry', { args: [3.1, height * 1.1, 4, 8] }),
      E.jsx('shaderMaterial', {
        ref: water, uniforms, transparent: true, side: qn, depthWrite: false,
        vertexShader: 'varying vec2 streamUV; void main(){streamUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `uniform float time;
          varying vec2 streamUV;
          void main(){
            float lane=sin(streamUV.x*105.+sin(streamUV.y*8.+time)*1.3);
            float ripple=sin(streamUV.y*47.+time*10.+lane*1.8)*sin(streamUV.y*28.+time*7.);
            float foam=smoothstep(.22,.95,lane*.69+ripple*.31)+.55*(1.-smoothstep(0.,.23,streamUV.y));
            float edge=smoothstep(0.,.15,streamUV.x)*smoothstep(0.,.15,1.-streamUV.x);
            vec3 color=mix(vec3(.24,.49,.56),vec3(.87,.97,.97),clamp(foam,0.,1.));
            gl_FragColor=vec4(color, (.55+.4*foam)*edge);
          }`
      })
    ] }),
    E.jsxs('mesh', { position: [x - 2.8, base + .17, z], rotation: [-Math.PI / 2, 0, 0], scale: [8, 4.6, 1], children: [
      E.jsx('circleGeometry', { args: [1, 38] }),
      E.jsx('meshPhysicalMaterial', { color: '#437d7c', roughness: .29, metalness: .21, transparent: true, opacity: .9 })
    ] })
  ] });
}
