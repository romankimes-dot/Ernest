// La cabane d'Ernest, dedans : une pièce ronde sous le chaume, un feu, deux fenêtres rondes.
// À gauche, l'étagère à bonsaïs (les objectifs atteints) ; à droite, la réserve (les plantes en dormance) ;
// au milieu, la table avec le livre d'Ernest et le bocal à graines. Ernest se tient près du feu.
// mount(canvas, { onPick }) -> { set({ bonsais, plants, seeds, time }), dispose() } ; toucher renvoie { kind, ... }.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createErnest } from './ernest3d.js';
import { makeSpecimen, makeBonsai } from './garden3d.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const std = (o) => new THREE.MeshStandardMaterial(o);
const R = 3.4, WALL = 2.4;
const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
function planksTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d'), r = rngOf(4);
  for (let i = 0; i < 8; i++) { const v = 100 + Math.floor(r() * 40); x.fillStyle = `rgb(${v + 20},${v - 10},${v - 45})`; x.fillRect(0, i * 32, 256, 31); x.fillStyle = 'rgba(30,20,10,.5)'; x.fillRect(0, i * 32 + 31, 256, 1); x.fillRect(Math.floor(r() * 256), i * 32, 1, 32);
    for (let k = 0; k < 14; k++) { x.strokeStyle = `rgba(40,25,10,${0.08 + r() * 0.1})`; x.beginPath(); const y = i * 32 + r() * 32; x.moveTo(0, y); x.bezierCurveTo(80, y + r() * 4 - 2, 170, y + r() * 4 - 2, 256, y); x.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function mount(canvas, { onPick } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#1a120c');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 40);
  const hemi = new THREE.HemisphereLight(0xffe6c0, 0x3a2a1a, 0.6); scene.add(hemi);
  const win = new THREE.DirectionalLight(0xdfe8ff, 0.9); win.position.set(-4, 3, -1); scene.add(win);

  // pièce : murs chaulés, plancher, chaume et poutres
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WALL, 48, 1, true), std({ color: 0xe6dcc6, roughness: 0.95, side: THREE.BackSide })); wall.position.y = WALL / 2; wall.receiveShadow = true; scene.add(wall);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 48), std({ map: planksTex(), roughness: 0.85 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(R + 0.05, 2.3, 48, 1, true), std({ color: 0xa8884e, roughness: 1, side: THREE.BackSide })); roof.position.y = WALL + 1.15; scene.add(roof);
  const beamM = std({ color: 0x4a3322, roughness: 0.8 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, Math.hypot(R, 2.3)), beamM); b.position.set(Math.cos(a) * R / 2, WALL + 1.15, Math.sin(a) * R / 2); b.lookAt(0, WALL + 2.3, 0); scene.add(b); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.05, 0.08, 6, 48), beamM); ring.rotation.x = Math.PI / 2; ring.position.y = WALL; scene.add(ring);
  // porte ronde rouge (derrière la caméra) et deux fenêtres rondes
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), std({ color: 0x9a2a22, roughness: 0.6 })); door.position.set(0, 0.85, R - 0.03); door.rotation.y = Math.PI; scene.add(door);
  const winMats = [];
  for (const a of [-2.2, -0.95]) { const x = Math.cos(a) * (R - 0.03), z = Math.sin(a) * (R - 0.03), m = std({ color: 0x9fc3e8, emissive: 0x9fc3e8, emissiveIntensity: 0.8 }); winMats.push(m);
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), m); w.position.set(x, 1.55, z); w.lookAt(0, 1.55, 0); scene.add(w);
    const f = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 8, 28), beamM); f.position.copy(w.position); f.lookAt(0, 1.55, 0); scene.add(f);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.04, 0.03), beamM); bar.position.copy(w.position); bar.lookAt(0, 1.55, 0); scene.add(bar); }
  // cheminée de pierres et feu
  const stoneM = std({ color: 0x8a8276, roughness: 0.95 }), r = rngOf(9);
  const fz = -R + 0.45; const hearth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.8), stoneM); hearth.position.set(0, 0.09, fz + 0.1); scene.add(hearth);
  for (let i = 0; i < 26; i++) { const t = i / 25, a = Math.PI * t, s = 0.16 + r() * 0.06, st = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneM); st.position.set(Math.cos(a) * 0.7, 0.2 + Math.sin(a) * 0.95, fz); st.rotation.set(r() * 3, r() * 3, 0); st.castShadow = true; scene.add(st); }
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.2, WALL + 1.6, 0.5), stoneM); chimney.position.set(0, (WALL + 1.6) / 2 + 0.5, fz - 0.15); scene.add(chimney);
  const fireM = std({ color: 0xffb040, emissive: 0xff7a1a, emissiveIntensity: 2.4, transparent: true, opacity: 0.9 }), flames = [];
  for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.09 + r() * 0.05, 0.35 + r() * 0.2, 7), fireM); f.position.set((i - 2) * 0.1, 0.36, fz + 0.05 + (r() - 0.5) * 0.1); scene.add(f); flames.push(f); }
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), std({ color: 0x3a2414 })); l.rotation.z = Math.PI / 2; l.rotation.y = (i - 1) * 0.4; l.position.set(0, 0.22, fz + 0.05); scene.add(l); }
  const fire = new THREE.PointLight(0xff9a40, 6, 7, 1.6); fire.position.set(0, 0.6, fz + 0.35); scene.add(fire);
  // tapis, table, livre, bocal à graines, bougie
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.25, 40), std({ color: 0x8a3a2a, roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.y = 0.005; rug.scale.set(1.3, 1, 1); scene.add(rug);
  const rug2 = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.15, 40), std({ color: 0xd8a84a, roughness: 1 })); rug2.rotation.x = -Math.PI / 2; rug2.position.y = 0.007; rug2.scale.set(1.3, 1, 1); scene.add(rug2);
  const woodM = std({ color: 0x6e4a2c, roughness: 0.75 });
  const table = new THREE.Group(); const top = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 32), woodM); top.position.y = 0.74; top.castShadow = top.receiveShadow = true; table.add(top);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.72, 12), woodM); leg.position.y = 0.36; table.add(leg); table.position.set(0, 0, 0.1); scene.add(table);
  const book = new THREE.Group(), cover = std({ color: 0x5a2a1e, roughness: 0.6 }), page = std({ color: 0xf2e8d0, roughness: 0.9 });
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.4), cover); c.position.set(s * 0.155, 0.01, 0); c.rotation.z = s * -0.08; book.add(c); const pg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.03, 0.37), page); pg.position.set(s * 0.15, 0.035, 0); pg.rotation.z = s * -0.08; book.add(pg); }
  const rib = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.002, 0.3), std({ color: 0xc03030 })); rib.position.set(0.05, 0.055, 0.12); book.add(rib);
  book.position.set(-0.1, 0.77, 0.2); book.rotation.y = 0.3; book.traverse((m) => { m.castShadow = true; m.userData.pick = { kind: 'book' }; }); table.add(book);
  const jar = new THREE.Group(); const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 20, 1, true), std({ color: 0xdfeee8, roughness: 0.05, transparent: true, opacity: 0.3, side: THREE.DoubleSide })); glass.position.y = 0.12; jar.add(glass);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 20), std({ color: 0x8a6a3a })); lid.position.y = 0.255; jar.add(lid);
  const seedM = std({ color: 0xf2c84a, emissive: 0x8a6010, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.3 }), seedIM = new THREE.InstancedMesh(new THREE.SphereGeometry(0.016, 8, 6), seedM, 120); seedIM.count = 0; jar.add(seedIM);
  jar.position.set(0.32, 0.77, -0.15); jar.traverse((m) => (m.userData.pick = { kind: 'seeds' })); table.add(jar);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10), std({ color: 0xf4ecd8 })); candle.position.set(0.15, 0.83, 0.38); table.add(candle);
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), std({ color: 0xffd080, emissive: 0xffa040, emissiveIntensity: 3 })); flame.scale.y = 1.8; flame.position.set(0.15, 0.91, 0.38); table.add(flame);
  const candleL = new THREE.PointLight(0xffb060, 1.2, 3, 1.8); candleL.position.set(0.15, 1.0, 0.48); scene.add(candleL);
  // étagère à bonsaïs (à gauche) et réserve (à droite) : trois planches droites contre le mur
  const shelves = (side) => { const g = new THREE.Group(), x = side * (R - 0.42); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 2.2), woodM); b.position.set(x, 0.55 + i * 0.6, 0); b.castShadow = b.receiveShadow = true; g.add(b); }
    for (const z of [-1.05, 1.05]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.85, 0.05), woodM); p.position.set(x, 1.1, z); g.add(p); } scene.add(g); return x; };
  const SX = shelves(-1), RX = shelves(1);
  const slots = (x) => { const out = []; for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) out.push(V(x, 0.58 + i * 0.6, -0.65 + k * 0.65)); return out; };
  const BS = slots(SX), PS = slots(RX);
  // Ernest près du feu
  const ernest = createErnest({ scale: 0.36, lanternShadow: false }); ernest.root.position.set(0.9, 0, -1.6); ernest.root.rotation.y = -0.6; scene.add(ernest.root); ernest.attach(scene);
  ernest.root.traverse((m) => (m.userData.pick = { kind: 'ernest' }));

  // contenu variable : bonsaïs, plantes au repos, graines
  let dyn = new THREE.Group(); scene.add(dyn); let timeKey = 'day';
  const trayM = std({ color: 0x5a3a2a, roughness: 0.7 });
  function set({ bonsais = [], plants = [], seeds = 0, time = 'day' } = {}) {
    scene.remove(dyn); dyn = new THREE.Group(); scene.add(dyn);
    bonsais.slice(0, BS.length).forEach((b, i) => { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.24), trayM); t.position.y = 0.025; g.add(t); const m = makeBonsai(b.seed, b.branches); m.scale.multiplyScalar(0.42); m.position.y = 0.05; g.add(m);
      g.position.copy(BS[i]); g.rotation.y = Math.PI / 2; g.traverse((o) => { o.castShadow = true; o.userData.pick = { kind: 'bonsai', goal: b.goal }; }); dyn.add(g); });
    plants.slice(0, PS.length).forEach((p, i) => { const g = makeSpecimen(p); g.scale.setScalar(0.55); g.position.copy(PS[i]); g.rotation.y = -Math.PI / 2; g.traverse((o) => { o.castShadow = true; o.userData.pick = { kind: 'plant', id: p.id }; }); dyn.add(g); });
    const n = Math.min(120, Math.max(0, Math.round(seeds))), r2 = rngOf(5), m4 = new THREE.Matrix4(); seedIM.count = n;
    for (let i = 0; i < n; i++) { const a = r2() * 6.28, d = Math.sqrt(r2()) * 0.08; m4.makeTranslation(Math.cos(a) * d, 0.02 + Math.floor(i / 14) * 0.022 + r2() * 0.01, Math.sin(a) * d); seedIM.setMatrixAt(i, m4); }
    seedIM.instanceMatrix.needsUpdate = true;
    timeKey = time; const T = { day: [0x9fc3e8, 0.9, 0.6], dusk: [0xf0a060, 0.6, 0.45], night: [0x1a2a4a, 0.15, 0.3] }[time] || [0x9fc3e8, 0.9, 0.6];
    winMats.forEach((m) => { m.color.setHex(T[0]); m.emissive.setHex(T[0]); }); win.intensity = T[1]; hemi.intensity = T[2];
    ernest.setPose(time === 'night' ? 'lanterne' : 'attend');
  }

  const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.minDistance = 0.6; controls.maxDistance = 2.9; controls.maxPolarAngle = Math.PI * 0.6;
  controls.target.set(0, 1.0, -0.4); camera.position.set(0.2, 1.6, 2.4);
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 70 : 58; camera.updateProjectionMatrix(); };
  window.addEventListener('resize', resize); resize();
  // toucher
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(); let down = null;
  const onDown = (e) => { down = [e.clientX, e.clientY]; };
  const onUp = (e) => { if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) { down = null; return; } down = null; const b = canvas.getBoundingClientRect(); ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(scene.children, true).find((h) => h.object.userData.pick); if (hit && onPick) onPick(hit.object.userData.pick); };
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp);
  let on = true, last = performance.now();
  const loop = () => { if (!on) return; const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000), t = now / 1000; last = now;
    controls.update(); const c = camera.position, d = Math.hypot(c.x, c.z); if (d > R - 0.35) { c.x *= (R - 0.35) / d; c.z *= (R - 0.35) / d; } c.y = Math.max(0.4, Math.min(WALL + 0.6, c.y));
    flames.forEach((f, i) => { f.scale.y = 0.8 + Math.sin(t * 9 + i * 2) * 0.2 + Math.sin(t * 13 + i) * 0.1; f.rotation.y = t * (1 + i * 0.3); });
    fire.intensity = 5.2 + Math.sin(t * 11) * 0.5 + Math.sin(t * 7.3) * 0.4; flame.scale.x = 1 + Math.sin(t * 12) * 0.1;
    ernest.update(dt, { lantern: timeKey === 'night', lanternK: 1.5, groundY: 0, still: true });
    renderer.render(scene, camera); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  return { set, resize, dispose() { on = false; window.removeEventListener('resize', resize); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); controls.dispose(); renderer.dispose(); try { renderer.forceContextLoss(); } catch { /* ignore */ } } };
}
