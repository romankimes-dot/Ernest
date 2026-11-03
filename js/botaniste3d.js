// Maquette : les trois serres (Bien-être, Travail, Vie perso), de vides à accomplies (docs/PROGRESSION.md).
// Une grande serre de botaniste : établis de pépinière près de la porte (les jeunes pots), puis le plan fixe :
// massif d'aromatiques, rocaille, trois géantes au fond, lianes sur les arceaux, suspensions tombantes, décors troqués.
// Un curseur p (0..1) rejoue une année : chaque espèce est débloquée, semée en pot, rempotée en pleine terre
// dans son emplacement du plan, puis grandit. Tout est généré par code et rendu en instances (peu d'appels de dessin).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createErnest } from './ernest3d.js';

// ---------- Outils ----------
const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const col = (h) => new THREE.Color(h);
const UP = V(0, 1, 0);
const vary = (hex, r, amt = 0.08) => { const c = col(hex), h = {}; c.getHSL(h); c.setHSL(h.h + (r() - 0.5) * amt * 0.4, clamp01(h.s + (r() - 0.5) * amt), clamp01(h.l + (r() - 0.5) * amt)); return c; };
function merge(geos) {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    if (!parts.every((g) => g.attributes[name])) continue;
    const n = parts.reduce((a, g) => a + g.attributes[name].array.length, 0), arr = new Float32Array(n); let o = 0;
    for (const g of parts) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, parts[0].attributes[name].itemSize));
  }
  return out;
}
const along = (geo, a, b, r) => { // cylindre unitaire posé de a à b
  const d = b.clone().sub(a), g = geo.clone(); g.scale(r, d.length(), r); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())); g.translate(a.x, a.y, a.z); return g;
};

// ---------- Géométries des végétaux (origine au pétiole, la feuille s'étend vers +Z) ----------
function leafGeo(w, l, { bend = 0.15, fold = 0.25, seg = 7, round = 0.8, tip = 1 } = {}) {
  const p = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, wd = w * Math.pow(Math.sin(Math.PI * Math.pow(t, tip)), round) * (t < 0.06 ? 0.3 : 1), y = -bend * t * t * l;
    p.push(-wd, y - fold * wd * 0.4, t * l, 0, y + fold * wd * 0.2, t * l, wd, y - fold * wd * 0.4, t * l);
  }
  for (let i = 0; i < seg; i++) { const a = i * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function monsteraGeo() { // cœur à fentes profondes depuis le bord, trous le long de la nervure, bords relevés
  const s = new THREE.Shape(), N = 260, SL = [0.42, 0.66, 0.9, 1.14, 1.38, 1.62, 1.86, 2.1, 2.34];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2 - Math.PI / 2; let d = Math.abs(((a - Math.PI / 2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI); d = Math.PI - d; // 0 à la pointe, π au pétiole
    let r = 0.5 * (1 - 0.16 * Math.cos(a + Math.PI / 2)) * (1 - 0.34 * Math.pow(Math.max(0, Math.cos(a + Math.PI / 2)), 40));
    for (const c of SL) { const k = Math.abs(d - c) / 0.028; if (k < 1) r *= (c < 0.6 ? 0.62 : 0.38) + (1 - (c < 0.6 ? 0.62 : 0.38)) * k * k; }
    const x = Math.cos(a) * r * 0.96, y = Math.sin(a) * r + 0.5; i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  for (let k = 0; k < SL.length - 1; k++) { const m = (SL[k] + SL[k + 1]) / 2; if (m < 0.8 || m > 2.2) continue; for (const sd of [-1, 1]) { const a = Math.PI / 2 + sd * m, x = Math.cos(a) * 0.2, y = Math.sin(a) * 0.2 + 0.5, h = new THREE.Path(); h.absellipse(x, y, 0.018, 0.04, 0, Math.PI * 2, false, a); s.holes.push(h); } }
  const g = new THREE.ShapeGeometry(s, 4); g.rotateX(-Math.PI / 2); g.scale(1, 1, -1);
  const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i), x = pos.getX(i); pos.setY(i, -0.3 * z * z - 0.1 * x * x + 0.12 * Math.abs(x)); }
  g.computeVertexNormals(); return g;
}
function frondGeo(n = 22) { // fougère : rachis courbé, folioles de chaque côté, plus courtes vers la pointe
  const p = [];
  const at = (t) => V(0, 0.35 * t - 0.75 * t * t, t);
  for (let i = 1; i < n; i++) {
    const t = i / n, c = at(t), L = 0.16 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) + 0.02, d = 0.5 / n;
    for (const s of [-1, 1]) { const tip = c.clone().add(V(s * L, -0.03, L * 0.35)); p.push(c.x, c.y, c.z - d, tip.x, tip.y, tip.z, c.x, c.y, c.z + d); }
    const nx = at(t + 1 / n); p.push(c.x - 0.004, c.y, c.z, nx.x + 0.004, nx.y, nx.z, nx.x - 0.004, nx.y, nx.z);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
}
function petalsGeo(n = 5, r = 1, w = 0.42) {
  const s = new THREE.Shape(); const N = n * 12;
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2, k = Math.pow(Math.abs(Math.cos((a * n) / 2)), w), rr = r * (0.18 + 0.82 * k); i ? s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, 0.12 * (x * x + z * z)); } g.computeVertexNormals(); return g;
}
const stemG = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); stemG.translate(0, 0.5, 0);
const aloeG = new THREE.ConeGeometry(0.06, 0.55, 5, 3); aloeG.translate(0, 0.275, 0); aloeG.scale(1, 1, 0.45);
const ballG = new THREE.IcosahedronGeometry(1, 1);
const POT_PROFILE = [V(0, 0), V(0.11, 0), V(0.125, 0.02), V(0.16, 0.2), V(0.18, 0.21), V(0.18, 0.25), V(0.0, 0.25)].map((v) => new THREE.Vector2(v.x, v.y));
const potG = new THREE.LatheGeometry(POT_PROFILE, 14);

// ---------- Matériaux ----------
// Feuillage : une part de la couleur propre ajoutée en émissif (lumière qui traverse la feuille), réglée selon l'heure.
const LEAF_GLOW = { value: 0.22 };
function translucent(m) { m.onBeforeCompile = (sh) => { sh.uniforms.glow = LEAF_GLOW; sh.fragmentShader = 'uniform float glow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * glow;'); }; return m; }
const M = {
  leaf: translucent(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, side: THREE.DoubleSide })),
  waxy: translucent(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, side: THREE.DoubleSide })),
  petal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, side: THREE.DoubleSide, emissive: 0x000000 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 }),
  terra: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 }),
  iron: new THREE.MeshStandardMaterial({ color: 0x24382f, roughness: 0.45, metalness: 0.55 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xd9efe6, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  brick: new THREE.MeshStandardMaterial({ color: 0x8a4a35, roughness: 0.9 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x3a2a1d, roughness: 1 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xc67a48, roughness: 0.32, metalness: 0.85 }),
  water: new THREE.MeshStandardMaterial({ color: 0x3d6d72, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.82 }),
  lamp: new THREE.MeshStandardMaterial({ color: 0xffd79a, emissive: 0xffb257, emissiveIntensity: 0, roughness: 0.4 }),
};

// ---------- Réserves d'instances : chaque végétal pousse des « pièces » dans ces réserves ----------
const POOLS = {
  leaf: [leafGeo(0.5, 1), M.leaf], ivy: [leafGeo(0.55, 0.7, { round: 0.5, tip: 0.7, bend: 0.05 }), M.waxy], round: [leafGeo(0.5, 0.8, { round: 0.35, tip: 0.6, bend: 0.02, fold: 0.05 }), M.leaf],
  needle: [leafGeo(0.18, 1, { bend: 0.05, fold: 0, seg: 3 }), M.leaf], monstera: [monsteraGeo(), M.waxy], frond: [frondGeo(), M.leaf], aloe: [aloeG, M.waxy], paddle: [leafGeo(0.26, 1, { round: 0.55, bend: 0.12, fold: 0.2 }), M.waxy],
  stem: [stemG, M.wood], petal5: [petalsGeo(5), M.petal], daisy: [petalsGeo(14, 1, 0.9), M.petal], star: [petalsGeo(5, 1, 0.15), M.petal],
  ball: [ballG, M.waxy], pot: [potG, M.terra], stone: [new THREE.DodecahedronGeometry(1, 0), M.stone], moss: [new THREE.IcosahedronGeometry(1, 0), M.leaf],
};
const pools = {};

// Une pièce : matrice locale (dans le repère de la plante), couleur, seuil d'apparition a (sur la croissance 0..1).
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(), _e = new THREE.Euler();
function part(list, pool, pos, rot, scale, color, a = 0) {
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2], 'YXZ')); _s.set(...(Array.isArray(scale) ? scale : [scale, scale, scale]));
  list.push({ pool, m: new THREE.Matrix4().compose(pos.clone(), _q.clone(), _s.clone()), c: color, a });
}
function stemPart(list, a, b, r, color, at = 0, pool = 'stem') {
  const d = b.clone().sub(a), L = d.length(); _q.setFromUnitVectors(UP, d.normalize());
  list.push({ pool, m: new THREE.Matrix4().compose(a.clone(), _q.clone(), V(r, L, r)), c: color, a: at });
}
// Feuille orientée par un azimut (yaw) et une inclinaison (pitch, 0 = horizontale, positif = vers le haut).
const leafAt = (list, pool, pos, yaw, pitch, s, c, a, roll = 0) => part(list, pool, pos, [-pitch, yaw, roll], s, c, a);

// ---------- Espèces : générateurs (rng) → pièces de la plante adulte ----------
const yawTo = (dx, dz) => Math.atan2(dx, dz);
const pickc = (c, r) => (Array.isArray(c) ? c[Math.floor(r() * c.length)] : c);
const G = {
  thym(r) { const L = []; for (let i = 0; i < 64; i++) { const y = r() * 6.28, d = 0.03 + r() * 0.2, h = 0.08 + r() * 0.18, a = d / 0.25, b = V(Math.cos(y) * d * 0.4, 0, Math.sin(y) * d * 0.4), t = V(Math.cos(y) * d, h, Math.sin(y) * d); stemPart(L, b, t, 0.004, vary('#6d7a4a', r), a * 0.6);
    for (let k = 0; k < 8; k++) { const p = b.clone().lerp(t, 0.25 + k * 0.1); leafAt(L, 'leaf', p, r() * 6.28, 0.2 + r() * 0.6, 0.04, vary('#7d9a5e', r, 0.12), a * 0.6 + 0.1); }
    if (r() < 0.6) for (let k = 0; k < 3; k++) part(L, 'petal5', t.clone().add(V((r() - 0.5) * 0.02, -k * 0.012, (r() - 0.5) * 0.02)), [0, r() * 6, 0], 0.013, vary('#c7a6d8', r), 0.85); } return L; },
  basilic(r) { const L = []; for (let s = 0; s < 8; s++) { const y = s * 0.79 + r() * 0.4, lean = 0.15 + r() * 0.25, top = V(Math.cos(y) * lean * 0.5, 0.3 + r() * 0.14, Math.sin(y) * lean * 0.5); stemPart(L, V(), top, 0.008, vary('#5d8c3a', r), s * 0.05);
    for (let k = 0; k < 6; k++) { const t = 0.2 + k * 0.15, p = V().lerp(top, t); for (const side of [0, Math.PI]) leafAt(L, 'round', p, y + side + k * 1.57, 0.25 - k * 0.04, 0.12 - k * 0.012, vary('#4f9a35', r, 0.1), t * 0.7 + s * 0.03); } } return L; },
  romarin(r) { const L = []; for (let s = 0; s < 22; s++) { const y = r() * 6.28, lean = r() * 0.28, h = 0.35 + r() * 0.3, top = V(Math.cos(y) * lean, h, Math.sin(y) * lean), a = r() * 0.5; stemPart(L, V(Math.cos(y) * 0.03, 0, Math.sin(y) * 0.03), top, 0.006, vary('#6a7050', r), a);
    for (let k = 0; k < 16; k++) { const p = V().lerp(top, 0.15 + k * 0.053); leafAt(L, 'needle', p, r() * 6.28, 0.5 + r() * 0.5, 0.075, vary('#5e7d62', r, 0.08), a + k * 0.02); }
    if (r() < 0.6) for (let k = 0; k < 3; k++) part(L, 'petal5', V().lerp(top, 0.7 + k * 0.1).add(V(0.01, 0, 0)), [0.4, r() * 6, 0], 0.014, vary('#8fa8e0', r), 0.88); } return L; },
  camomille(r) { const L = []; for (let s = 0; s < 52; s++) { const y = r() * 6.28, d = r() * 0.2, h = 0.18 + r() * 0.22, b = V(Math.cos(y) * d * 0.3, 0, Math.sin(y) * d * 0.3), t = V(Math.cos(y) * d, h, Math.sin(y) * d), a = r() * 0.5; stemPart(L, b, t, 0.0035, vary('#6f9a4a', r), a);
    for (let k = 0; k < 3; k++) leafAt(L, 'needle', b.clone().lerp(t, 0.2 + k * 0.2), r() * 6, 0.3, 0.07, vary('#7aa255', r), a); if (r() < 0.8) { part(L, 'daisy', t, [0, r() * 6, 0], 0.024, vary('#f6f3ea', r, 0.03), 0.65 + r() * 0.3); part(L, 'ball', t.clone().add(V(0, 0.004, 0)), [0, 0, 0], [0.008, 0.005, 0.008], col('#e8b52a'), 0.7); } } return L; },
  aloes(r) { const L = []; const n = 13; for (let i = 0; i < n; i++) { const y = i * 2.4 + r() * 0.3, ring = i / n; part(L, 'aloe', V(), [-(0.25 + ring * 0.9), y, 0], [1, 0.7 + (1 - ring) * 0.6, 1], vary('#6f9b84', r, 0.08), ring * 0.6); }
    for (let i = 0; i < 2; i++) { const y = r() * 6, d = 0.12 + r() * 0.08; part(L, 'aloe', V(Math.cos(y) * d, 0, Math.sin(y) * d), [-0.4, y, 0], 0.45, vary('#7aa58c', r), 0.85); } return L; },
  // Fleurs en touffe : tiges, quelques feuilles, une fleur (ou un épi) en tête.
  touffe(r, o) { const L = [];
    for (let s = 0; s < o.n; s++) { const y = r() * 6.28, d = r() * o.spread, h = o.h * (0.6 + r() * 0.5), b = V(Math.cos(y) * d * 0.3, 0, Math.sin(y) * d * 0.3), t = V(Math.cos(y) * d, h, Math.sin(y) * d), a = r() * 0.5;
      stemPart(L, b, t, o.sr || 0.004, vary(o.stemC || '#5f8a3c', r), a);
      for (let k = 0; k < (o.leafN ?? 2); k++) leafAt(L, o.leaf || 'leaf', b.clone().lerp(t, 0.1 + k * 0.2), r() * 6.28, o.leafPitch ?? 0.4, o.leafS * (0.8 + r() * 0.4), vary(o.leafC, r, 0.1), a + 0.05);
      if (r() < (o.fp ?? 0.8)) {
        if (o.spike) for (let k = 0; k < 9; k++) part(L, o.fpool || 'petal5', b.clone().lerp(t, 0.68 + k * 0.04).add(V((r() - 0.5) * 0.012, 0, (r() - 0.5) * 0.012)), [r(), r() * 6, 0], o.fs * (1 - k * 0.05), vary(pickc(o.fc, r), r, 0.06), 0.7 + k * 0.02);
        else { part(L, o.fpool || 'petal5', t, [o.ftilt ?? 0, r() * 6, 0], o.fs * (0.85 + r() * 0.3), vary(pickc(o.fc, r), r, 0.06), 0.65 + r() * 0.3); if (o.center) part(L, 'ball', t.clone().add(V(0, 0.004, 0)), [0, 0, 0], [o.fs * 0.3, o.fs * 0.2, o.fs * 0.3], col(o.center), 0.7); }
      } }
    for (let i = 0; i < (o.sword || 0); i++) part(L, 'aloe', V(), [-(0.05 + r() * 0.25), r() * 6.28, 0], [0.5, 0.9 + r() * 0.5, 0.4], vary(o.leafC, r), r() * 0.4);
    return L; },
  rosette(r, o) { const L = []; for (let i = 0; i < o.n; i++) { const y = i * 2.4 + r() * 0.3, ring = i / o.n; part(L, 'aloe', V((r() - 0.5) * 0.06, 0, (r() - 0.5) * 0.06), [-(o.tilt0 + ring * o.tilt), y, 0], [o.w ?? 1, (o.len ?? 1) * (0.7 + (1 - ring) * 0.6), o.d ?? 1], vary(r() < 0.5 ? o.c : o.c2 || o.c, r, 0.06), ring * 0.6); } return L; },
  herbes(r, o) { const L = []; for (let i = 0; i < o.n; i++) { const y = r() * 6.28, d = r() * 0.1, h = o.h * (0.6 + r() * 0.6); part(L, 'needle', V(Math.cos(y) * d, 0, Math.sin(y) * d), [-(1.0 + r() * 0.45), y, 0], [h * 0.22, h, h], vary(o.c, r, 0.1), r() * 0.5); }
    for (let i = 0; i < o.plumes; i++) { const y = r() * 6.28, d = 0.05 + r() * 0.12, t = V(Math.cos(y) * d, o.h * (1 + r() * 0.3), Math.sin(y) * d); stemPart(L, V(), t, 0.003, vary('#b8a878', r), 0.6); part(L, 'ball', t, [0, 0, 0], [0.02, 0.08, 0.02], vary(o.pc, r, 0.08), 0.75); } return L; },
  // Buisson de grandes feuilles sur pétioles, avec des têtes de fleurs facultatives (hortensia).
  buisson(r, o) { const L = [];
    for (let i = 0; i < o.n; i++) { const y = r() * 6.28, len = o.h * (0.5 + r() * 0.6), lean = 0.25 + r() * 0.35, top = V(Math.cos(y) * lean * len, len, Math.sin(y) * lean * len), a = (i / o.n) * 0.7;
      stemPart(L, V(), top, o.sr || 0.006, vary(o.sc || '#5a7a3a', r), a); leafAt(L, o.leaf, top, yawTo(top.x, top.z) + (r() - 0.5) * 0.5, o.pitch + (r() - 0.5) * 0.4, o.ls * (0.8 + r() * 0.4), vary(pickc(o.lc, r), r, 0.08), a + 0.05); }
    for (let i = 0; i < (o.heads || 0); i++) { const y = r() * 6.28, R = o.hr * (0.4 + r() * 0.6), c = V(Math.cos(y) * R, o.h * (0.85 + r() * 0.3), Math.sin(y) * R), hc = pickc(o.hc, r);
      for (let k = 0; k < o.fl; k++) { const u = r() * 6.28, v = Math.acos(1 - r() * 1.4), dir = V(Math.sin(v) * Math.cos(u), Math.cos(v), Math.sin(v) * Math.sin(u)); part(L, 'petal5', c.clone().addScaledVector(dir, o.hs), [v, yawTo(dir.x, dir.z), 0], o.fs, vary(hc, r, 0.08), 0.8 + r() * 0.15); } }
    return L; },
  fougere(r, big = true) { const L = [], H = big ? 2.1 : 0.0; let p = V();
    if (big) for (let i = 0; i < 14; i++) { const n = p.clone().add(V(Math.sin(i * 0.5) * 0.02, H / 14, Math.cos(i * 0.4) * 0.015)); stemPart(L, p, n, 0.09 - i * 0.003, vary('#4a3a2a', r, 0.05), i / 14 * 0.7); p = n; }
    const crown = p.clone(); for (let i = 0; i < 16; i++) { const y = i * 2.4, pitch = 0.5 - (i % 3) * 0.25; leafAt(L, 'frond', crown, y, pitch, big ? 1.5 + r() * 0.3 : 0.5, vary('#4f8d3e', r, 0.1), 0.4 + (i / 16) * 0.5); }
    if (big) for (let i = 0; i < 8; i++) leafAt(L, 'frond', V(0, 0.05, 0), i * 0.8 + r(), 0.2, 0.7, vary('#5a9a47', r), 0.2 + r() * 0.3); return L; },
  palme(r, o) { const L = []; for (let i = 0; i < o.n; i++) { const y = i * 2.4 + r() * 0.3, len = o.h * (0.6 + r() * 0.5), lean = 0.15 + r() * 0.22, top = V(Math.cos(y) * lean * len, len, Math.sin(y) * lean * len), a = (i / o.n) * 0.8;
    stemPart(L, V(), top, 0.012, vary('#4a6a30', r), a); leafAt(L, 'frond', top, yawTo(top.x, top.z), 0.55 + r() * 0.4, o.fs * (0.8 + r() * 0.4), vary(o.c, r, 0.08), a + 0.05); } return L; },
  // Monstera : un tuteur moussu, des pétioles qui s'arquent, les feuilles hautes grimpent sur le tuteur.
  monstera(r, o = {}) { const L = [], vg = o.variegated, N = 26;
    stemPart(L, V(), V(0.02, 1.95, 0), 0.055, col('#5d5a34'), 0.35);
    for (let i = 0; i < N; i++) { const climb = i >= N - 8, y = i * 2.4 + r() * 0.4, a = (i / N) * 0.85; let base, top;
      if (climb) { const h = 0.85 + (i - (N - 8)) * 0.14; base = V(0.02, h, 0); top = V(Math.cos(y) * 0.32, h + 0.12, Math.sin(y) * 0.32); }
      else { const len = 0.55 + r() * 0.7, lean = 0.4 + r() * 0.45; base = V(0, 0.05, 0); const mid = V(Math.cos(y) * lean * len * 0.3, len * 0.72, Math.sin(y) * lean * len * 0.3); top = V(Math.cos(y) * lean * len, len * (0.82 + r() * 0.18), Math.sin(y) * lean * len); stemPart(L, base, mid, 0.014, vary('#5d7f3a', r), a); base = mid; }
      stemPart(L, base, top, 0.012, vary('#5d7f3a', r), a);
      const c = vg && r() < 0.35 ? vary('#c9dba8', r, 0.05) : vary('#2c6428', r, 0.07);
      leafAt(L, 'monstera', top, yawTo(top.x, top.z) + (r() - 0.5) * 0.5, 0.08 + r() * 0.35, 0.5 + r() * 0.32, c, a + 0.05, (r() - 0.5) * 0.35); }
    for (let i = 0; i < 6; i++) { const y = r() * 6, h = 0.7 + r() * 0.9; stemPart(L, V(Math.cos(y) * 0.06, h, Math.sin(y) * 0.06), V(Math.cos(y) * (0.25 + r() * 0.3), 0, Math.sin(y) * (0.25 + r() * 0.3)), 0.006, col('#7a5f3e'), 0.8); }
    return L; },
  paddle(r, o) { const L = []; for (let i = 0; i < o.n; i++) { const y = i * 2.4 + r() * 0.3, len = o.h * (0.55 + r() * 0.5), lean = 0.12 + r() * 0.18, top = V(Math.cos(y) * lean * len, len, Math.sin(y) * lean * len), a = (i / o.n) * 0.8;
      stemPart(L, V(), top, 0.014, vary('#5a7a40', r), a); leafAt(L, 'paddle', top, yawTo(top.x, top.z) + (r() - 0.5) * 0.4, 0.9 + r() * 0.5, o.ls * (0.8 + r() * 0.4), vary(o.c, r, 0.06), a + 0.05, (r() - 0.5) * 0.3); }
    for (let i = 0; i < o.birds; i++) { const y = r() * 6.28, t = V(Math.cos(y) * 0.15, o.h * (0.7 + r() * 0.2), Math.sin(y) * 0.15); stemPart(L, V(), t, 0.01, col('#6a7a4a'), 0.7); part(L, 'aloe', t, [-1.35, y, 0], [0.5, 0.35, 0.5], col('#5a6a7a'), 0.8);
      for (let k = 0; k < 3; k++) part(L, 'aloe', t.clone().add(V(0, 0.02, 0)), [-(0.4 + k * 0.25), y + (k - 1) * 0.25, 0], [0.35, 0.32, 0.3], vary('#f08a20', r, 0.06), 0.85); part(L, 'aloe', t.clone().add(V(0, 0.01, 0)), [-0.7, y + 0.1, 0], [0.25, 0.3, 0.25], col('#3a5ad0'), 0.88); }
    return L; },
  // Arbre : tronc (noueux ou droit), charpentières, houppier, fruits et fleurs.
  arbre(r, o) { const L = []; let p = V(); const segs = 6;
    for (let i = 0; i < segs; i++) { const n = p.clone().add(V((r() - 0.5) * o.gnarl, o.h / segs, (r() - 0.5) * o.gnarl)); stemPart(L, p, n, o.tr * (1 - i * 0.08), col(o.trc), (i / segs) * 0.3); p = n; }
    const top = p.clone(), cy = top.y + o.R * 0.35;
    for (let i = 0; i < o.br; i++) { const y = (i * 6.28) / o.br + r() * 0.4, t = V(top.x + Math.cos(y) * o.R * 0.8, top.y + o.R * (0.2 + r() * 0.5), top.z + Math.sin(y) * o.R * 0.8); stemPart(L, top.clone().add(V(0, -o.h * 0.15, 0)), t, o.tr * 0.45, col(o.trc), 0.2); }
    for (let i = 0; i < o.n; i++) { const y = r() * 6.28, el = r() * 1.3 - 0.35, R = o.R * (0.75 + r() * 0.35), q = V(top.x + Math.cos(y) * Math.cos(el) * R, cy + Math.sin(el) * R * o.flat, top.z + Math.sin(y) * Math.cos(el) * R); leafAt(L, o.leaf, q, y + (r() - 0.5), 0.1 + r() * 0.5, o.ls * (0.8 + r() * 0.4), vary(pickc(o.lc, r), r, 0.08), 0.2 + r() * 0.6); }
    const dot = (f, pool, shape) => { for (let i = 0; i < f.n; i++) { const y = r() * 6.28, el = r() * 0.8 - 0.4, R = o.R * 1.0, q = V(top.x + Math.cos(y) * R * Math.cos(el), cy + Math.sin(el) * R * o.flat, top.z + Math.sin(y) * R * Math.cos(el)); part(L, pool, q, shape ? [r(), y, 0] : [0, 0, 0], f.s, vary(f.c, r, 0.05), 0.8 + r() * 0.15); } };
    if (o.fruit) dot(o.fruit, 'ball'); if (o.flower) dot(o.flower, o.flower.pool || 'star', true); return L; },
  // Lianes et tombantes : un chemin (liste de points), la croissance suit la longueur.
  liane(r, path, o) { const L = [], N = path.length - 1;
    for (let i = 0; i < N; i++) { const a = path[i], b = path[i + 1], t = i / N; stemPart(L, a, b, 0.012, vary('#5b4a32', r), t * 0.95);
      for (const side of [1, -1]) { const yaw = (a.x > 0 ? -Math.PI / 2 : Math.PI / 2) + side * (0.6 + r() * 0.8); leafAt(L, o.leaf, a.clone().add(V(0, 0, side * 0.03)), yaw, -0.3 + r() * 0.9, o.s * (0.75 + r() * 0.5), vary(o.c, r, 0.12), t * 0.95 + 0.02);
        if (o.flower && r() < (o.fp ?? 0.5)) { const at = Math.min(0.99, t * 0.95 + 0.15), q = a.clone().add(V((r() - 0.5) * 0.06, -0.02, (r() - 0.5) * 0.06));
          if (o.raceme) for (let k = 0; k < 6; k++) part(L, o.fpool || 'star', q.clone().add(V(0, -k * 0.03, 0)), [1.2, r() * 6, 0], (o.fs || 0.028) * (1 - k * 0.1), vary(o.flower, r, 0.08), at);
          else part(L, o.fpool || 'star', q, [r() - 0.5, r() * 6, 0], o.fs || 0.028, vary(o.flower, r, 0.06), at); } } } return L; },
  tombante(r, o) { const L = []; for (let s = 0; s < 22; s++) { const y = s * 0.29 + r() * 0.3, len = 0.4 + r() * 1.1, out = 0.12 + r() * 0.12; let p = V(Math.cos(y) * out, 0.1, Math.sin(y) * out);
      for (let k = 0; k < 14; k++) { const t = k / 14, n = p.clone().add(V(Math.cos(y) * 0.05 * (1 - t) ** 2, -len / 14 * (0.3 + t), Math.sin(y) * 0.05 * (1 - t) ** 2)); stemPart(L, p, n, 0.003, vary('#557038', r), t * 0.9);
        for (const sd of [1, -1]) leafAt(L, o.leaf, n, y + sd * (0.9 + r() * 0.8), -0.5 - r() * 0.7, o.s * (0.8 + r() * 0.4), vary(o.c2 && r() < 0.35 ? o.c2 : o.c, r, 0.12), t * 0.9 + 0.04, 0);
        if (o.flower && k % 3 === 2 && r() < 0.7) part(L, o.fpool || 'petal5', n.clone().add(V(Math.cos(y) * 0.04, 0, Math.sin(y) * 0.04)), [-0.9, y, 0], o.fs || 0.035, vary(o.flower, r, 0.1), Math.min(0.99, t * 0.9 + 0.2)); p = n; } } return L; },
  semis(r, o) { const L = []; const n = 3 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { const y = r() * 6.28, h = 0.08 + r() * 0.1, t = V(Math.cos(y) * 0.02, h, Math.sin(y) * 0.02); stemPart(L, V(), t, 0.004, col('#6a8f42'), (i / n) * 0.5); leafAt(L, o.leaf, t, y, 0.3, o.s * 0.6, vary(o.c, r, 0.1), (i / n) * 0.5 + 0.2); leafAt(L, o.leaf, t, y + 3.14, 0.3, o.s * 0.6, vary(o.c, r, 0.1), (i / n) * 0.5 + 0.25); } return L; },
};

// ---------- La serre ----------
export const HALL = { w: 3.4, d: 6, wall: 2.4 };
const RIB_Z = []; for (let z = -HALL.d; z <= HALL.d + 0.01; z += 1.5) RIB_Z.push(z);
const ribPoint = (side, z, s) => { // s : 0 au sol .. 1 au faîte, le long d'un arceau
  const R = HALL.w - 0.08, tot = HALL.wall + (Math.PI / 2) * R, d = s * tot;
  if (d <= HALL.wall) return V(side * R, d, z);
  const a = (d - HALL.wall) / R; return V(side * Math.cos(a) * R, HALL.wall + Math.sin(a) * R, z);
};
function buildHall(scene) {
  const g = new THREE.Group(); scene.add(g); const r = rngOf(7);
  const W = HALL.w, D = HALL.d, H = HALL.wall, R = W;
  // sol : terre battue, allée de dalles, plates-bandes
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D * 2), new THREE.MeshStandardMaterial({ color: 0x4b3d2c, roughness: 1 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const tiles = []; for (let z = -D + 1.95; z < D; z += 0.5) for (let x = -0.6; x <= 0.61; x += 0.4) { if (Math.hypot(x, z + 2.6) < 0.95) continue; const b = new THREE.BoxGeometry(0.38, 0.05, 0.47); b.translate(x + (r() - 0.5) * 0.02, 0.02, z + (r() - 0.5) * 0.02); tiles.push(b); }
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2, b = new THREE.BoxGeometry(0.24, 0.05, 0.22); b.rotateY(-a); b.translate(Math.cos(a) * 0.76, 0.02, -2.6 + Math.sin(a) * 0.76); tiles.push(b); }
  { const c = new THREE.Mesh(new THREE.CircleGeometry(0.66, 32), M.soil); c.rotation.x = -Math.PI / 2; c.position.set(0, 0.012, -2.6); c.receiveShadow = true; g.add(c); }
  const tm = new THREE.Mesh(merge(tiles), new THREE.MeshStandardMaterial({ color: 0x9a9285, roughness: 0.9 })); tm.receiveShadow = true; g.add(tm);
  // murets de briques, bordures de plates-bandes
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, D * 2), M.brick); m.position.set(s * (W - 0.05), 0.375, 0); m.castShadow = m.receiveShadow = true; g.add(m); }
  { const m = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 0.75, 0.22), M.brick); m.position.set(0, 0.375, -D + 0.05); m.receiveShadow = true; g.add(m); }
  for (const [x0, x1, z0, z1] of [[-W + 0.15, -0.85, -D + 0.2, -0.6], [0.85, W - 0.15, -D + 0.2, -0.6], [-0.85, 0.85, -D + 0.2, -4.35]]) {
    const soil = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.22, z1 - z0), M.soil); soil.position.set((x0 + x1) / 2, 0.11, (z0 + z1) / 2); soil.receiveShadow = true; g.add(soil);
    const ed = []; if (x0 > -0.9 && x1 < 0.9) { /* plate-bande du fond : bordure devant seulement */ } else for (let z = z0; z < z1; z += 0.22) ed.push(new THREE.BoxGeometry(0.12, 0.26, 0.2).translate(x0 > 0 ? x0 : x1, 0.13, z + 0.11));
    for (let x = x0; x < x1; x += 0.22) ed.push(new THREE.BoxGeometry(0.2, 0.26, 0.12).translate(x + 0.11, 0.13, z1));
    const em = new THREE.Mesh(merge(ed), new THREE.MeshStandardMaterial({ color: 0x8a8174, roughness: 0.95 })); em.castShadow = em.receiveShadow = true; g.add(em);
  }
  // établis de pépinière (près de la porte)
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a5a3c, roughness: 0.85 }), bench = [];
  for (const s of [-1, 1]) { const x = s * (W - 0.62); bench.push(new THREE.BoxGeometry(0.85, 0.06, 5.0).translate(x, 0.82, 3.1), new THREE.BoxGeometry(0.85, 0.04, 5.0).translate(x, 0.3, 3.1));
    for (const z of [0.7, 3.1, 5.5]) for (const dx of [-0.38, 0.38]) bench.push(new THREE.BoxGeometry(0.06, 0.82, 0.06).translate(x + dx, 0.41, z)); }
  const bm = new THREE.Mesh(merge(bench), wood); bm.castShadow = bm.receiveShadow = true; g.add(bm);
  // ossature : arceaux de fonte, pannes, verre
  const ribs = [], cyl = new THREE.CylinderGeometry(1, 1, 1, 6); cyl.translate(0, 0.5, 0);
  for (const z of RIB_Z) for (const s of [-1, 1]) { let a = ribPoint(s, z, 0); for (let i = 1; i <= 16; i++) { const b = ribPoint(s, z, i / 16); ribs.push(along(cyl, a, b, 0.035)); a = b; } }
  for (let k = 0; k <= 6; k++) for (const s of [-1, 1]) { const a = ribPoint(s, -D, 0.3 + k * 0.115), b = ribPoint(s, D, 0.3 + k * 0.115); ribs.push(along(cyl, a, b, 0.022)); }
  ribs.push(along(cyl, V(0, H + R, -D), V(0, H + R, D), 0.05));
  const im = new THREE.Mesh(merge(ribs), M.iron); im.castShadow = true; g.add(im);
  const sideG = new THREE.PlaneGeometry(D * 2, H - 0.75); for (const s of [-1, 1]) { const m = new THREE.Mesh(sideG, M.glass); m.rotation.y = s * Math.PI / 2; m.position.set(s * W, 0.75 + (H - 0.75) / 2, 0); m.renderOrder = 2; g.add(m); }
  const vg = new THREE.CylinderGeometry(R, R, D * 2, 32, 1, true, -Math.PI / 2, Math.PI); vg.rotateX(-Math.PI / 2);
  const vault = new THREE.Mesh(vg, M.glass); vault.position.y = H; vault.renderOrder = 2; g.add(vault);
  for (const z of [-D, D]) { const sh = new THREE.Shape(); sh.moveTo(-W, 0.75); sh.lineTo(-W, H); sh.absarc(0, H, R, Math.PI, 0, true); sh.lineTo(W, 0.75);
    if (z > 0) { sh.lineTo(0.8, 0.75); sh.lineTo(0.8, 2.3); sh.lineTo(-0.8, 2.3); sh.lineTo(-0.8, 0.75); } sh.lineTo(-W, 0.75);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh, 16), M.glass); m.position.z = z; m.renderOrder = 2; g.add(m); }
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(W - 0.8, 0.75, 0.22), M.brick); m.position.set(s * (W + 0.8) / 2, 0.375, D - 0.05); m.castShadow = m.receiveShadow = true; g.add(m); }
  // porte ouverte : chambranle
  const door = []; for (const x of [-0.8, 0.8]) door.push(along(cyl, V(x, 0, D), V(x, 2.3, D), 0.04)); door.push(along(cyl, V(-0.8, 2.3, D), V(0.8, 2.3, D), 0.04)); const dm = new THREE.Mesh(merge(door), M.iron); g.add(dm);
  return g;
}

// ---------- Les trois serres : douze espèces chacune, dans l'ordre du déblocage ----------
// Types : 4 Massif, 1 Rocaille (ou Prairie), 3 Géante, 2 Liane, 2 Tombante. Le plan est le même pour les trois serres.
const sp = (id, nom, latin, type, gen, more = {}) => ({ id, nom, latin, type, gen, ...more });
const SERRES = {
  bienetre: { nom: 'Bien-être', potc: ['#b8693f', '#a65d3a', '#c47a52'], fin: 'La serre Bien-être est accomplie. Une monstera panachée est apparue.',
    species: [
      sp('thym', 'Thym', 'Thymus vulgaris', 'Massif', (r) => G.thym(r), { gs: 1.9 }),
      sp('basilic', 'Basilic', 'Ocimum basilicum', 'Massif', (r) => G.basilic(r), { gs: 1.6 }),
      sp('romarin', 'Romarin', 'Salvia rosmarinus', 'Massif', (r) => G.romarin(r), { gs: 1.7 }),
      sp('aloes', 'Aloès', 'Aloe vera', 'Rocaille', (r) => G.aloes(r), { gs: 1.25 }),
      sp('camomille', 'Camomille', 'Matricaria chamomilla', 'Massif', (r) => G.camomille(r), { gs: 1.8 }),
      sp('lierre', 'Lierre', 'Hedera helix', 'Liane', null, { leafy: { leaf: 'ivy', c: '#2f5a2c', s: 0.3 } }),
      sp('tradescantia', 'Misère', 'Tradescantia zebrina', 'Tombante', null, { leafy: { leaf: 'leaf', c: '#6d5a8c', c2: '#8fa0a8', s: 0.1 } }),
      sp('fougere', 'Fougère arborescente', 'Dicksonia antarctica', 'Géante', (r) => G.fougere(r)),
      sp('capucine', 'Capucine', 'Tropaeolum majus', 'Tombante', null, { leafy: { leaf: 'round', c: '#6fa04a', s: 0.11, flower: '#ef7a22' } }),
      sp('jasmin', 'Jasmin étoilé', 'Trachelospermum jasminoides', 'Liane', null, { leafy: { leaf: 'leaf', c: '#2f6a32', s: 0.2, flower: '#fbf7ec' } }),
      sp('citronnier', 'Citronnier', 'Citrus limon', 'Géante', (r) => G.arbre(r, { h: 1.0, tr: 0.05, trc: '#5b4636', gnarl: 0.03, br: 6, R: 0.55, flat: 0.8, n: 260, leaf: 'leaf', ls: 0.13, lc: '#2d5b2a', fruit: { n: 18, c: '#f0cf35', s: [0.045, 0.06, 0.045] }, flower: { n: 14, c: '#fbf8ee', s: 0.025 } })),
      sp('monstera', 'Monstera', 'Monstera deliciosa', 'Géante', (r) => G.monstera(r, { variegated }), { gs: 1.25, rare: 'Variante panachée : une chance sur dix à la pleine terre' }),
    ],
    decors: [['arrosoir', 'Arrosoir de cuivre', 3], ['etiquettes', 'Étiquettes de botaniste', 4], ['banc', 'Banc de jardin', 6], ['lanternes', 'Lanternes', 8], ['bassin', 'Bassin et fontaine', 12], ['carillon', 'Carillon', 5]] },
  travail: { nom: 'Travail', potc: ['#8f8a80', '#a39d92', '#7d786e'], fin: 'La serre Travail est accomplie. L’oiseau de paradis a fleuri.',
    species: [
      sp('pensee', 'Pensée', 'Viola × wittrockiana', 'Massif', (r) => G.touffe(r, { n: 20, h: 0.14, spread: 0.2, leaf: 'round', leafC: '#4a7a35', leafS: 0.07, leafN: 2, fs: 0.042, fc: ['#6a4ab0', '#e8c43a', '#9a5ac8', '#f2f0e8'], ftilt: -0.6, center: '#2a2030', fp: 0.9 }), { gs: 1.8 }),
      sp('lavande', 'Lavande', 'Lavandula angustifolia', 'Massif', (r) => G.touffe(r, { n: 46, h: 0.5, spread: 0.22, leaf: 'needle', leafC: '#8a9a8a', leafS: 0.08, leafN: 3, spike: true, fs: 0.016, fc: '#8a6ad0', stemC: '#7a8a6a', fp: 0.85 }), { gs: 1.6 }),
      sp('iris', 'Iris', 'Iris germanica', 'Massif', (r) => G.touffe(r, { n: 5, h: 0.75, spread: 0.1, leafN: 0, leafC: '#5a7a5a', sword: 10, fs: 0.075, fc: ['#5a4ab8', '#7a5ad0'], ftilt: 0.2, fp: 1, sr: 0.006 }), { gs: 1.4 }),
      sp('sansevieria', 'Sansevière', 'Dracaena trifasciata', 'Rocaille', (r) => G.rosette(r, { n: 11, tilt0: 0.03, tilt: 0.3, len: 2.0, w: 0.9, d: 0.35, c: '#2f4a2f', c2: '#5f7a35' }), { gs: 1.2 }),
      sp('calathea', 'Calathéa', 'Goeppertia orbifolia', 'Massif', (r) => G.buisson(r, { n: 16, h: 0.45, leaf: 'round', ls: 0.26, lc: ['#2f5a3a', '#4a3a5a', '#3a6a42'], pitch: 0.75 }), { gs: 1.4 }),
      sp('philodendron', 'Philodendron', 'Philodendron hederaceum', 'Liane', null, { leafy: { leaf: 'ivy', c: '#2f6a2c', s: 0.32 } }),
      sp('pothos', 'Pothos', 'Epipremnum aureum', 'Tombante', null, { leafy: { leaf: 'round', c: '#4f8a32', c2: '#cfc96a', s: 0.12 } }),
      sp('kentia', 'Palmier kentia', 'Howea forsteriana', 'Géante', (r) => G.palme(r, { n: 14, h: 1.3, fs: 1.9, c: '#3f7a35' })),
      sp('orchidee', 'Orchidée', 'Phalaenopsis', 'Tombante', null, { leafy: { leaf: 'leaf', c: '#3f6a35', s: 0.13, flower: '#f3e4ef', fs: 0.06 } }),
      sp('glycine', 'Glycine', 'Wisteria sinensis', 'Liane', null, { leafy: { leaf: 'leaf', c: '#4f7a35', s: 0.16, flower: '#9a7ad0', fpool: 'petal5', fs: 0.032, raceme: true, fp: 0.4 } }),
      sp('ficus', 'Figuier lyre', 'Ficus lyrata', 'Géante', (r) => G.arbre(r, { h: 1.3, tr: 0.045, trc: '#6a5a48', gnarl: 0.02, br: 4, R: 0.45, flat: 1.4, n: 80, leaf: 'round', ls: 0.32, lc: '#2a5a22' })),
      sp('strelitzia', 'Oiseau de paradis', 'Strelitzia reginae', 'Géante', (r) => G.paddle(r, { n: 18, h: 1.7, ls: 0.8, c: '#3a6a3a', birds: 6 }), { gs: 1.1, rare: 'Variante blanche : une chance sur dix à la pleine terre' }),
    ],
    decors: [['arrosoir', 'Arrosoir de cuivre', 3], ['etiquettes', 'Étiquettes de botaniste', 4], ['banc', 'Banc de lecture', 6], ['lanternes', 'Lampes de bibliothèque', 8], ['cadran', 'Cadran solaire', 12], ['horloge', 'Horloge de gare', 5]] },
  perso: { nom: 'Vie perso', potc: ['#f1e7d0', '#e2d3b4', '#d8c8a4'], fin: 'La serre Vie perso est accomplie. L’olivier porte ses premières olives.',
    species: [
      sp('marguerite', 'Marguerite', 'Leucanthemum vulgare', 'Massif', (r) => G.touffe(r, { n: 26, h: 0.5, spread: 0.22, leaf: 'leaf', leafC: '#4a8a3a', leafS: 0.05, leafN: 2, fpool: 'daisy', fs: 0.04, fc: '#faf8f0', center: '#e8b52a' }), { gs: 1.6 }),
      sp('coquelicot', 'Coquelicot', 'Papaver rhoeas', 'Massif', (r) => G.touffe(r, { n: 18, h: 0.5, spread: 0.22, leaf: 'leaf', leafC: '#5a8a3a', leafS: 0.07, leafN: 1, fs: 0.055, fc: '#e03a2a', ftilt: -0.2, center: '#1a1a1a' }), { gs: 1.6 }),
      sp('bleuet', 'Bleuet', 'Centaurea cyanus', 'Massif', (r) => G.touffe(r, { n: 24, h: 0.45, spread: 0.22, leaf: 'needle', leafC: '#7a9a6a', leafS: 0.07, leafN: 2, fpool: 'star', fs: 0.032, fc: '#3a6ad8' }), { gs: 1.6 }),
      sp('graminees', 'Graminées', 'Pennisetum alopecuroides', 'Prairie', (r) => G.herbes(r, { n: 70, h: 0.75, c: '#9aa86a', plumes: 16, pc: '#e0d2a8' }), { gs: 1.2 }),
      sp('cosmos', 'Cosmos', 'Cosmos bipinnatus', 'Massif', (r) => G.touffe(r, { n: 18, h: 0.75, spread: 0.25, leaf: 'needle', leafC: '#6a9a4a', leafS: 0.08, leafN: 3, fpool: 'daisy', fs: 0.05, fc: ['#e870a8', '#f2b0cc', '#c0306a', '#faf6f0'], center: '#e8b52a' }), { gs: 1.5 }),
      sp('chevrefeuille', 'Chèvrefeuille', 'Lonicera periclymenum', 'Liane', null, { leafy: { leaf: 'leaf', c: '#4a7a3a', s: 0.14, flower: '#f3e2b0', fs: 0.036 } }),
      sp('geranium', 'Géranium-lierre', 'Pelargonium peltatum', 'Tombante', null, { leafy: { leaf: 'ivy', c: '#4f8a3a', s: 0.1, flower: '#e2384a', fs: 0.038 } }),
      sp('hortensia', 'Hortensia', 'Hydrangea macrophylla', 'Géante', (r) => G.buisson(r, { n: 46, h: 0.8, leaf: 'round', ls: 0.17, lc: '#3f7a35', pitch: 0.3, heads: 16, hr: 0.45, hc: ['#8fa6e0', '#b48ad8', '#e8a0c0'], fl: 18, hs: 0.09, fs: 0.036 }), { gs: 1.3 }),
      sp('fuchsia', 'Fuchsia', 'Fuchsia magellanica', 'Tombante', null, { leafy: { leaf: 'leaf', c: '#3f6b33', s: 0.08, flower: '#d0306a', fs: 0.04 } }),
      sp('rosier', 'Rosier grimpant', 'Rosa ‘Pierre de Ronsard’', 'Liane', null, { leafy: { leaf: 'leaf', c: '#3f6b35', s: 0.13, flower: '#f0a0b8', fpool: 'petal5', fs: 0.055, fp: 0.55 } }),
      sp('figuier', 'Figuier', 'Ficus carica', 'Géante', (r) => G.arbre(r, { h: 0.8, tr: 0.07, trc: '#8a8274', gnarl: 0.08, br: 6, R: 0.7, flat: 0.7, n: 120, leaf: 'round', ls: 0.26, lc: '#3f7a30', fruit: { n: 16, c: '#5a3a5a', s: [0.03, 0.035, 0.03] } })),
      sp('olivier', 'Olivier', 'Olea europaea', 'Géante', (r) => G.arbre(r, { h: 1.1, tr: 0.08, trc: '#6b6458', gnarl: 0.18, br: 7, R: 0.8, flat: 0.6, n: 560, leaf: 'needle', ls: 0.11, lc: ['#7a8a6a', '#8a9a7a', '#6a7a5a'], fruit: { n: 30, c: '#3a2a3a', s: [0.015, 0.02, 0.015] } }), { gs: 1.1, rare: 'Olivier centenaire : une chance sur dix à la pleine terre' }),
    ],
    decors: [['arrosoir', 'Arrosoir de cuivre', 3], ['etiquettes', 'Étiquettes peintes', 4], ['banc', 'Banc de jardin', 6], ['guirlande', 'Guirlande lumineuse', 8], ['vasque', 'Vasque aux oiseaux', 12], ['carillon', 'Carillon', 5]] },
};
export const SERRE_IDS = Object.keys(SERRES);
const U = [0, 0.02, 0.1, 0.17, 0.24, 0.31, 0.38, 0.45, 0.52, 0.59, 0.66, 0.73];
const DEB = ['Au départ', 'Au départ', '1 plante en pleine terre', '5 graines', '2 plantes en pleine terre', '8 graines', '3 plantes en pleine terre', '12 graines', '5 plantes en pleine terre', '15 graines', '7 plantes en pleine terre', '25 graines'];
const DU = [0.12, 0.28, 0.42, 0.55, 0.68, 0.82];
export let SERRE = SERRES.bienetre, SPECIES = [], DECORS = [];
let SP = {}, PLAN = [], POTC = [];
const D = HALL.d;
const BASKETS = [[-1.3, -4.2], [1.3, -4.2], [-1.3, -1.2], [1.3, -1.2], [-1.3, 1.9], [1.3, 1.9]];
const BENCH = []; for (const s of [-1, 1]) for (let i = 0; i < 10; i++) for (const row of [0, 1]) BENCH.push(V(s * (HALL.w - 0.62) + (row - 0.5) * 0.36 + (i % 2) * 0.04 * s, 0.85, 0.9 + i * 0.48 + row * 0.2));
BENCH.sort((a, b) => b.z - a.z); // d'abord près de la porte
export function configure(id) {
  SERRE = SERRES[id] || SERRES.bienetre; SERRE.id = SERRES[id] ? id : 'bienetre';
  SPECIES = SERRE.species.map((s, i) => ({ ...s, u: U[i], debloque: DEB[i] })); SP = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
  DECORS = SERRE.decors.map(([did, nom, prix], i) => ({ id: did, nom, prix, u: DU[i] })); POTC = SERRE.potc.map(col);
  const of = (t) => SPECIES.filter((s) => s.type === t).map((s) => s.id), m = of('Massif'), ro = SPECIES.find((s) => s.type === 'Rocaille' || s.type === 'Prairie').id, g = of('Géante'), l = of('Liane'), t = of('Tombante');
  const GRID = [[0, 1, 0, 1], [1, 0, 1, 0], [2, 3, 2, 0], [3, 2, 3, 1], [2, 3, 3, 2], [3, 3, 2, 3]];
  PLAN = []; const r = rngOf(31);
  GRID.forEach((row, j) => row.forEach((k, i) => PLAN.push([m[k], -3.0 + i * 0.6 + (r() - 0.5) * 0.18, -0.95 - j * 0.62 + (r() - 0.5) * 0.18])));
  PLAN.push([ro, 1.35, -1.1], [ro, 2.15, -1.5], [ro, 2.9, -1.0], [ro, 1.7, -2.3], [ro, 2.75, -2.55], [ro, 1.45, -3.3], [ro, 2.4, -3.4],
    [g[0], -2.45, -4.9], [g[0], 2.75, -4.3], [g[1], 1.65, -5.15], [g[2], 0, -5.2],
    [l[0], -1, RIB_Z[1]], [l[1], -1, RIB_Z[3]], [l[0], -1, RIB_Z[5]], [l[1], -1, RIB_Z[7]], [l[1], 1, RIB_Z[1]], [l[0], 1, RIB_Z[3]], [l[1], 1, RIB_Z[5]], [l[0], 1, RIB_Z[7]],
    [t[0], ...BASKETS[0]], [t[1], ...BASKETS[1]], [t[1], ...BASKETS[2]], [t[0], ...BASKETS[3]], [t[1], ...BASKETS[4]], [t[0], ...BASKETS[5]]);
  return SERRE;
}
configure('bienetre');

export function plan() {
  const items = [];
  // emplacements du plan : semé à u + petit décalage, pleine terre 10 % plus tard, adulte 20 % après
  const per = {}; PLAN.forEach(([id, x, z], i) => { const k = (per[id] = (per[id] || 0) + 1) - 1, s = SP[id], sow = Math.min(0.86, s.u + k * 0.02), ground = sow + 0.1; items.push({ i, id, x, z, sow, ground, full: Math.min(1, ground + 0.2) }); });
  // pépinière qui continue : quelques semis tardifs qui restent en pot
  for (let k = 0; k < 22; k++) { const id = SPECIES[(k * 5 + 1) % SPECIES.length].id; items.push({ i: 100 + k, id, sow: Math.max(SP[id].u, 0.3 + k * 0.03), ground: 9, full: 9, nursery: true }); }
  // affectation des pots de l'établi : intervalle [sow, ground) ; premier pot libre
  const free = BENCH.map(() => -1); items.slice().sort((a, b) => a.sow - b.sow).forEach((it) => { let j = free.findIndex((until) => until <= it.sow); if (j < 0) j = free.indexOf(Math.min(...free)); it.bench = j; free[j] = Math.min(9, it.ground); });
  return items;
}

// ---------- Stades (docs/PROGRESSION.md) : 1 graine, 2 pousse, 5 plante, 10 grande, 20 pleine terre ----------
export const STAGES = [['Graine', 1], ['Pousse', 2], ['Plante', 5], ['Grande', 10], ['Pleine terre', 20]];
export function waterings(it, p) { if (p < it.sow) return 0; if (p < it.ground) return 1 + Math.floor(19 * (p - it.sow) / (it.ground - it.sow)); return 20 + Math.floor(30 * clamp01((p - it.ground) / (it.full - it.ground))); }
export const stageOf = (w) => { let s = -1; STAGES.forEach(([, k], i) => { if (w >= k) s = i; }); return s; };

// ---------- Montage ----------
let renderer, scene, camera, controls, hemi, sun, sky, ernest, lampLights = [], lampMeshes = [], fireflies, water, chime, decorObjs = {}, labelMeshes = [];
const plants = []; let P = 0, timeKey = 'day', onFps = null, variegated = true;

function buildPools() {
  const counts = {}; for (const pl of plants) for (const pc of [...pl.parts, ...(pl.seedParts || [])]) counts[pc.pool] = (counts[pc.pool] || 0) + 1;
  counts.pot = (counts.pot || 0) + BENCH.length + 6; counts.moss = (counts.moss || 0) + 260; counts.stone = (counts.stone || 0) + 60; counts.stem = (counts.stem || 0) + 8;
  for (const [k, [geo, mat]] of Object.entries(POOLS)) { const n = counts[k] || 1, im = new THREE.InstancedMesh(geo, mat, n); im.count = 0; im.castShadow = k !== 'moss' && k !== 'petal5' && k !== 'daisy' && k !== 'star'; im.receiveShadow = true; im.frustumCulled = false; im.setColorAt(0, col('#fff')); scene.add(im); pools[k] = { im, n: 0 }; }
}

function addPlant(it) {
  const r = rngOf(1000 + it.i * 977), s = SP[it.id], o = s.leafy; let parts, ground;
  if (s.type === 'Liane') { const side = it.x, z = it.z, path = [], off = rngOf(it.i);
    for (let k = 0; k <= 120; k++) { const q = ribPoint(side, z, Math.min(0.97, k / 120)); const n = V(-q.x, HALL.wall - q.y, 0).normalize(); if (q.y < HALL.wall) n.set(-side, 0, 0); q.addScaledVector(n, 0.14); q.z += Math.sin(k * 0.7) * 0.07 + (off() - 0.5) * 0.03; path.push(q); }
    parts = G.liane(r, path, o); ground = { pos: V(), ry: 0, s: 1, bed: true };
  } else if (s.type === 'Tombante') { parts = G.tombante(r, o); ground = { pos: V(it.x, 3.05, it.z), ry: r() * 6, s: 1, basket: true }; }
  else { parts = s.gen(r); ground = { pos: V(it.x, 0.22, it.z), ry: r() * 6, s: s.gs || 1 }; }
  const seedParts = o ? G.semis(rngOf(it.i + 5), o) : null;
  plants.push({ it, parts, seedParts, ground });
}

const _M = new THREE.Matrix4(), _P = new THREE.Matrix4(), _S = new THREE.Matrix4(), _c = new THREE.Color(), HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
function push(pool, m, c) { const p = pools[pool]; if (!p || p.n >= p.im.instanceMatrix.count) return; p.im.setMatrixAt(p.n, m); p.im.setColorAt(p.n, c); p.n++; }
function emit(parts, g, mat) {
  for (const pc of parts) { const k = smooth(pc.a, pc.a + 0.12, g); if (k <= 0.001) continue; _S.makeScale(k, k, k); _M.multiplyMatrices(mat, pc.m).multiply(_S); push(pc.pool, _M, pc.c); }
}
const BASKET_C = col('#6b4a2a'), CHAIN_C = col('#2a2a26');
export function setProgress(p) {
  P = clamp01(p);
  for (const k in pools) pools[k].n = 0;
  // pots vides de l'établi au début : quelques pots empilés
  const usedBench = new Set();
  for (const pl of plants) {
    const { it } = pl; if (P < it.sow) continue;
    if (P < it.ground) { // en pot sur l'établi
      usedBench.add(it.bench); const b = BENCH[it.bench], g = 0.15 + 0.45 * clamp01((P - it.sow) / Math.min(0.12, it.ground - it.sow)), big = SP[it.id].type === 'Géante';
      _P.compose(b, _q.setFromEuler(_e.set(0, it.i * 1.7, 0)), _s.setScalar(1)); push('pot', _P, POTC[it.i % 3]);
      const sc = big ? 0.32 : 0.5; _P.compose(b.clone().add(V(0, 0.22, 0)), _q, _s.setScalar(sc)); emit(pl.seedParts || pl.parts, pl.seedParts ? clamp01(g * 1.6) : g, _P);
    } else { // pleine terre, dans son emplacement du plan
      const g = 0.5 + 0.5 * smooth(it.ground, it.full, P), gr = pl.ground;
      if (gr.basket) { _P.compose(gr.pos.clone().add(V(0, -0.1, 0)), _q.identity(), _s.set(1.3, 0.7, 1.3)); push('pot', _P, BASKET_C); _P.compose(gr.pos.clone().add(V(0, 0.05, 0)), _q.identity(), _s.set(0.006, 2.6, 0.006)); push('stem', _P, CHAIN_C); }
      _P.compose(gr.pos, _q.setFromEuler(_e.set(0, gr.ry, 0)), _s.setScalar(gr.s * (gr.bed ? 1 : 0.55 + 0.45 * g))); emit(pl.parts, gr.bed ? (P - it.ground) / (it.full - it.ground) * 0.98 + 0.02 : g, _P);
    }
  }
  // pots vides (au départ et entre deux semis)
  BENCH.forEach((b, j) => { if (usedBench.has(j) || j % 3) return; _P.compose(b, _q.setFromEuler(_e.set(0, j, 0)), _s.setScalar(1)); push('pot', _P, POTC[j % 3]); });
  // mousse et pierres : la serre se couvre avec le temps
  const r = rngOf(42), moss = Math.floor(260 * smooth(0.05, 1, P));
  for (let i = 0; i < 260; i++) { const side = r() < 0.5 ? -1 : 1, z = -D + 0.4 + r() * (D * 2 - 0.8), x = side * (0.75 + r() * 0.15), onEdge = r() < 0.55, X = onEdge ? x : side * (HALL.w - 0.05 + (r() - 0.5) * 0.16), Y = onEdge ? 0.02 : 0.75, s = 0.05 + r() * 0.09;
    if (i >= moss) continue; _P.compose(V(X, Y, z), _q.setFromEuler(_e.set(0, r() * 6, 0)), _s.set(s * 1.6, s * 0.45, s * 1.3)); push('moss', _P, vary('#5f8a3c', r, 0.18)); }
  const ro = SPECIES.find((x) => x.type === 'Rocaille'); const rs = rngOf(9); for (let i = 0; i < 40; i++) { const x = 1.05 + rs() * 2.1, z = -0.8 - rs() * 2.9, s = 0.06 + rs() * 0.12; if (!ro || P < ro.u + 0.05) continue; _P.compose(V(x, 0.22, z), _q.setFromEuler(_e.set(rs(), rs() * 6, 0)), _s.set(s * 1.4, s * 0.8, s)); push('stone', _P, vary('#b9ad98', rs, 0.08)); }
  for (const k in pools) { const pl = pools[k]; pl.im.count = pl.n; pl.im.instanceMatrix.needsUpdate = true; if (pl.im.instanceColor) pl.im.instanceColor.needsUpdate = true; }
  // décors
  for (const d of DECORS) if (decorObjs[d.id]) decorObjs[d.id].visible = P >= d.u;
  labelMeshes.forEach(({ m, it }) => (m.visible = P >= DECORS[1].u && P >= it.ground));
  applyTime();
}

// Lueur posée au sol (disque additif) : la lumière des photophores sans calcul d'éclairage.
function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,200,120,1)'); g.addColorStop(0.35, 'rgba(255,170,90,0.45)'); g.addColorStop(1, 'rgba(255,150,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
let groundGlow = null, groundLights = [], candleMat = null;
function buildGroundLights() {
  const tex = glowTex(), glowMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  candleMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffb050, emissiveIntensity: 0, roughness: 0.4 });
  const jarMat = new THREE.MeshStandardMaterial({ color: 0xe8f0ea, roughness: 0.1, transparent: true, opacity: 0.35, depthWrite: false });
  const spots = [[-0.78, 4.6], [0.78, 3.6], [-0.78, 2.4], [0.78, 1.2], [-0.78, 0.2], [0.78, -1.2], [-0.78, -1.3], [-0.78, -3.9], [0.78, -3.9], [-2.0, -2.2, 0.22], [-2.7, -3.6, 0.22], [2.05, -2.0, 0.22], [2.6, -3.0, 0.22], [-1.5, -5.3, 0.22], [0.9, -5.5, 0.22]];
  groundGlow = new THREE.Group(); scene.add(groundGlow);
  const jarG = new THREE.CylinderGeometry(0.05, 0.045, 0.11, 10), candleG = new THREE.CylinderGeometry(0.022, 0.022, 0.05, 8), discG = new THREE.PlaneGeometry(1, 1);
  for (const [x, z, y = 0.04] of spots) {
    const jar = new THREE.Mesh(jarG, jarMat); jar.position.set(x, y + 0.055, z); groundGlow.add(jar);
    const c = new THREE.Mesh(candleG, candleMat); c.position.set(x, y + 0.03, z); groundGlow.add(c);
    const d = new THREE.Mesh(discG, glowMat); d.rotation.x = -Math.PI / 2; d.position.set(x, y + 0.012, z); d.scale.setScalar(y > 0.1 ? 1.1 : 0.9); d.renderOrder = 3; groundGlow.add(d);
  }
  groundGlow.userData.mat = glowMat;
  for (const [x, z] of [[-2.0, -2.8], [2.2, -2.8]]) { const l = new THREE.PointLight(0xffa860, 0, 3.6, 1.5); l.position.set(x, 0.45, z); scene.add(l); groundLights.push(l); }
}
function buildDecor() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x6e5034, roughness: 0.8 }), stoneMat = new THREE.MeshStandardMaterial({ color: 0xa79f90, roughness: 0.85 });
  const want = new Set(DECORS.map((d) => d.id));
  { // arrosoir de cuivre, au pied de l'établi
    const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.3, 16), M.copper); body.position.y = 0.15; g.add(body);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.4, 8), M.copper); spout.position.set(0.2, 0.25, 0); spout.rotation.z = -0.9; g.add(spout);
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.05, 10), M.copper); rose.position.set(0.36, 0.37, 0); rose.rotation.z = -0.9; g.add(rose);
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 16, Math.PI), M.copper); h.position.set(-0.02, 0.3, 0); g.add(h);
    g.position.set(-1.05, 0, 1.4); g.rotation.y = 0.6; g.traverse((m) => (m.castShadow = true)); scene.add(g); decorObjs.arrosoir = g;
  }
  { // banc
    const g = new THREE.Group(), parts = [];
    for (let i = 0; i < 3; i++) parts.push(new THREE.BoxGeometry(1.3, 0.04, 0.1).translate(0, 0.45, -0.12 + i * 0.12));
    for (let i = 0; i < 3; i++) parts.push(new THREE.BoxGeometry(1.3, 0.08, 0.03).translate(0, 0.62 + i * 0.12, -0.24));
    const m = new THREE.Mesh(merge(parts), wood); m.castShadow = true; g.add(m);
    for (const x of [-0.6, 0.6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.36), M.iron); leg.position.set(x, 0.22, -0.05); g.add(leg); }
    if (SERRE.id === 'travail') { const book = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.16), new THREE.MeshStandardMaterial({ color: 0x6a2a2a, roughness: 0.7 })); book.position.set(0.3, 0.49, 0); book.rotation.y = 0.3; g.add(book); }
    g.position.set(-1.25, 0, 0.1); g.rotation.y = Math.PI / 2; scene.add(g); decorObjs.banc = g;
  }
  if (want.has('lanternes')) { // lanternes suspendues
    const g = new THREE.Group();
    for (const z of [-3.4, -0.2, 3.2]) { const l = new THREE.Group(); const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 6), M.lamp); l.add(cage);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.1, 6), M.iron); cap.position.y = 0.18; l.add(cap); const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3.2, 4), M.iron); ch.position.y = 1.75; l.add(ch);
      l.position.set(0, 3.2, z); g.add(l); lampMeshes.push(cage); const pl = new THREE.PointLight(0xffb866, 0, 7, 1.6); pl.position.set(0, 3.05, z); g.add(pl); lampLights.push(pl); }
    scene.add(g); decorObjs.lanternes = g;
  }
  if (want.has('guirlande')) { // guirlande d'ampoules le long du faîtage, en festons
    const g = new THREE.Group(), n = 64, bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.025, 8, 6), M.lamp, n), m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) { const t = i / (n - 1), z = -D + 0.5 + t * (D * 2 - 1), sag = Math.abs(Math.sin(t * Math.PI * 6)) * 0.35, x = Math.sin(t * Math.PI * 3) * 0.9; m4.makeTranslation(x, HALL.wall + HALL.w - 0.7 - sag - Math.abs(x) * 0.25, z); bulbs.setMatrixAt(i, m4); }
    g.add(bulbs); for (const z of [-3.4, -0.2, 3.2]) { const pl = new THREE.PointLight(0xffc27a, 0, 7, 1.6); pl.position.set(0, 4.2, z); g.add(pl); lampLights.push(pl); }
    scene.add(g); decorObjs.guirlande = g;
  }
  if (want.has('bassin') || want.has('vasque')) { // bassin et fontaine (ou vasque aux oiseaux, plus petite) au croisement
    const small = want.has('vasque'), g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 36), stoneMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; ring.castShadow = ring.receiveShadow = true;
    if (!small) { g.add(ring); const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.2, 36, 1, true), stoneMat); wall.position.y = 0.1; g.add(wall); water = new THREE.Mesh(new THREE.CircleGeometry(0.58, 36), M.water); water.rotation.x = -Math.PI / 2; water.position.y = 0.16; g.add(water);
      for (let i = 0; i < 6; i++) { const lily = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10, 0.4, 5.6), new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 0.5, side: THREE.DoubleSide })); lily.rotation.x = -Math.PI / 2; const a = i * 1.1; lily.position.set(Math.cos(a) * 0.38, 0.17, Math.sin(a) * 0.36); g.add(lily); } }
    const col1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, small ? 0.75 : 0.65, 10), stoneMat); col1.position.y = small ? 0.38 : 0.35; g.add(col1);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(small ? 0.32 : 0.26, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), stoneMat.clone()); bowl.material.side = THREE.DoubleSide; bowl.position.y = small ? 0.92 : 0.82; bowl.scale.y = small ? 0.45 : 1; g.add(bowl);
    if (small) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.29, 24), M.water); w.rotation.x = -Math.PI / 2; w.position.y = 0.9; g.add(w); water = w; const bird = new THREE.Group(), bm = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.7 }); const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), bm); b.scale.set(1, 0.9, 1.4); bird.add(b); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), bm); hd.position.set(0, 0.04, 0.06); bird.add(hd); const ch = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd8603a })); ch.position.set(0, 0.015, 0.06); bird.add(ch); bird.position.set(0.28, 0.98, 0); bird.rotation.y = -1.2; g.add(bird); }
    else { const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.03, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xcfe9ee, transparent: true, opacity: 0.6, roughness: 0.1 })); jet.position.y = 0.9; g.add(jet); }
    g.position.set(0, 0, -2.6); scene.add(g); decorObjs[small ? 'vasque' : 'bassin'] = g;
  }
  if (want.has('cadran')) { // cadran solaire sur colonne
    const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.85, 12), stoneMat); c.position.y = 0.42; g.add(c);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 32), M.copper); plate.position.y = 0.87; g.add(plate);
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.24, 0); sh.lineTo(0, 0.2); sh.lineTo(0, 0); const gn = new THREE.Mesh(new THREE.ShapeGeometry(sh), M.copper); gn.material = M.copper; gn.position.set(-0.12, 0.885, 0); g.add(gn);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, t = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, 0.008), M.iron); t.position.set(Math.cos(a) * 0.25, 0.888, Math.sin(a) * 0.25); t.rotation.y = -a; g.add(t); }
    g.traverse((m) => (m.castShadow = true)); g.position.set(0, 0, -2.6); scene.add(g); decorObjs.cadran = g;
  }
  if (want.has('horloge')) { // horloge de gare au-dessus de la porte
    const g = new THREE.Group(); const face = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 36), new THREE.MeshStandardMaterial({ color: 0xf2ecdc, roughness: 0.5 })); face.rotation.x = Math.PI / 2; g.add(face);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 8, 36), M.iron); g.add(rim);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, t = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.05, 0.01), M.iron); t.position.set(Math.sin(a) * 0.26, Math.cos(a) * 0.26, -0.035); t.rotation.z = -a; g.add(t); }
    const hh = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.01), M.iron); hh.geometry.translate(0, 0.07, 0); hh.position.z = -0.04; g.add(hh); const mh = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.23, 0.01), M.iron); mh.geometry.translate(0, 0.11, 0); mh.position.z = -0.045; g.add(mh);
    g.userData.hands = [hh, mh]; g.position.set(0, 3.0, D - 0.12); scene.add(g); decorObjs.horloge = g;
  }
  if (want.has('carillon')) { // carillon près de la porte
    const g = new THREE.Group(); chime = [];
    for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18 + i * 0.05, 6), M.copper); const piv = new THREE.Group(); t.position.y = -(0.09 + i * 0.025); piv.add(t); const a = (i / 5) * 6.28; piv.position.set(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06); g.add(piv); chime.push(piv); }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12), wood); g.add(top); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.6, 4), M.iron); st.position.y = 0.3; g.add(st);
    g.position.set(0.55, 2.6, D - 0.5); scene.add(g); decorObjs.carillon = g;
  }
  // étiquettes plantées devant les emplacements du plan
  const lab = new THREE.MeshStandardMaterial({ color: SERRE.id === 'perso' ? 0xe8c8a0 : 0xf1ead8, roughness: 0.7 });
  for (const pl of plants) { const { it } = pl; if (it.nursery || pl.ground.basket || pl.ground.bed) continue; const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.012), lab); m.position.set(it.x + 0.22 * Math.sign(-it.x || 1), 0.3, it.z + 0.3); m.rotation.set(-0.3, 0, 0); m.castShadow = true; scene.add(m); labelMeshes.push({ m, it }); }
  buildGroundLights();
}

// ---------- Ciel et heure ----------
const SKY = {
  day: { top: '#7fb6dc', bot: '#d9ecef', hemi: ['#d8ecf0', '#8a7a52', 1.5], glow: 0.28, sun: ['#fff3dc', 2.6, V(5, 11, 4)], fog: '#cfe2e2', exp: 1.0, lamp: 0 },
  dusk: { top: '#2f3f6b', bot: '#f0a46a', hemi: ['#f0c8a8', '#6a4a34', 0.95], glow: 0.18, sun: ['#ffb46a', 1.9, V(-9, 3.2, -6)], fog: '#8a6a6a', exp: 1.05, lamp: 0.6 },
  night: { top: '#050b18', bot: '#11203a', hemi: ['#5a6f9a', '#2a2420', 0.35], glow: 0.04, sun: ['#9fb4ff', 0.35, V(-4, 10, 6)], fog: '#0b1424', exp: 1.15, lamp: 1 },
};
function applyTime() {
  const S = SKY[timeKey]; sky.material.uniforms.top.value.set(S.top); sky.material.uniforms.bot.value.set(S.bot);
  hemi.color.set(S.hemi[0]); hemi.groundColor.set(S.hemi[1]); hemi.intensity = S.hemi[2]; sun.color.set(S.sun[0]); sun.intensity = S.sun[1]; sun.position.copy(S.sun[2]); renderer.toneMappingExposure = S.exp; LEAF_GLOW.value = S.glow;
  const lampsOn = P >= DECORS[3].u; lampLights.forEach((l) => (l.intensity = lampsOn ? S.lamp * 6 : 0)); M.lamp.emissiveIntensity = lampsOn ? S.lamp * 2.2 : 0;
  const gl = S.lamp; if (groundGlow) { groundGlow.visible = gl > 0; groundGlow.userData.mat.opacity = gl * 0.85; candleMat.emissiveIntensity = gl * 3; groundLights.forEach((l) => (l.intensity = gl * 2.4)); }
  M.petal.emissive.set(timeKey === 'night' ? 0x222018 : 0x000000);
  if (fireflies) fireflies.visible = timeKey !== 'day' && P > 0.6;
  if (ernest) ernest.setPose(timeKey === 'night' ? 'lanterne' : P > 0.05 ? 'arrose' : 'attend');
}
export function setTime(k) { timeKey = k; applyTime(); }

export function mount(canvas, opts = {}) {
  onFps = opts.onFps || null; configure(opts.serre);
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(58, 1, 0.05, 120);
  hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffffff, 2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 0.5, far: 40 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; scene.add(sun); scene.add(sun.target);
  sky = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: col('#000') }, bot: { value: col('#000') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ gl_FragColor = vec4(mix(bot, top, clamp(vP.y * 1.3 + 0.1, 0.0, 1.0)), 1.0); }' }));
  scene.add(sky);
  { const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshStandardMaterial({ color: 0x40552f, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground); }
  buildHall(scene);
  for (const it of plan()) addPlant(it);
  buildPools(); buildDecor();
  { // lucioles (soir, nuit, serre bien avancée)
    const n = 60, pos = new Float32Array(n * 3), r = rngOf(3); for (let i = 0; i < n; i++) pos.set([(r() - 0.5) * 7, 0.4 + r() * 2.6, (r() - 0.5) * 13], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    fireflies = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffe08a, size: 0.05, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(fireflies);
  }
  ernest = createErnest({ scale: 0.36, lanternShadow: false }); ernest.root.position.set(0.55, 0, 1.3); ernest.root.rotation.y = -2.1; scene.add(ernest.root); ernest.attach(scene);
  controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.target.set(0, 1.3, -2); controls.minDistance = 0.8; controls.maxDistance = 9; controls.maxPolarAngle = Math.PI * 0.62; controls.enablePan = true; controls.screenSpacePanning = false;
  camera.position.set(0.3, 1.7, 5.3);
  const resize = () => { const w = canvas.clientWidth, h = canvas.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < h ? 68 : 55; camera.updateProjectionMatrix(); };
  window.addEventListener('resize', resize); resize();
  setProgress(opts.progress ?? 0.5);
  let last = performance.now(), frames = 0, acc = 0;
  renderer.setAnimationLoop(() => {
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; frames++; acc += dt; if (acc > 1 && onFps) { onFps(Math.round(frames / acc)); frames = 0; acc = 0; }
    controls.update();
    // rester dans la serre
    const c = camera.position; c.x = Math.max(-HALL.w + 0.35, Math.min(HALL.w - 0.35, c.x)); c.z = Math.max(-D + 0.35, Math.min(D + 1.5, c.z)); const maxY = HALL.wall + Math.sqrt(Math.max(0, HALL.w * HALL.w - c.x * c.x)) - 0.3; c.y = Math.max(0.3, Math.min(maxY, c.y));
    controls.target.x = Math.max(-HALL.w + 0.3, Math.min(HALL.w - 0.3, controls.target.x)); controls.target.z = Math.max(-D + 0.3, Math.min(D, controls.target.z)); controls.target.y = Math.max(0.2, Math.min(4.5, controls.target.y));
    const t = now / 1000;
    if (water) water.material.color.setHSL(0.5, 0.3, 0.32 + Math.sin(t * 1.3) * 0.02);
    if (decorObjs.horloge && decorObjs.horloge.visible) { const d = new Date(), [hh, mh] = decorObjs.horloge.userData.hands; mh.rotation.z = -(d.getMinutes() / 60) * Math.PI * 2; hh.rotation.z = -((d.getHours() % 12) / 12 + d.getMinutes() / 720) * Math.PI * 2; }
    if (chime && decorObjs.carillon && decorObjs.carillon.visible) chime.forEach((p, i) => { p.rotation.z = Math.sin(t * 1.1 + i) * 0.08; p.rotation.x = Math.cos(t * 0.9 + i * 2) * 0.06; });
    if (fireflies && fireflies.visible) { fireflies.material.opacity = 0.6 + Math.sin(t * 3) * 0.3; fireflies.rotation.y = Math.sin(t * 0.05) * 0.2; }
    ernest.update(dt, { lantern: timeKey === 'night', lanternK: 2.0, groundY: 0, still: true });
    renderer.render(scene, camera);
  });
  return { setProgress, setTime, camera, controls, renderer, scene };
}
export function setVariegated(on) { variegated = on; }
export function stats(p) {
  const it = plan(); const seen = {}; let ground = 0;
  for (const x of it) { const w = waterings(x, p); if (!w) continue; seen[x.id] = Math.max(seen[x.id] || 0, w); if (!x.nursery && p >= x.ground) ground++; }
  return { species: SPECIES.filter((s) => p >= s.u).length, best: seen, ground, decors: DECORS.filter((d) => p >= d.u).length, waterings: it.reduce((a, x) => a + waterings(x, p), 0) };
}
export function events(p0, p1) { // ce qui s'est passé entre deux positions du curseur (vers l'avant seulement)
  const out = []; if (p1 <= p0) return out;
  for (const s of SPECIES) if (s.u > p0 && s.u <= p1) out.push(`Nouvelle espèce au catalogue : ${s.nom.toLowerCase()}.`);
  const firstGround = {}; for (const x of plan()) if (!x.nursery && (firstGround[x.id] === undefined || x.ground < firstGround[x.id])) firstGround[x.id] = x.ground;
  for (const [id, g] of Object.entries(firstGround)) if (g > p0 && g <= p1) out.push(`${SP[id].nom} : pleine terre. Ernest rempote la plante et la taille.`);
  for (const d of DECORS) if (d.u > p0 && d.u <= p1) out.push(`Troc avec Ernest : ${d.nom.toLowerCase()} contre ${d.prix} graines.`);
  if (p0 < 1 && p1 >= 1) out.push(SERRE.fin);
  return out;
}
