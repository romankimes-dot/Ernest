// La serre en 3D (maquette) : three.js, tout est généré par code.
// Structure victorienne, tables et pots, neuf espèces procédurales (fougère, succulente, fleur, grandes feuilles,
// graminée, aromatique, grimpante, bonsaï, suspension), mousses et champignons, lanternes, lucioles, ciel jour/nuit.
// Quatre stades montrent la serre qui se remplit avec le temps ; l'humeur règle la lumière.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { svg as ernestSvg } from './ernest.js';

// ---------- Outils ----------
const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const lerp = (a, b, t) => a + (b - a) * t;
const UP = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();
const col = (h) => new THREE.Color(h);
const vary = (c, rng, amt = 0.08) => { const o = c.clone(); const hsl = {}; o.getHSL(hsl); o.setHSL(hsl.h + (rng() - 0.5) * amt * 0.5, Math.min(1, hsl.s + (rng() - 0.5) * amt), Math.min(1, hsl.l + (rng() - 0.5) * amt)); return o; };

// ---------- Rendu ----------
const W = () => window.innerWidth, H = () => window.innerHeight;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(W(), H());
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x08131c, 14, 46);
const camera = new THREE.PerspectiveCamera(52, W() / H(), 0.05, 200);
camera.position.set(1.15, 1.75, 6.3);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.0, -1.2);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.enablePan = false; controls.minDistance = 2.2; controls.maxDistance = 11;
controls.maxPolarAngle = Math.PI * 0.49; controls.minPolarAngle = 0.25;
controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.8;
controls.update();

// ---------- Lumières ----------
const hemi = new THREE.HemisphereLight(0xbfe3f0, 0x3a3020, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.position.set(6, 10, 5); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -8; sun.shadow.camera.right = 8; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; sun.shadow.camera.far = 30; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
scene.add(sun);

// ---------- Ciel, étoiles, sol extérieur ----------
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: col('#0a1a2a') }, bottom: { value: col('#10251f') } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(80, 24, 12), skyMat));
const starsGeo = new THREE.BufferGeometry(); { const r = rngOf(7), p = []; for (let i = 0; i < 500; i++) { const th = r() * Math.PI * 2, ph = r() * 1.3; p.push(70 * Math.sin(ph) * Math.cos(th), 70 * Math.cos(ph) + 4, 70 * Math.sin(ph) * Math.sin(th)); } starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xefe6d2, size: 0.18, sizeAttenuation: true, transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
scene.add(stars);
const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf4ecd8, fog: false }));
moon.position.set(-22, 26, -40); scene.add(moon);

const outside = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ color: 0x1f3324, roughness: 1 }));
outside.rotation.x = -Math.PI / 2; outside.position.y = -0.01; outside.receiveShadow = true; scene.add(outside);
// touffes d'herbe dehors
{
  const r = rngOf(11), g = new THREE.ConeGeometry(0.05, 0.35, 3); g.translate(0, 0.17, 0);
  const n = 900, m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), n);
  let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const x = (r() - 0.5) * 40, z = (r() - 0.5) * 40; if (Math.abs(x) < 4.3 && Math.abs(z) < 6.9) continue;
    dummy.position.set(x, 0, z); dummy.rotation.set((r() - 0.5) * 0.4, r() * 6, (r() - 0.5) * 0.4); const s = 0.6 + r() * 1.2; dummy.scale.set(s, s * (0.7 + r()), s); dummy.updateMatrix();
    m.setMatrixAt(k, dummy.matrix); m.setColorAt(k, vary(col('#3d6b3f'), r, 0.15)); k++;
  }
  m.count = k; m.receiveShadow = true; scene.add(m);
}

// ---------- Matériaux ----------
const M = {
  frame: new THREE.MeshStandardMaterial({ color: 0x23352d, roughness: 0.55, metalness: 0.6 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xa8d0c8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.85 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 }),
  terra: new THREE.MeshStandardMaterial({ color: 0xb4652a, roughness: 0.9 }),
  terraDark: new THREE.MeshStandardMaterial({ color: 0x8e4c1f, roughness: 0.95 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x2b1d10, roughness: 1 }),
  gravel: new THREE.MeshStandardMaterial({ color: 0x4a4636, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x8c8676, roughness: 0.95 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, side: THREE.DoubleSide }),
  leafFlat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }),
  stem: new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.8 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5b3f26, roughness: 0.95 }),
  bulb: new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xf2b23d, emissiveIntensity: 2.2 }),
  chain: new THREE.MeshStandardMaterial({ color: 0x3a3a34, roughness: 0.6, metalness: 0.7 }),
};

// ---------- La serre ----------
const GW = 3.6, GD = 6.6, GH = 2.6, GR = 4.3; // demi-largeur, demi-profondeur, hauteur des murs, faîtage
const greenhouse = new THREE.Group(); scene.add(greenhouse);
const beam = (a, b, t = 0.06, mat = M.frame) => {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, len, t), mat);
  m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); m.castShadow = true; greenhouse.add(m); return m;
};
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// sol intérieur, allée de dalles
{ const f = new THREE.Mesh(new THREE.PlaneGeometry(GW * 2, GD * 2), M.gravel); f.rotation.x = -Math.PI / 2; f.receiveShadow = true; greenhouse.add(f);
  const r = rngOf(3), g = new THREE.BoxGeometry(1, 0.04, 1), n = 34, m = new THREE.InstancedMesh(g, M.stone, n);
  for (let i = 0; i < n; i++) { const z = GD - 0.35 - i * 0.39, x = (i % 2 ? 0.28 : -0.28) + (r() - 0.5) * 0.06; dummy.position.set(x, 0.015, z); dummy.rotation.set(0, (r() - 0.5) * 0.2, 0); dummy.scale.set(0.52 + r() * 0.1, 1, 0.34 + r() * 0.04); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, vary(col('#8c8676'), r, 0.1)); }
  m.receiveShadow = true; greenhouse.add(m); }
// soubassement de briques
{ const base = new THREE.MeshStandardMaterial({ color: 0x6b3f2a, roughness: 1 });
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, GD * 2), base); w.position.set(s * GW, 0.25, 0); w.receiveShadow = w.castShadow = true; greenhouse.add(w); }
  const b = new THREE.Mesh(new THREE.BoxGeometry(GW * 2, 0.5, 0.16), base); b.position.set(0, 0.25, -GD); greenhouse.add(b); }
// structure : poteaux, chevrons, faîtage, lisses
const bays = 9;
for (let i = 0; i <= bays; i++) {
  const z = -GD + (i * 2 * GD) / bays;
  for (const s of [-1, 1]) { beam(V(s * GW, 0.5, z), V(s * GW, GH, z)); beam(V(s * GW, GH, z), V(0, GR, z)); }
}
for (const s of [-1, 1]) { beam(V(s * GW, GH, -GD), V(s * GW, GH, GD)); beam(V(s * GW, 1.4, -GD), V(s * GW, 1.4, GD), 0.035); beam(V(s * GW * 0.5, (GH + GR) / 2, -GD), V(s * GW * 0.5, (GH + GR) / 2, GD), 0.035); }
beam(V(0, GR, -GD), V(0, GR, GD), 0.09);
for (const z of [-GD, GD]) { for (const x of [-GW / 2, 0, GW / 2]) beam(V(x, 0.5, z), V(x, GH + (GR - GH) * (1 - Math.abs(x) / GW), z), 0.05); beam(V(-GW, 1.4, z), V(GW, 1.4, z), 0.035); }
// vitrages
{ const add = (g, pos) => { const m = new THREE.Mesh(g, M.glass); m.position.copy(pos); m.renderOrder = 2; greenhouse.add(m); return m; };
  const slope = Math.hypot(GW, GR - GH), ang = Math.atan2(GR - GH, GW);
  for (const s of [-1, 1]) {
    add(new THREE.PlaneGeometry(GD * 2, GH - 0.5), V(s * GW, 0.5 + (GH - 0.5) / 2, 0)).rotation.y = Math.PI / 2;
    const rg = new THREE.PlaneGeometry(slope, GD * 2); rg.rotateX(-Math.PI / 2);
    add(rg, V(s * GW / 2, (GH + GR) / 2, 0)).rotation.z = -s * ang;
  }
  const gable = new THREE.Shape([new THREE.Vector2(-GW, 0.5), new THREE.Vector2(GW, 0.5), new THREE.Vector2(GW, GH), new THREE.Vector2(0, GR), new THREE.Vector2(-GW, GH)]);
  add(new THREE.ShapeGeometry(gable), V(0, 0, -GD)); add(new THREE.ShapeGeometry(gable), V(0, 0, GD)); }

// tables le long des murs
const TABLE_Y = 0.82, TABLE_X = 2.45;
for (const s of [-1, 1]) {
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.06, GD * 2 - 1.6), M.wood); top.position.set(s * TABLE_X, TABLE_Y, -0.3); top.castShadow = top.receiveShadow = true; greenhouse.add(top);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, GD * 2 - 1.6), M.woodDark); lip.position.set(s * (TABLE_X - 0.57), TABLE_Y + 0.03, -0.3); greenhouse.add(lip);
  for (let z = -GD + 1.1; z <= GD - 1.6; z += 1.6) for (const dx of [-0.5, 0.5]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, TABLE_Y, 0.06), M.woodDark); l.position.set(s * TABLE_X + dx, TABLE_Y / 2, z); l.castShadow = true; greenhouse.add(l); }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.04, GD * 2 - 1.8), M.woodDark); shelf.position.set(s * TABLE_X, 0.22, -0.3); shelf.receiveShadow = true; greenhouse.add(shelf);
}
// arrosoir et outils, pour la vie
{ const can = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0x5f87a8, roughness: 0.4, metalness: 0.5 })); body.position.y = 0.11; can.add(body);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.3, 8), body.material); spout.position.set(0.17, 0.2, 0); spout.rotation.z = -0.9; can.add(spout);
  can.position.set(0.95, 0, 3.6); can.traverse((o) => { o.castShadow = true; }); greenhouse.add(can); }

// ---------- Géométries de feuilles ----------
function leafGeo(w, l, bend = 0.1, fold = 0.35, seg = 6) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(w, l * 0.25, w * 0.9, l * 0.72, 0, l); s.bezierCurveTo(-w * 0.9, l * 0.72, -w, l * 0.25, 0, 0);
  const g = new THREE.ShapeGeometry(s, seg); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -bend * (y / l) ** 2 * l + Math.abs(x) * fold); }
  g.computeVertexNormals(); return g;
}
function heartGeo(w, l, bend = 0.08) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(w * 0.9, -l * 0.15, w * 1.1, l * 0.55, 0, l); s.bezierCurveTo(-w * 1.1, l * 0.55, -w * 0.9, -l * 0.15, 0, 0);
  const g = new THREE.ShapeGeometry(s, 8); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -bend * (y / l) ** 2 * l + Math.abs(x) * 0.25 - Math.abs(x) ** 2 * 1.2); }
  g.computeVertexNormals(); return g;
}
const GEO = {
  leaflet: leafGeo(0.03, 0.11, 0.05, 0.3, 4),
  leafMid: leafGeo(0.05, 0.16, 0.08),
  leafBig: heartGeo(0.2, 0.42, 0.12),
  heart: heartGeo(0.05, 0.08, 0.04),
  petal: leafGeo(0.022, 0.05, -0.02, 0.1, 4),
  blade: (() => { const g = new THREE.PlaneGeometry(0.018, 1, 1, 5); g.translate(0, 0.5, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y * 0.85)); p.setZ(i, -0.25 * y * y); } g.computeVertexNormals(); return g; })(),
  succ: (() => { const g = new THREE.SphereGeometry(0.5, 10, 8); g.translate(0, 0, 0.5); return g; })(),
  blob: new THREE.IcosahedronGeometry(1, 1),
  ball: new THREE.IcosahedronGeometry(1, 0),
};
const pot = (() => {
  const pts = [[0, 0], [0.08, 0], [0.1, 0.02], [0.125, 0.17], [0.15, 0.175], [0.15, 0.215], [0.128, 0.215], [0.12, 0.19]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 20);
})();
const soilGeo = new THREE.CircleGeometry(0.122, 18); soilGeo.rotateX(-Math.PI / 2);
function makePot(scale = 1, mat = M.terra) { const g = new THREE.Group(); const p = new THREE.Mesh(pot, mat); p.castShadow = p.receiveShadow = true; g.add(p); const s = new THREE.Mesh(soilGeo, M.soil); s.position.y = 0.185; g.add(s); g.scale.setScalar(scale); return g; }

// ---------- Espèces procédurales ----------
const GREENS = ['#4f8a4a', '#5fae6d', '#3f7a46', '#6c9a52', '#7aa35e', '#2f6b48'];
function inst(geo, mat, n) { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; m.instanceMatrix.setUsage(THREE.StaticDrawUsage); return m; }
function tube(points, r, mat = M.stem, seg = 12) { const c = new THREE.CatmullRomCurve3(points); const m = new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, 5, false), mat); m.castShadow = true; return { mesh: m, curve: c }; }

function fern(rng, size) {
  const g = new THREE.Group(), n = 8 + Math.floor(rng() * 5), per = 20, im = inst(GEO.leaflet, M.leaf, n * per * 2); let k = 0;
  const base = col(GREENS[Math.floor(rng() * 3)]);
  for (let f = 0; f < n; f++) {
    const a = (f / n) * Math.PI * 2 + rng() * 0.4, tilt = 0.35 + rng() * 0.6, L = size * (0.45 + rng() * 0.3), droop = 0.5 + rng() * 0.4;
    const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; const rr = Math.sin(tilt) * t * L + t * t * L * 0.25; pts.push(new THREE.Vector3(Math.cos(a) * rr, Math.cos(tilt) * t * L - droop * t * t * L * 0.6, Math.sin(a) * rr)); }
    const { mesh, curve } = tube(pts, 0.004 * size + 0.002); g.add(mesh);
    for (let i = 2; i < per + 2; i++) {
      const t = i / (per + 2), p = curve.getPoint(t), tan = curve.getTangent(t), side = new THREE.Vector3().crossVectors(tan, UP).normalize(), sz = (1 - t) * 1.25 + 0.25;
      for (const s of [-1, 1]) {
        const dir = side.clone().multiplyScalar(s).addScaledVector(tan, 0.55).normalize();
        dummy.position.copy(p); dummy.quaternion.setFromUnitVectors(UP, dir); dummy.rotateY(s * 1.2); dummy.scale.setScalar(sz * size * 1.4); dummy.updateMatrix();
        im.setMatrixAt(k, dummy.matrix); im.setColorAt(k, vary(base, rng, 0.06).offsetHSL(0, 0, t * 0.06)); k++;
      }
    }
  }
  im.count = k; g.add(im); return g;
}
function succulent(rng, size) {
  const g = new THREE.Group(), n = 26 + Math.floor(rng() * 16), im = inst(GEO.succ, M.leaf, n);
  const base = col(['#7fa98a', '#8fbf9a', '#6e9c84', '#9bb38a'][Math.floor(rng() * 4)]), tip = col(['#d68a8a', '#c9a06a', '#b98bb0'][Math.floor(rng() * 3)]);
  for (let i = 0; i < n; i++) {
    const t = i / n, a = i * 2.39996, tilt = lerp(1.25, 0.18, t) + (rng() - 0.5) * 0.1, len = lerp(0.07, 0.2, t) * size * 2.2;
    dummy.position.set(0, 0.01, 0); dummy.rotation.set(-tilt, a, 0, 'YXZ'); dummy.scale.set(len * 0.42, len * 0.16, len); dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, base.clone().lerp(tip, t * 0.35 + rng() * 0.1));
  }
  g.add(im); return g;
}
const FLOWERS = ['#e9c6e0', '#f4efe6', '#c7a6e8', '#f2b23d', '#f0907a', '#9ec8f0', '#e86f8a'];
function flowering(rng, size) {
  const g = new THREE.Group(), stems = 3 + Math.floor(rng() * 5), fc = col(FLOWERS[Math.floor(rng() * FLOWERS.length)]);
  const leaves = inst(GEO.leafMid, M.leaf, stems * 6), petals = inst(GEO.petal, M.leaf, stems * 7), cores = inst(GEO.ball, M.leafFlat, stems); let kl = 0, kp = 0;
  const lavender = rng() < 0.3; const spikes = lavender ? inst(GEO.ball, M.leafFlat, stems * 14) : null; let ks = 0;
  for (let s = 0; s < stems; s++) {
    const a = rng() * Math.PI * 2, r = rng() * 0.06, H = size * (0.35 + rng() * 0.3), lean = 0.05 + rng() * 0.12;
    const pts = [V(Math.cos(a) * r, 0, Math.sin(a) * r), V(Math.cos(a) * (r + lean * 0.4), H * 0.5, Math.sin(a) * (r + lean * 0.4)), V(Math.cos(a) * (r + lean), H, Math.sin(a) * (r + lean))];
    const { mesh, curve } = tube(pts, 0.0045, M.stem, 8); g.add(mesh);
    for (let i = 0; i < 3; i++) { const t = 0.15 + i * 0.22, p = curve.getPoint(t); for (const sd of [-1, 1]) { dummy.position.copy(p); dummy.rotation.set(0.9 * sd, a + i, 0.3); dummy.scale.setScalar(size * (1.1 - t)); dummy.updateMatrix(); leaves.setMatrixAt(kl, dummy.matrix); leaves.setColorAt(kl++, vary(col('#4f8a4a'), rng, 0.08)); } }
    const top = curve.getPoint(1);
    if (lavender) { for (let i = 0; i < 14; i++) { dummy.position.copy(top).add(V((rng() - 0.5) * 0.02, -i * 0.012 * size * 2, (rng() - 0.5) * 0.02)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.011 * (1 - i / 20)); dummy.updateMatrix(); spikes.setMatrixAt(ks, dummy.matrix); spikes.setColorAt(ks++, col('#9d7cc8')); } }
    else {
      for (let i = 0; i < 7; i++) { dummy.position.copy(top); dummy.rotation.set(-1.2, (i / 7) * Math.PI * 2, 0, 'YXZ'); dummy.scale.setScalar(size * 1.5); dummy.updateMatrix(); petals.setMatrixAt(kp, dummy.matrix); petals.setColorAt(kp++, vary(fc, rng, 0.06)); }
      dummy.position.copy(top).add(V(0, 0.01, 0)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.014); dummy.updateMatrix(); cores.setMatrixAt(s, dummy.matrix); cores.setColorAt(s, col('#e8b440'));
    }
  }
  leaves.count = kl; petals.count = kp; g.add(leaves); if (!lavender) { g.add(petals); g.add(cores); } else { spikes.count = ks; g.add(spikes); }
  return g;
}
function broadleaf(rng, size) {
  const g = new THREE.Group(), n = 4 + Math.floor(rng() * 4), im = inst(GEO.leafBig, M.leaf, n), base = col(['#2f6b48', '#3f7a46', '#2a5e44'][Math.floor(rng() * 3)]);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng() * 0.6, out = 0.12 + rng() * 0.18, H = size * (0.35 + rng() * 0.35);
    const pts = [V(0, 0, 0), V(Math.cos(a) * out * 0.3, H * 0.6, Math.sin(a) * out * 0.3), V(Math.cos(a) * out, H, Math.sin(a) * out)];
    const { mesh, curve } = tube(pts, 0.006, M.stem, 8); g.add(mesh);
    const tip = curve.getPoint(1), dir = V(Math.cos(a), 0.5 + rng() * 0.6, Math.sin(a)).normalize();
    dummy.position.copy(tip); dummy.quaternion.setFromUnitVectors(UP, dir); dummy.rotateY((rng() - 0.5) * 0.6); dummy.scale.setScalar(size * (0.9 + rng() * 0.4)); dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, vary(base, rng, 0.08));
  }
  g.add(im); return g;
}
function grass(rng, size) {
  const g = new THREE.Group(), n = 36 + Math.floor(rng() * 30), im = inst(GEO.blade, M.leaf, n), base = col(['#7aa35e', '#9cc46a', '#5f8f4a', '#b8c48a'][Math.floor(rng() * 4)]);
  for (let i = 0; i < n; i++) { const a = rng() * Math.PI * 2, r = rng() * 0.07; dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); dummy.rotation.set((rng() - 0.5) * 0.3, a, 0, 'YXZ'); dummy.rotateX(-0.15 - rng() * 0.35); dummy.scale.set(1 + rng(), size * (0.35 + rng() * 0.45), 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, vary(base, rng, 0.1)); }
  g.add(im); return g;
}
function aromatic(rng, size) {
  const g = new THREE.Group(), n = 70 + Math.floor(rng() * 50), im = inst(GEO.ball, M.leafFlat, n), base = col(['#6c9a52', '#7f9f6a', '#5d8a4e'][Math.floor(rng() * 3)]);
  for (let i = 0; i < n; i++) { const u = rng(), v = rng(), th = u * Math.PI * 2, ph = Math.acos(v), R = size * 0.2; dummy.position.set(Math.sin(ph) * Math.cos(th) * R, Math.cos(ph) * R * 0.9 + R * 0.35, Math.sin(ph) * Math.sin(th) * R); dummy.rotation.set(rng() * 3, rng() * 3, 0); dummy.scale.setScalar(0.012 + rng() * 0.012); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, vary(base, rng, 0.12)); }
  g.add(im); return g;
}
function bonsai(rng, size) {
  const g = new THREE.Group(), foliage = []; const base = col('#4f8a4a');
  const branch = (p, dir, len, rad, depth) => {
    const end = p.clone().addScaledVector(dir, len);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.7, rad, len, 6), M.bark); m.position.copy(p).lerp(end, 0.5); m.quaternion.setFromUnitVectors(UP, dir); m.castShadow = true; g.add(m);
    if (depth === 0) { foliage.push(end); return; }
    const k = depth > 2 ? 2 : 2 + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < k; i++) { const nd = dir.clone().add(V((rng() - 0.5) * 1.3, 0.25 + rng() * 0.4, (rng() - 0.5) * 1.3)).normalize(); branch(end, nd, len * (0.62 + rng() * 0.15), rad * 0.62, depth - 1); }
  };
  branch(V(0, 0, 0), V(0.15, 1, 0).normalize(), size * 0.32, size * 0.05, 4);
  const im = inst(GEO.blob, M.leafFlat, foliage.length * 3); let k = 0;
  for (const f of foliage) for (let j = 0; j < 3; j++) { dummy.position.copy(f).add(V((rng() - 0.5) * 0.12, (rng() - 0.2) * 0.06, (rng() - 0.5) * 0.12).multiplyScalar(size * 1.5)); dummy.rotation.set(rng(), rng(), rng()); const s = size * (0.09 + rng() * 0.06); dummy.scale.set(s * 1.3, s * 0.7, s * 1.3); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); im.setColorAt(k++, vary(base, rng, 0.14)); }
  g.add(im); return g;
}
function mushrooms(rng) {
  const g = new THREE.Group(), capM = new THREE.MeshStandardMaterial({ color: 0xc9783e, roughness: 0.7 }), stemM = new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.9 });
  for (let i = 0; i < 4 + Math.floor(rng() * 4); i++) { const h = 0.04 + rng() * 0.05, x = (rng() - 0.5) * 0.25, z = (rng() - 0.5) * 0.25; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, h, 6), stemM); st.position.set(x, h / 2, z); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.025 + rng() * 0.02, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capM); cap.position.set(x, h, z); cap.scale.y = 0.7; g.add(st, cap); }
  g.traverse((o) => { o.castShadow = true; }); return g;
}
const SPECIES = { fern, succulent, flowering, broadleaf, grass, aromatic };

// ---------- Placement ----------
const plants = []; // { obj, stage, target, phase, h }
const rngSlots = rngOf(42);
const ORDER = ['fern', 'succulent', 'flowering', 'aromatic', 'broadleaf', 'grass', 'flowering', 'succulent', 'fern', 'flowering', 'broadleaf', 'aromatic'];
const slots = [];
for (const s of [1, -1]) for (let i = 0; i < 12; i++) for (const row of [0, 1]) slots.push({ x: s * (TABLE_X - 0.25 + row * 0.45), z: GD - 2.1 - i * 0.82 + row * 0.35, y: TABLE_Y + 0.03, s, i, row });
// tri : les plus proches de l'entrée d'abord, alternance gauche / droite
slots.sort((a, b) => (a.i - b.i) || (a.row - b.row) || (a.s - b.s));
const stageOf = (i) => (i < 3 ? 0 : i < 16 ? 1 : i < 34 ? 2 : 3);
slots.forEach((sl, i) => {
  const rng = rngOf(1000 + i), sp = i < 3 ? ['flowering', 'fern', 'succulent'][i] : ORDER[Math.floor(rng() * ORDER.length)];
  const big = sp === 'broadleaf' ? 1.25 : 1, g = new THREE.Group();
  const potMat = rng() < 0.25 ? M.terraDark : M.terra; g.add(makePot((0.85 + rng() * 0.35) * big, potMat));
  const pl = SPECIES[sp](rng, 0.55 + rng() * 0.35); pl.position.y = 0.19 * (0.85 + rng() * 0.35) * big; g.add(pl);
  g.position.set(sl.x + (rng() - 0.5) * 0.08, sl.y, sl.z + (rng() - 0.5) * 0.08); g.rotation.y = rng() * Math.PI * 2;
  greenhouse.add(g); plants.push({ obj: g, plant: pl, stage: stageOf(i), phase: rng() * 10, sway: sp === 'grass' || sp === 'flowering' ? 0.05 : 0.025 });
});
// grandes potées au sol, de part et d'autre de l'allée
[[1.35, 2.6, 'broadleaf', 2], [-1.35, 1.2, 'fern', 2], [1.35, -0.8, 'grass', 3], [-1.35, -3.2, 'broadleaf', 3], [1.35, -4.4, 'fern', 3], [-1.35, 3.9, 'flowering', 1]].forEach(([x, z, sp, st], i) => {
  const rng = rngOf(500 + i), g = new THREE.Group(); g.add(makePot(2.1, M.terraDark)); const pl = SPECIES[sp](rng, sp === 'broadleaf' ? 0.95 : 1.2); pl.position.y = 0.42; g.add(pl);
  g.position.set(x, 0, z); g.rotation.y = rng() * 6; greenhouse.add(g); plants.push({ obj: g, plant: pl, stage: st, phase: rng() * 10, sway: 0.02 });
});
// bonsaï sur un socle au fond (un objectif = un bonsaï ; ses branches = les étapes)
{ const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.7, 20), M.stone); ped.position.set(0, 0.35, -GD + 0.9); ped.castShadow = ped.receiveShadow = true; greenhouse.add(ped);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.4), M.terraDark); tray.position.set(0, 0.74, -GD + 0.9); greenhouse.add(tray);
  const b = bonsai(rngOf(77), 1.3); b.position.set(0, 0.78, -GD + 0.9); greenhouse.add(b); plants.push({ obj: b, plant: b, stage: 2, phase: 1, sway: 0.006 }); }
// suspensions
const hanging = [];
[[-1.0, -2.6], [1.0, -0.2], [-1.0, 2.2], [1.0, 4.2]].forEach(([x, z], i) => {
  const rng = rngOf(900 + i), g = new THREE.Group(), topY = GR - Math.abs(x) * (GR - GH) / GW;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.terra); bowl.castShadow = true; g.add(bowl);
  const y0 = 2.05; for (let c = 0; c < 3; c++) { const a = (c / 3) * Math.PI * 2; const p = V(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15), q = V(0, topY - y0, 0); const d = q.clone().sub(p); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, d.length(), 4), M.chain); m.position.copy(p).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); g.add(m); }
  const strands = 9, im = inst(GEO.heart, M.leaf, strands * 16); let k = 0;
  for (let s = 0; s < strands; s++) {
    const a = (s / strands) * Math.PI * 2 + rng() * 0.3, L = 0.5 + rng() * 0.6;
    const pts = [V(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12), V(Math.cos(a) * 0.24, -L * 0.3, Math.sin(a) * 0.24), V(Math.cos(a) * 0.2, -L, Math.sin(a) * 0.2)];
    const { mesh, curve } = tube(pts, 0.003, M.stem, 10); g.add(mesh);
    for (let i = 0; i < 16; i++) { const t = i / 16, p = curve.getPoint(t); dummy.position.copy(p); dummy.rotation.set(Math.PI * (0.5 + rng() * 0.5), a + (i % 2 ? 1 : -1) * 0.9, 0, 'YXZ'); dummy.scale.setScalar(1 + rng() * 0.6); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); im.setColorAt(k++, vary(col('#5fae6d'), rng, 0.1)); }
  }
  g.add(im); g.position.set(x, y0, z); greenhouse.add(g); hanging.push(g); plants.push({ obj: g, plant: g, stage: i < 2 ? 2 : 3, phase: rng() * 10, sway: 0.03, hang: true });
});
// grimpantes le long des poteaux puis sous le toit
const vines = [];
[[GW - 0.08, -GD + (2 * GD) / bays * 2], [-GW + 0.08, -GD + (2 * GD) / bays * 4], [GW - 0.08, -GD + (2 * GD) / bays * 6], [-GW + 0.08, -GD + (2 * GD) / bays * 8]].forEach(([x, z], i) => {
  const rng = rngOf(300 + i), s = Math.sign(x), pts = [];
  for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(V(x - s * 0.04 * Math.sin(t * 9), 0.5 + t * (GH - 0.5), z + 0.05 * Math.cos(t * 7))); }
  for (let k = 1; k <= 10; k++) { const t = k / 10; pts.push(V(lerp(x, s * 0.4, t) - s * 0.05, lerp(GH, GR - (GR - GH) * 0.4 / GW, t) - 0.08 + 0.04 * Math.sin(t * 8), z + 0.06 * Math.sin(t * 6))); }
  const curve = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(curve, 120, 0.012, 5, false), mesh = new THREE.Mesh(geo, M.stem); mesh.castShadow = true;
  const n = 140, im = inst(GEO.heart, M.leaf, n);
  for (let k = 0; k < n; k++) { const t = k / n, p = curve.getPoint(t), tan = curve.getTangent(t); const side = new THREE.Vector3().crossVectors(tan, V(s, 0, 0)).normalize(); dummy.position.copy(p).addScaledVector(side, (k % 2 ? 1 : -1) * 0.02); dummy.quaternion.setFromUnitVectors(UP, V(-s, 0.6 + rng() * 0.4, (rng() - 0.5)).normalize()); dummy.rotateY((rng() - 0.5) * 1.2); dummy.scale.setScalar(1.6 + rng() * 1.6); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); im.setColorAt(k, vary(col('#4f8a4a'), rng, 0.12)); }
  greenhouse.add(mesh, im); vines.push({ mesh, im, n, idx: geo.index.count, cur: 0, target: 0 });
});
// mousses : sur la terre des pots, au pied des tables, entre les dalles
const moss = (() => {
  const r = rngOf(5), n = 1400, im = new THREE.InstancedMesh(GEO.blob, M.leafFlat, n); im.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    let x, y = 0, z;
    if (i % 3 === 0) { const s = r() < 0.5 ? -1 : 1; x = s * (GW - 0.15 - r() * 0.5); z = (r() - 0.5) * GD * 1.9; }
    else if (i % 3 === 1) { x = (r() < 0.5 ? -1 : 1) * (0.62 + r() * 0.35); z = (r() - 0.5) * GD * 1.9; }
    else { x = (r() - 0.5) * 1.2; z = GD - 0.2 - Math.floor(r() * 34) * 0.39 + 0.18; }
    dummy.position.set(x, y, z); dummy.rotation.set(0, r() * 6, 0); const s = 0.012 + r() * 0.03; dummy.scale.set(s * 1.5, s * 0.55, s * 1.5); dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, vary(col(r() < 0.15 ? '#7f9a4a' : r() < 0.5 ? '#3f6a35' : '#4f7a3a'), r, 0.12));
  }
  im.count = 0; greenhouse.add(im); return { im, n, cur: 0, target: 0 };
})();
const shrooms = []; [[-0.85, 3.9], [0.9, 1.0], [-0.95, -1.8], [0.8, -4.9]].forEach(([x, z], i) => { const m = mushrooms(rngOf(60 + i)); m.position.set(x, 0, z); m.visible = false; greenhouse.add(m); shrooms.push(m); });

// ---------- Lanternes et lucioles ----------
const lanterns = [];
for (const z of [-3.6, 0, 3.6]) {
  const g = new THREE.Group(); const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.22, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2116, metalness: 0.6, roughness: 0.5, wireframe: true })); g.add(cage);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.08, 6), M.chain); cap.position.y = 0.15; g.add(cap);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.bulb); g.add(bulb);
  const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, GR - 2.75, 4), M.chain); ch.position.y = (GR - 2.75) / 2 + 0.15; g.add(ch);
  const light = new THREE.PointLight(0xffb85c, 9, 10, 1.5); g.add(light);
  g.position.set(0, 2.75, z); greenhouse.add(g); lanterns.push({ g, light });
}
const flies = (() => {
  const n = 90, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seed = []; const r = rngOf(9);
  for (let i = 0; i < n; i++) seed.push([(r() - 0.5) * GW * 1.6, 0.4 + r() * 2.2, (r() - 0.5) * GD * 1.8, r() * 10, 0.2 + r() * 0.5]);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,230,160,1)'); gr.addColorStop(0.3, 'rgba(242,178,61,.6)'); gr.addColorStop(1, 'rgba(242,178,61,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const mat = new THREE.PointsMaterial({ size: 0.12, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const pts = new THREE.Points(geo, mat); scene.add(pts); return { pts, seed, pos, mat, n };
})();

// ---------- Ernest ----------
const ernest = (() => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  sp.scale.set(0.74, 0.77, 1); sp.position.set(0.42, 0.4, 1.4); scene.add(sp);
  const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 460; c.height = 480; c.getContext('2d').drawImage(img, 0, 0, 460, 480); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; sp.material.map = t; sp.material.needsUpdate = true; };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ernestSvg('lanterne').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  // ombre au sol
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(0.42, 0.02, 1.4); sh.scale.setScalar(0.9); scene.add(sh);
  return sp;
})();

// ---------- Ambiances ----------
const TIMES = {
  day: { top: '#7fb8d6', bottom: '#d9e6c8', fog: '#bcd6d0', hemiSky: '#cfe8f2', hemiGround: '#5b4a30', hemi: 1.15, sun: '#fff1d6', sunI: 2.6, sunPos: [6, 10, 5], lantern: 0.6, flies: 0, stars: 0, moon: 0, exposure: 1.0 },
  dusk: { top: '#2a3a5c', bottom: '#e0956a', fog: '#6b5a5a', hemiSky: '#e0a080', hemiGround: '#3a2a1a', hemi: 0.7, sun: '#ffb070', sunI: 1.4, sunPos: [-9, 3.5, 2], lantern: 4, flies: 0.5, stars: 0.3, moon: 0.4, exposure: 1.05 },
  night: { top: '#071321', bottom: '#122a2a', fog: '#08131c', hemiSky: '#34507a', hemiGround: '#12201a', hemi: 0.6, sun: '#9fb8e0', sunI: 0.45, sunPos: [-6, 9, -6], lantern: 7, flies: 1, stars: 1, moon: 1, exposure: 1.1 },
};
let timeKey = 'night', mood = 3, stage = 2;
const amb = { cur: null };
function applyTime(k, instant = false) { timeKey = k; amb.to = TIMES[k]; if (instant || !amb.cur) amb.cur = JSON.parse(JSON.stringify(amb.to)); }
function updateAmbience(dt) {
  const a = amb.cur, b = amb.to, t = Math.min(1, dt * 2.5);
  for (const key of Object.keys(b)) { if (typeof b[key] === 'number') a[key] = lerp(a[key], b[key], t); else if (Array.isArray(b[key])) a[key] = a[key].map((v, i) => lerp(v, b[key][i], t)); else a[key] = '#' + col(a[key]).lerp(col(b[key]), t).getHexString(); }
  const m = 0.75 + mood * 0.09; // humeur : 0,75 → 1,11
  skyMat.uniforms.top.value.set(a.top); skyMat.uniforms.bottom.value.set(a.bottom); scene.fog.color.set(a.fog);
  hemi.color.set(a.hemiSky); hemi.groundColor.set(a.hemiGround); hemi.intensity = a.hemi * m;
  sun.color.set(a.sun); sun.intensity = a.sunI * m; sun.position.set(...a.sunPos);
  for (const l of lanterns) l.light.intensity = a.lantern * (0.8 + mood * 0.08) * (0.95 + Math.sin(clock.elapsedTime * 7 + l.g.position.z) * 0.03);
  M.bulb.emissiveIntensity = 0.4 + a.lantern * 0.3;
  flies.mat.opacity = a.flies; stars.material.opacity = a.stars * 0.85; moon.material.opacity = a.moon; moon.material.transparent = true; moon.visible = a.moon > 0.02;
  renderer.toneMappingExposure = a.exposure * (0.9 + mood * 0.04);
  document.querySelector('meta[name=theme-color]').content = a.fog;
}

// ---------- Stades de croissance ----------
const STAGE = [{ vine: 0, moss: 0, shroom: false }, { vine: 0.22, moss: 220, shroom: false }, { vine: 0.62, moss: 700, shroom: false }, { vine: 1, moss: 1400, shroom: true }];
function applyStage(s) {
  stage = s;
  for (const p of plants) { p.target = p.stage <= s ? 1 : 0; if (p.cur === undefined) p.cur = p.target; }
  vines.forEach((v, i) => { v.target = Math.max(0, STAGE[s].vine - i * 0.08); });
  moss.target = STAGE[s].moss;
  shrooms.forEach((m) => { m.visible = STAGE[s].shroom; });
}
function updateGrowth(dt, t) {
  const k = Math.min(1, dt * 2.2);
  for (const p of plants) {
    p.cur = lerp(p.cur, p.target, k); const e = p.cur < 0.002 ? 0 : p.cur;
    p.obj.visible = e > 0.01;
    if (p.hang) p.obj.scale.setScalar(Math.max(0.001, e)); else p.plant.scale.setScalar(Math.max(0.001, e));
    // l'air bouge
    const w = Math.sin(t * 1.3 + p.phase) * p.sway + Math.sin(t * 2.7 + p.phase * 2) * p.sway * 0.4;
    if (p.hang) { p.obj.rotation.z = w * 0.5; p.obj.rotation.x = w * 0.3; } else { p.plant.rotation.z = w; p.plant.rotation.x = w * 0.6; }
  }
  for (const v of vines) { v.cur = lerp(v.cur, v.target, k); const tri = Math.floor((v.idx / 3) * v.cur) * 3; v.mesh.geometry.setDrawRange(0, tri); v.im.count = Math.floor(v.n * v.cur); v.mesh.visible = v.cur > 0.01; }
  moss.cur = lerp(moss.cur, moss.target, k); moss.im.count = Math.round(moss.cur);
}

// ---------- Boucle ----------
const clock = new THREE.Clock(); let frames = 0, fpsT = 0; const fpsEl = document.getElementById('fps');
function tick() {
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  controls.update(); updateAmbience(dt); updateGrowth(dt, t);
  for (let i = 0; i < flies.n; i++) { const [x, y, z, ph, sp] = flies.seed[i]; flies.pos[i * 3] = x + Math.sin(t * sp + ph) * 0.5; flies.pos[i * 3 + 1] = y + Math.sin(t * sp * 1.7 + ph * 2) * 0.25; flies.pos[i * 3 + 2] = z + Math.cos(t * sp * 0.8 + ph) * 0.5; }
  flies.pts.geometry.attributes.position.needsUpdate = true;
  ernest.position.y = 0.4 + Math.sin(t * 1.6) * 0.012;
  renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 1) { fpsEl.textContent = `${Math.round(frames / fpsT)} i/s`; frames = 0; fpsT = 0; }
  requestAnimationFrame(tick);
}

// ---------- Interface ----------
document.querySelectorAll('#stages button').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('#stages button').forEach((x) => x.classList.toggle('on', x === b)); applyStage(Number(b.dataset.s)); }));
document.querySelectorAll('#time button').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('#time button').forEach((x) => x.classList.toggle('on', x === b)); applyTime(b.dataset.t); }));
document.getElementById('mood').addEventListener('input', (e) => { mood = Number(e.target.value); });
window.addEventListener('resize', () => { camera.aspect = W() / H(); camera.updateProjectionMatrix(); renderer.setSize(W(), H()); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') clock.getDelta(); });
// heure réelle au démarrage
{ const h = new Date().getHours(); const k = h >= 8 && h < 18 ? 'day' : h >= 18 && h < 21 ? 'dusk' : 'night'; document.querySelectorAll('#time button').forEach((x) => x.classList.toggle('on', x.dataset.t === k)); applyTime(k, true); }
applyStage(2);
document.getElementById('loading').remove();
window.__serre = { applyStage, applyTime, camera, controls, setMood: (m) => { mood = m; }, debug: () => JSON.stringify({ stage, sample: plants.slice(0, 8).map((p) => [p.stage, p.target, +p.cur.toFixed(3), p.obj.visible]) }) };
tick();
