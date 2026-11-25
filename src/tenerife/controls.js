const tenerifeJournalKey = 'insula.drive.ruta-viento.collection.v1';

function tenerifeReadFinds() {
  try {
    const values = JSON.parse(localStorage.getItem(tenerifeJournalKey) ?? '[]');
    return new Set(Array.isArray(values) ? values.filter(id => tenerifeFinds.some(item => item.id === id)) : []);
  } catch { return new Set(); }
}

function TenerifeControls({ runtime, dialog, notify }) {
  const [walking, setWalking] = ee.useState(false);
  const [playing, setPlaying] = ee.useState(false);
  const [journal, setJournal] = ee.useState(false);
  const [near, setNear] = ee.useState(null);
  const [ids, setIds] = ee.useState(tenerifeReadFinds);
  const radio = ee.useRef(null);
  const controls = ee.useRef(null);
  const rt = runtime.current;
  const updateNearby = () => {
    const walker = rt.walker;
    setWalking(Boolean(walker));
    setNear(walker ? tenerifeFinds.find(clue => !rt.finds?.has(clue.id) && Math.hypot(clue.x - walker.x, clue.z - walker.z) < 2.25) ?? null : null);
  };
  const toggleVehicle = () => {
    if (rt.paused || !rt.active) return;
    const car = rt.car;
    if (rt.walker) {
      if (Math.hypot(rt.walker.x - car.x, rt.walker.z - car.z) > 3.25) {
        notify('Apropie-te de mașină pentru a urca.');
        return;
      }
      rt.walker = null;
      setWalking(false);
    } else {
      if (Math.abs(car.speed) > .45) {
        notify('Oprește mașina ca să cobori.');
        return;
      }
      const dice = [[-1.72, 0], [1.72, 0], [-1.52, -2.58], [1.52, -2.58]];
      const sin = Math.sin(car.heading);
      const cos = Math.cos(car.heading);
      const exits = dice.map(([side, along]) => ({ x: car.x + side * cos + along * sin, z: car.z + side * sin - along * cos }));
      const spot = exits.find(({ x, z }) => !tenerifePersonHits(x, z) && !xxPersonCar(x, z, car)
        && _P(x, z) > .15 && Math.abs(_P(x, z) - car.y) < 1.1);
      if (!spot) {
        notify('Mută mașina până când poți deschide ușa.');
        return;
      }
      rt.walker = { ...spot, heading: car.heading, pitch: 0 };
      car.speed = car.vx = car.vz = 0;
      setWalking(true);
    }
    rt.keys.clear();
    rt.resetCamera = true;
    updateNearby();
  };
  const collect = () => {
    if (!rt.walker || rt.paused) return;
    const clue = tenerifeFinds.find(item => !rt.finds.has(item.id) && Math.hypot(item.x - rt.walker.x, item.z - rt.walker.z) < 2.25);
    if (!clue) return;
    rt.finds = new Set([...rt.finds, clue.id]);
    try { localStorage.setItem(tenerifeJournalKey, JSON.stringify([...rt.finds])); } catch {}
    setIds(rt.finds);
    setNear(null);
    notify(clue.title);
  };
  const toggleRadio = async () => {
    if (!radio.current) {
      radio.current = new Audio(tenerifeRadioSource);
      radio.current.loop = true;
      radio.current.volume = .39;
    }
    const track = radio.current;
    if (!track.paused) {
      track.pause();
      setPlaying(false);
      return;
    }
    try {
      await track.play();
      setPlaying(!track.paused);
    } catch { notify('Radioul nu a putut porni.'); }
  };
  ee.useEffect(() => {
    rt.finds = ids;
    return () => {
      radio.current?.pause();
      radio.current = null;
    };
  }, [rt]);
  ee.useEffect(() => {
    const root = controls.current?.closest('.drive-root');
    const scene = root?.querySelector('.drive-canvas');
    if (!root || !scene) return;
    const keys = event => {
      if (event.repeat || event.ctrlKey || event.altKey || event.metaKey || rt.paused || !rt.active) return;
      if (event.code === 'KeyF') toggleVehicle();
      if (event.code === 'KeyE') collect();
      if (event.code === 'KeyJ') setJournal(open => !open);
      if (event.code === 'ShiftLeft' && rt.walker) rt.keys.set(event.code, 'sprint');
    };
    let drag = null;
    const start = event => {
      if (event.button !== 0 || !rt.active || rt.paused) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      scene.setPointerCapture(event.pointerId);
    };
    const move = event => {
      if (!drag || drag.id !== event.pointerId || rt.paused) return;
      const x = event.clientX - drag.x;
      const y = event.clientY - drag.y;
      if (rt.walker) {
        rt.walker.heading += x * .006;
        rt.walker.pitch = Vc(rt.walker.pitch - y * .006, -1.12, 1.12);
      } else {
        rt.orbit = (rt.orbit ?? 0) + x * .007;
        rt.tilt = Vc((rt.tilt ?? 0) + y * .004, -.44, 1);
      }
      drag.x = event.clientX;
      drag.y = event.clientY;
    };
    const end = () => { drag = null; };
    rt.refreshHud = updateNearby;
    window.addEventListener('keydown', keys);
    scene.addEventListener('pointerdown', start);
    scene.addEventListener('pointermove', move);
    scene.addEventListener('lostpointercapture', end);
    return () => {
      delete rt.refreshHud;
      window.removeEventListener('keydown', keys);
      scene.removeEventListener('pointerdown', start);
      scene.removeEventListener('pointermove', move);
      scene.removeEventListener('lostpointercapture', end);
    };
  }, [rt, notify, dialog]);
  ee.useEffect(() => {
    if (dialog === 'intro' || dialog === 'pause' || dialog === 'map' || dialog === 'finish') setJournal(false);
  }, [dialog]);
  if (dialog === 'intro') return null;
  const chip = (label, glyph, onClick, pressed) => E.jsx('button', {
    className: 'drive-chip', type: 'button', 'aria-label': label, title: label, 'aria-pressed': pressed, onClick, children: glyph
  });
  return E.jsxs('div', { ref: controls, className: 'tenerife-tools', children: [
    chip(walking ? 'Urcă în mașină' : 'Coboară din mașină', walking ? '↥' : '↧', toggleVehicle),
    chip(playing ? 'Oprește radioul' : 'Pornește radioul', 'FM', toggleRadio, playing),
    chip('Colecția insulei', '◇', () => setJournal(open => !open), journal),
    walking && !dialog && E.jsxs('span', { className: 'tenerife-walk-status', role: 'status', children: ['Pe jos', E.jsx('span', { className: 'tenerife-walk-key', children: ' · F pentru mașină' })] }),
    near && !dialog && E.jsx('button', {
      className: 'drive-primary tenerife-collect', onClick: collect, children: 'Adună · ' + near.title
    }),
    journal && E.jsxs('section', { className: 'tenerife-collection', 'aria-label': 'Colecția insulei', children: [
      E.jsxs('strong', { children: ['Colecția insulei · ', ids.size, '/', tenerifeFinds.length] }),
      ids.size === 0 && E.jsx('p', { children: 'Coboară din mașină și caută reperele aurii.' }),
      E.jsx('ul', { children: tenerifeFinds.filter(item => ids.has(item.id)).map(item => E.jsxs('li', {
        children: [E.jsx('b', { children: item.title }), E.jsx('p', { children: item.text })]
      }, item.id)) }),
      E.jsx('small', { children: 'Radio · BossaBossa, Kevin MacLeod · CC BY 4.0' })
    ] })
  ] });
}
