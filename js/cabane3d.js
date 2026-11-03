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
// ---------- Textures dessinées (canvas) : chaux, pierre, chaume, bois, tapis, tableau ----------
const canv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
const texOf = (c, rx = 1, ry = 1, srgb = true) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
// matériau texturé : la même image sert de relief (bump)
const texM = (c, rx, ry, o = {}) => std({ map: texOf(c, rx, ry), bumpMap: texOf(c, rx, ry, false), bumpScale: o.bump ?? 2, roughness: o.rough ?? 0.9, ...o.extra });
function plasterCv() { return canv(512, 256, (x, w, h) => { const r = rngOf(21); x.fillStyle = '#e4d9c2'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { const px = r() * w, py = r() * h, rad = 10 + r() * 50, g = x.createRadialGradient(px, py, 0, px, py, rad), d = r() < 0.5; g.addColorStop(0, d ? 'rgba(150,130,100,0.10)' : 'rgba(255,250,235,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
  for (let i = 0; i < 9; i++) { const sx = r() * w, sy = r() * h, sw = 20 + r() * 40, sh = 12 + r() * 20; x.fillStyle = `rgba(${130 + r() * 30},${120 + r() * 20},${105 + r() * 20},0.5)`; x.beginPath(); x.ellipse(sx, sy, sw / 2, sh / 2, r(), 0, 6.29); x.fill(); x.strokeStyle = 'rgba(90,80,70,.35)'; x.stroke(); }
  x.strokeStyle = 'rgba(110,95,80,.45)'; x.lineWidth = 0.8; for (let i = 0; i < 14; i++) { let px = r() * w, py = r() * h; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 12; k++) { px += (r() - 0.5) * 14; py += r() * 9; x.lineTo(px, py); } x.stroke(); }
  const g = x.createLinearGradient(0, h * 0.7, 0, h); g.addColorStop(0, 'rgba(120,95,70,0)'); g.addColorStop(1, 'rgba(110,85,60,0.35)'); x.fillStyle = g; x.fillRect(0, h * 0.7, w, h * 0.3);
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '80,70,60'},${r() * 0.08})`; x.fillRect(r() * w, r() * h, 1.5, 1.5); } }); }
function stoneCv() { return canv(256, 256, (x, w, h) => { const r = rngOf(31); x.fillStyle = '#5a5248'; x.fillRect(0, 0, w, h);
  for (let j = 0; j < 7; j++) for (let i = 0; i < 6; i++) { const cx = i * 44 + (j % 2) * 22 + r() * 8, cy = j * 38 + r() * 6, rw = 18 + r() * 6, rh = 14 + r() * 5, v = 0.75 + r() * 0.4;
    x.fillStyle = `rgb(${Math.floor(150 * v)},${Math.floor(142 * v)},${Math.floor(128 * v)})`; x.beginPath(); for (let k = 0; k < 9; k++) { const a = (k / 9) * 6.29, rr = 1 + (r() - 0.5) * 0.25; x.lineTo(cx + Math.cos(a) * rw * rr, cy + Math.sin(a) * rh * rr); } x.closePath(); x.fill();
    const g = x.createLinearGradient(cx, cy - rh, cx, cy + rh); g.addColorStop(0, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(0,0,0,.25)'); x.fillStyle = g; x.fill();
    for (let k = 0; k < 20; k++) { x.fillStyle = `rgba(0,0,0,${r() * 0.15})`; x.fillRect(cx + (r() - 0.5) * rw * 1.4, cy + (r() - 0.5) * rh * 1.4, 2, 2); } } }); }
function strawCv() { return canv(256, 256, (x, w, h) => { const r = rngOf(41); x.fillStyle = '#8a6a3a'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) { const v = 140 + Math.floor(r() * 110), px = r() * w, py = r() * h, L = 18 + r() * 60; x.strokeStyle = `rgb(${v},${Math.floor(v * 0.82)},${Math.floor(v * 0.5)})`; x.lineWidth = 0.6 + r() * 1.6; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + (r() - 0.5) * 6, py + L / 2, px + (r() - 0.5) * 8, py + L); x.stroke(); }
  x.fillStyle = 'rgba(40,25,10,0.3)'; for (let i = 0; i < 60; i++) x.fillRect(r() * w, r() * h, 1.5, 10 + r() * 30); }); }
function woodCv(base = [110, 74, 44]) { return canv(128, 256, (x, w, h) => { const r = rngOf(51 + base[0]); x.fillStyle = `rgb(${base.join(',')})`; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 90; i++) { const v = (r() - 0.5) * 60, px = r() * w; x.strokeStyle = `rgba(${v > 0 ? '255,230,200' : '30,15,5'},${Math.abs(v) / 160})`; x.lineWidth = 0.5 + r() * 2.5; x.beginPath(); x.moveTo(px, 0); for (let y = 0; y <= h; y += 12) x.lineTo(px + Math.sin(y * 0.04 + i) * 3, y); x.stroke(); }
  for (let i = 0; i < 4; i++) { const kx = r() * w, ky = r() * h; for (let k = 0; k < 5; k++) { x.strokeStyle = `rgba(40,20,8,${0.5 - k * 0.08})`; x.beginPath(); x.ellipse(kx, ky, 2 + k * 2.5, 5 + k * 4, 0, 0, 6.29); x.stroke(); } } }); }
function planksCv() { return canv(256, 256, (x, w, h) => { const r = rngOf(4);
  for (let i = 0; i < 8; i++) { const v = 100 + Math.floor(r() * 40); x.fillStyle = `rgb(${v + 20},${v - 10},${v - 45})`; x.fillRect(0, i * 32, 256, 31); x.fillStyle = 'rgba(30,20,10,.7)'; x.fillRect(0, i * 32 + 31, 256, 1.5); const cut = Math.floor(r() * 256); x.fillRect(cut, i * 32, 1.5, 32);
    for (const nx of [cut + 6, cut - 6]) { x.fillStyle = 'rgba(20,15,10,.8)'; x.fillRect(nx, i * 32 + 8, 2, 2); x.fillRect(nx, i * 32 + 22, 2, 2); }
    for (let k = 0; k < 18; k++) { x.strokeStyle = `rgba(40,25,10,${0.08 + r() * 0.14})`; x.beginPath(); const y = i * 32 + r() * 32; x.moveTo(0, y); x.bezierCurveTo(80, y + r() * 4 - 2, 170, y + r() * 4 - 2, 256, y); x.stroke(); } }
  for (let i = 0; i < 12; i++) { const px = r() * w, py = r() * h, g = x.createRadialGradient(px, py, 0, px, py, 30); g.addColorStop(0, 'rgba(220,190,150,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - 30, py - 30, 60, 60); } }); }
function rugCv() { return canv(512, 512, (x, w, h) => { const c = w / 2, r = rngOf(61); x.fillStyle = '#7a2a20'; x.fillRect(0, 0, w, h);
  const ring = (rad, col, lw) => { x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); x.arc(c, c, rad, 0, 6.29); x.stroke(); };
  ring(245, '#d8a84a', 14); ring(225, '#2a3a5a', 10); ring(160, '#d8a84a', 6); ring(80, '#e8d8b0', 5);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.29, px = c + Math.cos(a) * 192, py = c + Math.sin(a) * 192; x.save(); x.translate(px, py); x.rotate(a); x.fillStyle = i % 2 ? '#e8d8b0' : '#2a3a5a'; x.beginPath(); x.moveTo(0, -16); x.lineTo(12, 0); x.lineTo(0, 16); x.lineTo(-12, 0); x.closePath(); x.fill(); x.fillStyle = '#7a2a20'; x.fillRect(-3, -3, 6, 6); x.restore(); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.29; x.save(); x.translate(c, c); x.rotate(a); x.fillStyle = '#c8783a'; x.beginPath(); x.moveTo(0, -75); x.quadraticCurveTo(26, -120, 0, -150); x.quadraticCurveTo(-26, -120, 0, -75); x.fill(); x.restore(); }
  x.fillStyle = '#2a3a5a'; x.beginPath(); x.arc(c, c, 40, 0, 6.29); x.fill(); x.fillStyle = '#d8a84a'; x.beginPath(); x.arc(c, c, 14, 0, 6.29); x.fill();
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,240,220' : '20,10,5'},${r() * 0.07})`; x.fillRect(r() * w, r() * h, 2, 1); } }); }
function paintingCv() { return canv(256, 192, (x, w, h) => { const sky = x.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, '#8fb3cf'); sky.addColorStop(1, '#f0d8a8'); x.fillStyle = sky; x.fillRect(0, 0, w, h);
  x.fillStyle = '#6a8a4a'; x.beginPath(); x.moveTo(0, h * 0.62); x.quadraticCurveTo(w * 0.3, h * 0.45, w * 0.6, h * 0.6); x.quadraticCurveTo(w * 0.85, h * 0.5, w, h * 0.58); x.lineTo(w, h); x.lineTo(0, h); x.fill();
  x.fillStyle = '#4a6a3a'; x.fillRect(0, h * 0.78, w, h * 0.22);
  for (const [gx, gw] of [[40, 50], [110, 60], [190, 45]]) { x.strokeStyle = '#f0f0e8'; x.lineWidth = 2; x.beginPath(); x.moveTo(gx, h * 0.76); x.lineTo(gx, h * 0.62); x.lineTo(gx + gw / 2, h * 0.52); x.lineTo(gx + gw, h * 0.62); x.lineTo(gx + gw, h * 0.76); x.stroke(); x.fillStyle = 'rgba(200,230,220,.35)'; x.fill(); }
  x.fillStyle = '#c8a050'; x.beginPath(); x.arc(150, h * 0.66, 16, Math.PI, 0); x.fill(); x.fillStyle = '#9a2a22'; x.fillRect(146, h * 0.66 - 8, 8, 8);
  x.fillStyle = 'rgba(255,240,200,.9)'; x.beginPath(); x.arc(w * 0.82, h * 0.18, 12, 0, 6.29); x.fill(); }); }

export function mount(canvas, { onPick } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#1a120c');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 40);
  const hemi = new THREE.HemisphereLight(0xffe6c0, 0x3a2a1a, 0.6); scene.add(hemi);
  const win = new THREE.DirectionalLight(0xdfe8ff, 0.9); win.position.set(-4, 3, -1); scene.add(win);

  // pièce : murs chaulés, plancher, chaume et poutres
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WALL, 48, 1, true), texM(plasterCv(), 4, 1, { bump: 3, rough: 0.95, extra: { side: THREE.BackSide } })); wall.position.y = WALL / 2; wall.receiveShadow = true; scene.add(wall);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 48), texM(planksCv(), 3, 3, { bump: 2.5, rough: 0.8 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(R + 0.05, 2.3, 48, 1, true), texM(strawCv(), 8, 2, { bump: 4, rough: 1, extra: { side: THREE.BackSide } })); roof.position.y = WALL + 1.15; scene.add(roof);
  const beamM = texM(woodCv([74, 50, 32]), 1, 2, { bump: 2, rough: 0.8 });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, Math.hypot(R, 2.3)), beamM); b.position.set(Math.cos(a) * R / 2, WALL + 1.15, Math.sin(a) * R / 2); b.lookAt(0, WALL + 2.3, 0); scene.add(b); }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.05, 0.08, 6, 48), beamM); ring.rotation.x = Math.PI / 2; ring.position.y = WALL; scene.add(ring);
  // porte ronde rouge (derrière la caméra) et deux fenêtres rondes
  const door = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), texM(woodCv([150, 40, 34]), 2, 1, { bump: 2, rough: 0.6 })); door.position.set(0, 0.85, R - 0.03); door.rotation.y = Math.PI; scene.add(door);
  const winMats = [];
  for (const a of [-2.2, -0.95]) { const x = Math.cos(a) * (R - 0.03), z = Math.sin(a) * (R - 0.03), m = std({ color: 0x9fc3e8, emissive: 0x9fc3e8, emissiveIntensity: 0.8 }); winMats.push(m);
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.42, 28), m); w.position.set(x, 1.55, z); w.lookAt(0, 1.55, 0); scene.add(w);
    const f = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.05, 8, 28), beamM); f.position.copy(w.position); f.lookAt(0, 1.55, 0); scene.add(f);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.04, 0.03), beamM); bar.position.copy(w.position); bar.lookAt(0, 1.55, 0); scene.add(bar); }
  // cheminée de pierres et feu
  const stoneM = texM(stoneCv(), 2, 2, { bump: 5, rough: 0.95 }), r = rngOf(9);
  const fz = -R + 0.45; const hearth = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.18, 0.8), stoneM); hearth.position.set(0, 0.09, fz + 0.1); scene.add(hearth);
  for (let i = 0; i < 26; i++) { const t = i / 25, a = Math.PI * t, s = 0.16 + r() * 0.06, st = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), stoneM); st.position.set(Math.cos(a) * 0.7, 0.2 + Math.sin(a) * 0.95, fz); st.rotation.set(r() * 3, r() * 3, 0); st.castShadow = true; scene.add(st); }
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.2, WALL + 1.6, 0.5), texM(stoneCv(), 1.5, 4.5, { bump: 5, rough: 0.95 })); chimney.position.set(0, (WALL + 1.6) / 2 + 0.5, fz - 0.15); scene.add(chimney);
  const fireM = std({ color: 0xffb040, emissive: 0xff7a1a, emissiveIntensity: 2.4, transparent: true, opacity: 0.9 }), flames = [];
  for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.09 + r() * 0.05, 0.35 + r() * 0.2, 7), fireM); f.position.set((i - 2) * 0.1, 0.36, fz + 0.05 + (r() - 0.5) * 0.1); scene.add(f); flames.push(f); }
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), std({ color: 0x3a2414 })); l.rotation.z = Math.PI / 2; l.rotation.y = (i - 1) * 0.4; l.position.set(0, 0.22, fz + 0.05); scene.add(l); }
  const fire = new THREE.PointLight(0xff9a40, 6, 7, 1.6); fire.position.set(0, 0.6, fz + 0.35); scene.add(fire);
  // tapis, table, livre, bocal à graines, bougie
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.25, 40), texM(rugCv(), 1, 1, { bump: 1, rough: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.y = 0.005; rug.scale.set(1.3, 1, 1); scene.add(rug);
  const woodM = texM(woodCv(), 1, 1, { bump: 1.5, rough: 0.7 });
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
  // ---------- Les objets d'Ernest : beaucoup de choses, comme chez un vieux jardinier ----------
  const darkWood = texM(woodCv([70, 46, 28]), 1, 1, { bump: 1.5, rough: 0.7 });
  // manteau de cheminée, bocaux, chandelier, petite horloge
  const mantel = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.3), darkWood); mantel.position.set(0, 1.42, fz + 0.2); mantel.castShadow = true; scene.add(mantel);
  const jarCols = [0x9ab87a, 0xc8a050, 0x8a5a3a, 0xd8d0b8, 0x6a8aa0];
  for (let i = 0; i < 7; i++) { const x = -0.75 + i * 0.25; if (Math.abs(x) < 0.12) continue; const tall = 0.1 + r() * 0.12, jr = 0.035 + r() * 0.02;
    const j = new THREE.Mesh(new THREE.CylinderGeometry(jr, jr, tall, 12), std({ color: jarCols[i % 5], roughness: 0.25, transparent: true, opacity: 0.85 })); j.position.set(x, 1.46 + tall / 2, fz + 0.2); scene.add(j);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(jr * 1.05, jr * 1.05, 0.02, 12), std({ color: 0x8a6a3a })); c.position.set(x, 1.47 + tall, fz + 0.2); scene.add(c); }
  const clockF = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 24), std({ color: 0xf2ead8 })); clockF.rotation.x = Math.PI / 2; clockF.position.set(0, 1.6, fz + 0.24); scene.add(clockF);
  const clockB = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.1), darkWood); clockB.position.set(0, 1.58, fz + 0.17); scene.add(clockB);
  // marmite pendue dans l'âtre
  const iron = std({ color: 0x2a2826, roughness: 0.5, metalness: 0.6 });
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10, 0, 6.29, Math.PI * 0.35, Math.PI * 0.65), iron); pot.position.set(0.35, 0.42, fz + 0.12); scene.add(pot);
  const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), iron); hook.position.set(0.35, 0.78, fz + 0.12); scene.add(hook);
  // casseroles de cuivre sur une barre
  const copper = std({ color: 0xc67a48, roughness: 0.3, metalness: 0.85 }), rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6), iron); rail.rotation.z = Math.PI / 2; rail.position.set(1.35, 1.75, -R + 0.95); rail.rotation.y = -0.5; scene.add(rail);
  for (let i = 0; i < 4; i++) { const pan = new THREE.Group(), rr = 0.08 + i * 0.02; const b = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 0.9, 0.06, 18, 1, true), copper); b.material.side = THREE.DoubleSide; pan.add(b); const bt = new THREE.Mesh(new THREE.CircleGeometry(rr * 0.9, 18), copper); bt.rotation.x = Math.PI / 2; bt.position.y = -0.03; pan.add(bt);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.18), darkWood); h.position.set(0, 0.03, rr + 0.08); pan.add(h); pan.rotation.x = -Math.PI / 2 + 0.1; pan.position.set(1.08 + i * 0.2, 1.55 - rr, -R + 0.82 + i * 0.1); pan.rotation.z = -0.5; scene.add(pan); }
  // tas de bûches à gauche de l'âtre
  const logM = texM(woodCv([90, 60, 36]), 1, 1, { bump: 2, rough: 0.9 }), endM = std({ color: 0xc8a070, roughness: 0.9 });
  for (let row = 0; row < 4; row++) for (let i = 0; i < 4 - row; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), [logM, endM, endM]); l.rotation.x = Math.PI / 2; l.position.set(-1.05 - i * 0.15 - row * 0.075 + 0.2, 0.07 + row * 0.13, fz + 0.15); l.rotation.z = (r() - 0.5) * 0.1; l.castShadow = true; scene.add(l); }
  // fauteuil près du feu, coussin
  const fabric = texM(canv(64, 64, (x, w, h) => { x.fillStyle = '#5a6a3a'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(30,40,20,.5)'; for (let i = 0; i < w; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } x.fillStyle = 'rgba(200,170,90,.5)'; for (let i = 4; i < w; i += 16) for (let j = 4; j < h; j += 16) x.fillRect(i, j, 4, 4); }), 2, 2, { bump: 1, rough: 1 });
  const chair = new THREE.Group(); const box = (sx, sy, sz, px, py, pz, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(px, py, pz); b.castShadow = true; chair.add(b); return b; };
  box(0.7, 0.18, 0.62, 0, 0.36, 0, fabric); box(0.7, 0.7, 0.14, 0, 0.75, -0.26, fabric); box(0.12, 0.38, 0.62, -0.38, 0.5, 0, fabric); box(0.12, 0.38, 0.62, 0.38, 0.5, 0, fabric);
  for (const [dx, dz] of [[-0.3, -0.25], [0.3, -0.25], [-0.3, 0.25], [0.3, 0.25]]) box(0.06, 0.28, 0.06, dx, 0.14, dz, darkWood);
  const cush = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), std({ color: 0xc87a3a, roughness: 1 })); cush.scale.set(1, 0.45, 1); cush.position.set(0.15, 0.5, -0.1); chair.add(cush);
  chair.position.set(-1.45, 0, -1.25); chair.rotation.y = 0.9; scene.add(chair);
  // tableau au mur (les trois serres au soleil couchant)
  { const a = 2.35, x = Math.cos(a) * (R - 0.04), z = Math.sin(a) * (R - 0.04); const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), std({ map: texOf(paintingCv()), roughness: 0.8 })); pic.position.set(x, 1.6, z); pic.lookAt(0, 1.6, 0); scene.add(pic);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.62, 0.03), std({ color: 0x8a6a2a, roughness: 0.4, metalness: 0.5 })); fr.position.set(x * 1.005, 1.6, z * 1.005); fr.lookAt(0, 1.6, 0); scene.add(fr); }
  // balai contre le mur, panier
  { const a = 0.75, x = Math.cos(a) * (R - 0.25), z = Math.sin(a) * (R - 0.25); const br = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.4, 6), darkWood); st.position.y = 0.85; br.add(st);
    const bris = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 12), texM(strawCv(), 1, 1, { bump: 2 })); bris.position.y = 0.17; bris.rotation.x = Math.PI; br.add(bris); br.position.set(x, 0, z); br.rotation.z = 0.18; br.rotation.y = -a; scene.add(br);
    const bask = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.22, 16, 1, true), texM(strawCv(), 2, 1, { bump: 3, extra: { side: THREE.DoubleSide } })); bask.position.set(x - 0.45, 0.11, z + 0.1); scene.add(bask);
    for (let i = 0; i < 6; i++) { const ap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std({ color: i % 2 ? 0xb83a2a : 0x9ab83a, roughness: 0.5 })); ap.position.set(x - 0.45 + (r() - 0.5) * 0.2, 0.2 + r() * 0.04, z + 0.1 + (r() - 0.5) * 0.2); scene.add(ap); } }
  // piles de livres au sol et sur la table
  const bookCols = [0x6a2a24, 0x2a4a3a, 0x2a3550, 0x8a6a3a, 0x5a3a4a];
  const stack = (x, y, z, n, rot = 0, parent = scene) => { let h = y; for (let i = 0; i < n; i++) { const t = 0.04 + r() * 0.03, b = new THREE.Mesh(new THREE.BoxGeometry(0.22 + r() * 0.08, t, 0.3 + r() * 0.06), [std({ color: 0xeee2c8 }), std({ color: 0xeee2c8 }), std({ color: bookCols[i % 5], roughness: 0.6 }), std({ color: bookCols[i % 5] }), std({ color: 0xeee2c8 }), std({ color: bookCols[i % 5] })]); b.position.set(x, h + t / 2, z); b.rotation.y = rot + (r() - 0.5) * 0.4; b.castShadow = true; parent.add(b); h += t; } };
  stack(-2.2, 0, 1.5, 5, 0.4); stack(2.0, 0, 1.6, 3, -0.3);
  // bouquets qui sèchent aux poutres, tresse d'ail
  const herbCols = [0x7a8a5a, 0x9a7ab0, 0xc8b060, 0x6a7a4a, 0xa8603a];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + 0.2, rad = 2.2 + r() * 0.5, b = new THREE.Group(), m = std({ color: herbCols[i % 5], roughness: 1 });
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.25, 4), std({ color: 0xb89a6a })); cord.position.y = -0.12; b.add(cord);
    for (let k = 0; k < 10; k++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.3, 4), m); s.position.set((r() - 0.5) * 0.07, -0.38, (r() - 0.5) * 0.07); s.rotation.set(Math.PI + (r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5); b.add(s); }
    b.position.set(Math.cos(a) * rad, WALL + 0.35 - (rad - 2.2) * 0.4, Math.sin(a) * rad); b.traverse((o) => (o.castShadow = true)); scene.add(b); }
  { const braid = new THREE.Group(); for (let i = 0; i < 9; i++) { const g = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), std({ color: 0xeee6d4, roughness: 0.8 })); g.scale.y = 1.2; g.position.set((i % 2 - 0.5) * 0.06, -i * 0.07, 0); braid.add(g); } braid.position.set(-0.85, 2.05, fz + 0.35); scene.add(braid); }
  // lanterne pendue au centre ; plante sur le rebord d'une fenêtre
  const lantern = new THREE.Group(), glowM = std({ color: 0xffe0a0, emissive: 0xffa040, emissiveIntensity: 0 }); const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.24, 6), glowM); lantern.add(cage);
  const capL = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.12, 6), iron); capL.position.y = 0.18; lantern.add(capL); const chL = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1.6, 4), iron); chL.position.y = 1.0; lantern.add(chL);
  lantern.position.set(0, WALL + 0.3, 0); scene.add(lantern); const lanternL = new THREE.PointLight(0xffb060, 0, 5, 1.6); lanternL.position.set(0, WALL + 0.2, 0); scene.add(lanternL);
  { const a = -0.95, x = Math.cos(a) * (R - 0.35), z = Math.sin(a) * (R - 0.35); const sill = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.28), darkWood); sill.position.set(x, 1.1, z); sill.lookAt(0, 1.1, 0); scene.add(sill);
    const sp = makeSpecimen({ id: 'cab', kind: 'plant', v: 2, sp: 'basilic', cat: 'bienetre', seed: 123 }); sp.scale.setScalar(0.45); sp.position.set(x, 1.12, z); scene.add(sp); }
  // Ernest près du feu
  const ernest = createErnest({ scale: 0.36, lanternShadow: false }); ernest.root.position.set(0.9, 0, -1.6); ernest.root.rotation.y = -0.6; scene.add(ernest.root); ernest.attach(scene);
  ernest.root.traverse((m) => (m.userData.pick = { kind: 'ernest' }));

  // contenu variable : bonsaïs, plantes au repos, graines
  let dyn = new THREE.Group(); scene.add(dyn); let timeKey = 'day';
  const trayM = std({ color: 0x5a3a2a, roughness: 0.7 });
  // Les bonsaïs et les plantes déjà dessinés sont gardés (même objectif, mêmes branches ; même plante) : rafraîchir la
  // cabane ne refait que ce qui a changé, et ce qui part est libéré (sauf les formes partagées avec le village).
  const keep = new Map();
  const free = (g) => g.traverse((o) => { if (o.geometry && o.geometry.userData.own) o.geometry.dispose(); }); // seulement ce que la cabane a créé : les formes du village sont partagées
  const reuse = (key, make) => { if (!keep.has(key)) keep.set(key, make()); return keep.get(key); };
  function set({ bonsais = [], plants = [], seeds = 0, time = 'day' } = {}) {
    const used = new Set(); scene.remove(dyn); dyn = new THREE.Group(); scene.add(dyn);
    bonsais.slice(0, BS.length).forEach((b, i) => { const key = `b:${b.goal}:${b.branches}`; used.add(key); const fresh = !keep.has(key), g = reuse(key, () => new THREE.Group()); if (fresh) { const tg = new THREE.BoxGeometry(0.36, 0.05, 0.24); tg.userData.own = true; const t = new THREE.Mesh(tg, trayM); t.position.y = 0.025; g.add(t); const m = makeBonsai(b.seed, b.branches); m.scale.multiplyScalar(0.42); m.position.y = 0.05; g.add(m);
      } g.position.copy(BS[i]); g.rotation.y = Math.PI / 2; g.traverse((o) => { o.castShadow = true; o.userData.pick = { kind: 'bonsai', goal: b.goal }; }); dyn.add(g); });
    plants.slice(0, PS.length).forEach((p, i) => { const key = `p:${p.id}:${p.sp}:${p.seed}`; used.add(key); const g = reuse(key, () => makeSpecimen(p)); g.scale.setScalar(0.55); g.position.copy(PS[i]); g.rotation.y = -Math.PI / 2; g.traverse((o) => { o.castShadow = true; o.userData.pick = { kind: 'plant', id: p.id }; }); dyn.add(g); });
    for (const [k, g] of keep) if (!used.has(k)) { free(g); keep.delete(k); }
    const n = Math.min(120, Math.max(0, Math.round(seeds))), r2 = rngOf(5), m4 = new THREE.Matrix4(); seedIM.count = n;
    for (let i = 0; i < n; i++) { const a = r2() * 6.28, d = Math.sqrt(r2()) * 0.08; m4.makeTranslation(Math.cos(a) * d, 0.02 + Math.floor(i / 14) * 0.022 + r2() * 0.01, Math.sin(a) * d); seedIM.setMatrixAt(i, m4); }
    seedIM.instanceMatrix.needsUpdate = true;
    timeKey = time; const T = { day: [0x9fc3e8, 0.9, 0.6], dusk: [0xf0a060, 0.6, 0.45], night: [0x1a2a4a, 0.15, 0.3] }[time] || [0x9fc3e8, 0.9, 0.6];
    winMats.forEach((m) => { m.color.setHex(T[0]); m.emissive.setHex(T[0]); }); win.intensity = T[1]; hemi.intensity = T[2];
    ernest.setPose(time === 'night' ? 'lanterne' : 'attend'); glowM.emissiveIntensity = time === 'day' ? 0 : 2; lanternL.intensity = time === 'day' ? 0 : time === 'dusk' ? 1.2 : 2.2;
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
  return { set, resize,
    pause() { if (!on) return; on = false; canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); controls.enabled = false; },
    resume() { if (on) return; on = true; canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp); controls.enabled = true; last = performance.now(); resize(); requestAnimationFrame(loop); },
    dispose() { this.pause(); window.removeEventListener('resize', resize); controls.dispose(); renderer.dispose(); try { renderer.forceContextLoss(); } catch { /* ignore */ } } };
}
