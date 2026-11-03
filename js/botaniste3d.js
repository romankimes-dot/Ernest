// Maquette : la serre Bien-être, de vide à accomplie (docs/PROGRESSION.md).
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
function monsteraGeo() { // cœur fendu, troué, posé à plat puis courbé
  const s = new THREE.Shape(), N = 40;
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI * 2, r = 0.5 * (1 - 0.18 * Math.cos(a)) * (1 - 0.32 * Math.pow(Math.max(0, Math.cos(a - Math.PI / 2)), 30)), x = Math.cos(a) * r * 0.95, y = Math.sin(a) * r + 0.5; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  for (const [x, y, rx, ry] of [[0.2, 0.62, 0.05, 0.1], [-0.2, 0.62, 0.05, 0.1], [0.3, 0.4, 0.04, 0.08], [-0.3, 0.4, 0.04, 0.08], [0.18, 0.25, 0.03, 0.06], [-0.18, 0.25, 0.03, 0.06]]) {
    const h = new THREE.Path(); h.absellipse(x, y, rx, ry, 0, Math.PI * 2, false, 0); s.holes.push(h);
  }
  const g = new THREE.ShapeGeometry(s, 10); g.rotateX(-Math.PI / 2); g.scale(1, 1, -1);
  const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const z = pos.getZ(i), x = pos.getX(i); pos.setY(i, -0.35 * z * z - 0.25 * x * x); }
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
  needle: [leafGeo(0.18, 1, { bend: 0.05, fold: 0, seg: 3 }), M.leaf], monstera: [monsteraGeo(), M.waxy], frond: [frondGeo(), M.leaf], aloe: [aloeG, M.waxy],
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
const G = {
  thym(r) { const L = []; for (let i = 0; i < 46; i++) { const y = r() * 6.28, d = 0.04 + r() * 0.18, h = 0.08 + r() * 0.16, a = d / 0.25, b = V(Math.cos(y) * d * 0.4, 0, Math.sin(y) * d * 0.4), t = V(Math.cos(y) * d, h, Math.sin(y) * d); stemPart(L, b, t, 0.004, vary('#6d7a4a', r), a * 0.6);
    for (let k = 0; k < 7; k++) { const p = b.clone().lerp(t, 0.3 + k * 0.1); leafAt(L, 'leaf', p, r() * 6.28, 0.2 + r() * 0.6, 0.035, vary('#7d9a5e', r, 0.12), a * 0.6 + 0.1); }
    if (r() < 0.5) part(L, 'petal5', t, [0, r() * 6, 0], 0.012, vary('#c7a6d8', r), 0.85); } return L; },
  basilic(r) { const L = []; for (let s = 0; s < 5; s++) { const y = s * 1.26 + r() * 0.4, lean = 0.15 + r() * 0.2, top = V(Math.cos(y) * lean * 0.5, 0.32 + r() * 0.1, Math.sin(y) * lean * 0.5); stemPart(L, V(), top, 0.008, vary('#5d8c3a', r), s * 0.08);
    for (let k = 0; k < 5; k++) { const t = 0.25 + k * 0.17, p = V().lerp(top, t); for (const side of [0, Math.PI]) leafAt(L, 'round', p, y + side + k * 1.57, 0.25 - k * 0.05, 0.11 - k * 0.012, vary('#4f9a35', r, 0.1), t * 0.7 + s * 0.05); } } return L; },
  romarin(r) { const L = []; for (let s = 0; s < 14; s++) { const y = r() * 6.28, lean = r() * 0.25, h = 0.35 + r() * 0.3, top = V(Math.cos(y) * lean, h, Math.sin(y) * lean), a = r() * 0.5; stemPart(L, V(Math.cos(y) * 0.03, 0, Math.sin(y) * 0.03), top, 0.006, vary('#6a7050', r), a);
    for (let k = 0; k < 16; k++) { const p = V().lerp(top, 0.15 + k * 0.053); leafAt(L, 'needle', p, r() * 6.28, 0.5 + r() * 0.5, 0.075, vary('#5e7d62', r, 0.08), a + k * 0.02); }
    if (r() < 0.6) for (let k = 0; k < 3; k++) part(L, 'petal5', V().lerp(top, 0.7 + k * 0.1).add(V(0.01, 0, 0)), [0.4, r() * 6, 0], 0.014, vary('#8fa8e0', r), 0.88); } return L; },
  camomille(r) { const L = []; for (let s = 0; s < 34; s++) { const y = r() * 6.28, d = r() * 0.16, h = 0.18 + r() * 0.2, b = V(Math.cos(y) * d * 0.3, 0, Math.sin(y) * d * 0.3), t = V(Math.cos(y) * d, h, Math.sin(y) * d), a = r() * 0.5; stemPart(L, b, t, 0.0035, vary('#6f9a4a', r), a);
    leafAt(L, 'needle', b.clone().lerp(t, 0.3), r() * 6, 0.3, 0.07, vary('#7aa255', r), a); if (r() < 0.75) { part(L, 'daisy', t, [0, r() * 6, 0], 0.022, vary('#f6f3ea', r, 0.03), 0.65 + r() * 0.3); part(L, 'ball', t.clone().add(V(0, 0.004, 0)), [0, 0, 0], [0.008, 0.005, 0.008], col('#e8b52a'), 0.7); } } return L; },
  aloes(r) { const L = []; const n = 13; for (let i = 0; i < n; i++) { const y = i * 2.4 + r() * 0.3, ring = i / n; part(L, 'aloe', V(), [-(0.25 + ring * 0.9), y, 0], [1, 0.7 + (1 - ring) * 0.6, 1], vary('#6f9b84', r, 0.08), ring * 0.6); }
    for (let i = 0; i < 2; i++) { const y = r() * 6, d = 0.12 + r() * 0.08; part(L, 'aloe', V(Math.cos(y) * d, 0, Math.sin(y) * d), [-0.4, y, 0], 0.45, vary('#7aa58c', r), 0.85); } return L; },
  fougere(r, big = true) { const L = [], H = big ? 2.1 : 0.0; let p = V();
    if (big) for (let i = 0; i < 14; i++) { const n = p.clone().add(V(Math.sin(i * 0.5) * 0.02, H / 14, Math.cos(i * 0.4) * 0.015)); stemPart(L, p, n, 0.09 - i * 0.003, vary('#4a3a2a', r, 0.05), i / 14 * 0.7); p = n; }
    const crown = p.clone(); for (let i = 0; i < 16; i++) { const y = i * 2.4, pitch = 0.5 - (i % 3) * 0.25; leafAt(L, 'frond', crown, y, pitch, big ? 1.5 + r() * 0.3 : 0.5, vary('#4f8d3e', r, 0.1), 0.4 + (i / 16) * 0.5); }
    if (big) for (let i = 0; i < 8; i++) leafAt(L, 'frond', V(0, 0.05, 0), i * 0.8 + r(), 0.2, 0.7, vary('#5a9a47', r), 0.2 + r() * 0.3); return L; },
  monstera(r, o = {}) { const L = [], vg = o.variegated; for (let i = 0; i < 17; i++) { const y = i * 2.4 + r() * 0.4, lean = 0.2 + (i % 4) * 0.12, len = 0.7 + r() * 0.7, a = i / 17 * 0.85, top = V(Math.cos(y) * lean * len, len * (0.75 + r() * 0.35), Math.sin(y) * lean * len);
      stemPart(L, V(0, 0.05, 0), top, 0.016, vary('#5d7f3a', r), a); const c = vg && r() < 0.35 ? vary('#b9cf98', r, 0.05) : vary('#2f6a2b', r, 0.08); leafAt(L, 'monstera', top, y + (r() - 0.5) * 0.6, -0.2 + r() * 0.3, 0.45 + len * 0.3, c, a + 0.05, (r() - 0.5) * 0.4); }
    for (let i = 0; i < 4; i++) { const y = r() * 6, a = V(Math.cos(y) * 0.3, 0.6, Math.sin(y) * 0.3); stemPart(L, a, V(Math.cos(y) * 0.45, 0, Math.sin(y) * 0.45), 0.008, col('#7a5f3e'), 0.8); } return L; },
  citronnier(r) { const L = []; stemPart(L, V(), V(0.03, 1.0, 0), 0.05, col('#5b4636'), 0); const tops = [];
    for (let i = 0; i < 6; i++) { const y = i * 1.05, t = V(Math.cos(y) * 0.42, 1.25 + r() * 0.35, Math.sin(y) * 0.42); stemPart(L, V(0.03, 0.95, 0), t, 0.022, col('#5b4636'), 0.15); tops.push(t); }
    for (let i = 0; i < 260; i++) { const y = r() * 6.28, el = r() * 1.3 - 0.35, R = 0.45 + r() * 0.2, p = V(Math.cos(y) * Math.cos(el) * R + 0.03, 1.4 + Math.sin(el) * R * 0.8, Math.sin(y) * Math.cos(el) * R); leafAt(L, 'leaf', p, y + (r() - 0.5), 0.2 + r() * 0.5, 0.11 + r() * 0.04, vary('#2d5b2a', r, 0.1), 0.2 + r() * 0.6); }
    for (let i = 0; i < 18; i++) { const y = r() * 6.28, el = r() * 0.8 - 0.4, R = 0.55, p = V(Math.cos(y) * R * Math.cos(el), 1.35 + Math.sin(el) * R * 0.8, Math.sin(y) * R * Math.cos(el)); part(L, 'ball', p, [0, 0, 0], [0.045, 0.06, 0.045], vary('#f0cf35', r, 0.05), 0.82 + r() * 0.15); }
    for (let i = 0; i < 14; i++) { const y = r() * 6.28, p = V(Math.cos(y) * 0.6, 1.5 + (r() - 0.5) * 0.6, Math.sin(y) * 0.6); part(L, 'star', p, [r(), y, 0], 0.025, col('#fbf8ee'), 0.75); } return L; },
  // Lianes et tombantes : un chemin (liste de points), la croissance suit la longueur.
  liane(r, path, o) { const L = [], N = path.length - 1;
    for (let i = 0; i < N; i++) { const a = path[i], b = path[i + 1], t = i / N; stemPart(L, a, b, 0.012, vary('#5b4a32', r), t * 0.95);
      for (const side of [1, -1]) { const yaw = (a.x > 0 ? -Math.PI / 2 : Math.PI / 2) + side * (0.6 + r() * 0.8); leafAt(L, o.leaf, a.clone().add(V(0, 0, side * 0.03)), yaw, -0.3 + r() * 0.9, o.s * (0.75 + r() * 0.5), vary(o.c, r, 0.12), t * 0.95 + 0.02);
        if (o.flower && r() < 0.5) part(L, 'star', a.clone().add(V((r() - 0.5) * 0.06, -0.02, (r() - 0.5) * 0.06)), [r() - 0.5, r() * 6, 0], 0.028, col(o.flower), Math.min(0.99, t * 0.95 + 0.15)); } } return L; },
  tombante(r, o) { const L = []; for (let s = 0; s < 22; s++) { const y = s * 0.29 + r() * 0.3, len = 0.4 + r() * 1.1, out = 0.12 + r() * 0.12; let p = V(Math.cos(y) * out, 0.1, Math.sin(y) * out);
      for (let k = 0; k < 14; k++) { const t = k / 14, n = p.clone().add(V(Math.cos(y) * 0.05 * (1 - t) ** 2, -len / 14 * (0.3 + t), Math.sin(y) * 0.05 * (1 - t) ** 2)); stemPart(L, p, n, 0.003, vary('#557038', r), t * 0.9);
        for (const sd of [1, -1]) leafAt(L, o.leaf, n, y + sd * (0.9 + r() * 0.8), -0.5 - r() * 0.7, o.s * (0.8 + r() * 0.4), vary(o.c, r, 0.12), t * 0.9 + 0.04, 0); if (o.flower && k % 3 === 2 && r() < 0.7) part(L, 'petal5', n.clone().add(V(Math.cos(y) * 0.04, 0, Math.sin(y) * 0.04)), [-0.9, y, 0], 0.035, vary(o.flower, r, 0.1), Math.min(0.99, t * 0.9 + 0.2)); p = n; } } return L; },
  semis(r, o) { const L = []; const n = 3 + Math.floor(r() * 3); for (let i = 0; i < n; i++) { const y = r() * 6.28, h = 0.08 + r() * 0.1, t = V(Math.cos(y) * 0.02, h, Math.sin(y) * 0.02); stemPart(L, V(), t, 0.004, col('#6a8f42'), i / n * 0.5); leafAt(L, o.leaf, t, y, 0.3, o.s * 0.6, vary(o.c, r, 0.1), i / n * 0.5 + 0.2); leafAt(L, o.leaf, t, y + 3.14, 0.3, o.s * 0.6, vary(o.c, r, 0.1), i / n * 0.5 + 0.25); } return L; },
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

// ---------- Le plan de la serre Bien-être : emplacements typés et calendrier de la démonstration ----------
// u : moment du déblocage (0..1 sur l'année montrée) ; chaque emplacement est semé, rempoté (pleine terre), puis grandit.
export const SPECIES = [
  { id: 'thym', nom: 'Thym', latin: 'Thymus vulgaris', type: 'Massif', u: 0.0, debloque: 'Au départ' },
  { id: 'basilic', nom: 'Basilic', latin: 'Ocimum basilicum', type: 'Massif', u: 0.02, debloque: 'Au départ' },
  { id: 'romarin', nom: 'Romarin', latin: 'Salvia rosmarinus', type: 'Massif', u: 0.1, debloque: '1 plante en pleine terre' },
  { id: 'aloes', nom: 'Aloès', latin: 'Aloe vera', type: 'Rocaille', u: 0.17, debloque: '5 graines' },
  { id: 'camomille', nom: 'Camomille', latin: 'Matricaria chamomilla', type: 'Massif', u: 0.24, debloque: '2 plantes en pleine terre' },
  { id: 'lierre', nom: 'Lierre', latin: 'Hedera helix', type: 'Liane', u: 0.31, debloque: '8 graines' },
  { id: 'tradescantia', nom: 'Misère', latin: 'Tradescantia zebrina', type: 'Tombante', u: 0.38, debloque: '3 plantes en pleine terre' },
  { id: 'fougere', nom: 'Fougère arborescente', latin: 'Dicksonia antarctica', type: 'Géante', u: 0.45, debloque: '12 graines' },
  { id: 'capucine', nom: 'Capucine', latin: 'Tropaeolum majus', type: 'Tombante', u: 0.52, debloque: '5 plantes en pleine terre' },
  { id: 'jasmin', nom: 'Jasmin étoilé', latin: 'Trachelospermum jasminoides', type: 'Liane', u: 0.59, debloque: '15 graines' },
  { id: 'citronnier', nom: 'Citronnier', latin: 'Citrus limon', type: 'Géante', u: 0.66, debloque: '7 plantes en pleine terre' },
  { id: 'monstera', nom: 'Monstera', latin: 'Monstera deliciosa', type: 'Géante', u: 0.73, debloque: '25 graines', rare: 'Variante panachée : une chance sur dix à la pleine terre' },
];
export const DECORS = [
  { id: 'arrosoir', nom: 'Arrosoir de cuivre', prix: 3, u: 0.12 },
  { id: 'etiquettes', nom: 'Étiquettes de botaniste', prix: 4, u: 0.28 },
  { id: 'banc', nom: 'Banc de jardin', prix: 6, u: 0.42 },
  { id: 'lanternes', nom: 'Lanternes', prix: 8, u: 0.55 },
  { id: 'bassin', nom: 'Bassin et fontaine', prix: 12, u: 0.68 },
  { id: 'carillon', nom: 'Carillon', prix: 5, u: 0.82 },
];
const SP = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
const D = HALL.d;
const BASKETS = [[-1.3, -4.2], [1.3, -4.2], [-1.3, -1.2], [1.3, -1.2], [-1.3, 1.9], [1.3, 1.9]];
const MASSIF = [['thym', 'basilic', 'thym'], ['basilic', 'thym', 'basilic'], ['romarin', 'camomille', 'romarin'], ['camomille', 'romarin', 'camomille'], ['camomille', 'camomille', 'romarin']];
const PLAN = [];
{ const r = rngOf(31); MASSIF.forEach((row, j) => row.forEach((id, i) => PLAN.push([id, -2.9 + i * 0.75 + (r() - 0.5) * 0.2, -1.0 - j * 0.7 + (r() - 0.5) * 0.2]))); }
PLAN.push(['aloes', 1.35, -1.1], ['aloes', 2.15, -1.5], ['aloes', 2.9, -1.0], ['aloes', 1.7, -2.3], ['aloes', 2.75, -2.55], ['aloes', 1.45, -3.3], ['aloes', 2.4, -3.4],
  ['fougere', -2.45, -4.9], ['fougere', 2.75, -4.3], ['citronnier', 1.65, -5.15], ['monstera', 0, -5.2],
  ['lierre', -1, RIB_Z[1]], ['jasmin', -1, RIB_Z[3]], ['lierre', -1, RIB_Z[5]], ['jasmin', -1, RIB_Z[7]], ['jasmin', 1, RIB_Z[1]], ['lierre', 1, RIB_Z[3]], ['jasmin', 1, RIB_Z[5]], ['lierre', 1, RIB_Z[7]],
  ['tradescantia', ...BASKETS[0]], ['capucine', ...BASKETS[1]], ['capucine', ...BASKETS[2]], ['tradescantia', ...BASKETS[3]], ['capucine', ...BASKETS[4]], ['tradescantia', ...BASKETS[5]]);
const GS = { thym: 1.9, basilic: 1.6, romarin: 1.7, camomille: 1.8, aloes: 1.25 };
const LEAFY = { lierre: { leaf: 'ivy', c: '#2f5a2c', s: 0.3 }, jasmin: { leaf: 'leaf', c: '#2f6a32', s: 0.2, flower: '#fbf7ec' }, tradescantia: { leaf: 'leaf', c: '#6d5a8c', s: 0.1 }, capucine: { leaf: 'round', c: '#6fa04a', s: 0.11, flower: '#ef7a22' } };
const BENCH = []; for (const s of [-1, 1]) for (let i = 0; i < 10; i++) for (const row of [0, 1]) BENCH.push(V(s * (HALL.w - 0.62) + (row - 0.5) * 0.36 + (i % 2) * 0.04 * s, 0.85, 0.9 + i * 0.48 + row * 0.2));
BENCH.sort((a, b) => b.z - a.z); // d'abord près de la porte

export function plan() {
  const items = [];
  // emplacements du plan : semé à u + petit décalage, pleine terre 12 % plus tard, adulte 22 % après
  const per = {}; PLAN.forEach(([id, x, z], i) => { const k = (per[id] = (per[id] || 0) + 1) - 1, sp = SP[id], sow = Math.min(0.86, sp.u + k * 0.02), ground = sow + 0.1; items.push({ i, id, x, z, sow, ground, full: Math.min(1, ground + 0.2) }); });
  // pépinière qui continue : quelques semis tardifs qui restent en pot
  const extra = ['basilic', 'thym', 'capucine', 'romarin', 'jasmin', 'camomille', 'lierre', 'basilic', 'aloes', 'tradescantia', 'monstera', 'thym', 'citronnier', 'camomille', 'fougere', 'basilic', 'capucine', 'aloes', 'romarin', 'monstera', 'jasmin', 'thym'];
  extra.forEach((id, k) => items.push({ i: 100 + k, id, sow: Math.max(SP[id].u, 0.3 + k * 0.03), ground: 9, full: 9, nursery: true }));
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
const potPool = []; // pots de l'établi et des suspensions (réserve 'pot')

function buildPools() {
  const counts = {}; for (const pl of plants) for (const pc of [...pl.parts, ...(pl.seedParts || [])]) counts[pc.pool] = (counts[pc.pool] || 0) + 1;
  counts.pot = (counts.pot || 0) + BENCH.length + 6; counts.moss = (counts.moss || 0) + 260; counts.stone = (counts.stone || 0) + 60; counts.stem = (counts.stem || 0) + 8;
  for (const [k, [geo, mat]] of Object.entries(POOLS)) { const n = counts[k] || 1, im = new THREE.InstancedMesh(geo, mat, n); im.count = 0; im.castShadow = k !== 'moss' && k !== 'petal5' && k !== 'daisy' && k !== 'star'; im.receiveShadow = true; im.frustumCulled = false; im.setColorAt(0, col('#fff')); scene.add(im); pools[k] = { im, n: 0 }; }
}

function addPlant(it) {
  const r = rngOf(1000 + it.i * 977), sp = it.id; let parts, base, ground;
  const o = LEAFY[sp];
  if (sp === 'lierre' || sp === 'jasmin') { const side = it.x, z = it.z, path = []; const off = rngOf(it.i);
    for (let k = 0; k <= 120; k++) { const q = ribPoint(side, z, Math.min(0.97, k / 120)); const n = V(-q.x, HALL.wall - q.y, 0).normalize(); if (q.y < HALL.wall) n.set(-side, 0, 0); q.addScaledVector(n, 0.14); q.z += Math.sin(k * 0.7) * 0.07 + (off() - 0.5) * 0.03; path.push(q); }
    parts = G.liane(r, path, o); ground = { pos: V(), ry: 0, s: 1, bed: true };
  } else if (o) { parts = G.tombante(r, o); ground = { pos: V(it.x, 3.05, it.z), ry: r() * 6, s: 1, basket: true }; }
  else { parts = G[sp](r, { variegated: sp === 'monstera' && variegated }); ground = { pos: V(it.x, 0.22, it.z), ry: r() * 6, s: sp === 'monstera' ? 1.25 : GS[sp] || 1 }; }
  const seedParts = o ? G.semis(rngOf(it.i + 5), o) : null;
  plants.push({ it, parts, seedParts, ground });
}

const _M = new THREE.Matrix4(), _P = new THREE.Matrix4(), _S = new THREE.Matrix4(), _c = new THREE.Color(), HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
function push(pool, m, c) { const p = pools[pool]; if (!p || p.n >= p.im.instanceMatrix.count) return; p.im.setMatrixAt(p.n, m); p.im.setColorAt(p.n, c); p.n++; }
function emit(parts, g, mat) {
  for (const pc of parts) { const k = smooth(pc.a, pc.a + 0.12, g); if (k <= 0.001) continue; _S.makeScale(k, k, k); _M.multiplyMatrices(mat, pc.m).multiply(_S); push(pc.pool, _M, pc.c); }
}
const POTC = [col('#b8693f'), col('#a65d3a'), col('#c47a52')], BASKET_C = col('#6b4a2a'), CHAIN_C = col('#2a2a26');
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
  const rs = rngOf(9); for (let i = 0; i < 40; i++) { const x = 1.05 + rs() * 2.1, z = -0.8 - rs() * 2.9, s = 0.06 + rs() * 0.12; if (P < SP.aloes.u + 0.05) continue; _P.compose(V(x, 0.22, z), _q.setFromEuler(_e.set(rs(), rs() * 6, 0)), _s.set(s * 1.4, s * 0.8, s)); push('stone', _P, vary('#b9ad98', rs, 0.08)); }
  for (const k in pools) { const pl = pools[k]; pl.im.count = pl.n; pl.im.instanceMatrix.needsUpdate = true; if (pl.im.instanceColor) pl.im.instanceColor.needsUpdate = true; }
  // décors
  for (const d of DECORS) if (decorObjs[d.id]) decorObjs[d.id].visible = P >= d.u;
  labelMeshes.forEach(({ m, it }) => (m.visible = P >= DECORS[1].u && P >= it.ground));
  applyTime();
}

function buildDecor() {
  const wood = new THREE.MeshStandardMaterial({ color: 0x6e5034, roughness: 0.8 });
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
    g.position.set(-1.25, 0, 0.1); g.rotation.y = Math.PI / 2; scene.add(g); decorObjs.banc = g;
  }
  { // lanternes suspendues
    const g = new THREE.Group();
    for (const z of [-3.4, -0.2, 3.2]) { const l = new THREE.Group(); const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 6), M.lamp); l.add(cage);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.1, 6), M.iron); cap.position.y = 0.18; l.add(cap); const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 3.2, 4), M.iron); ch.position.y = 1.75; l.add(ch);
      l.position.set(0, 3.2, z); g.add(l); lampMeshes.push(cage); const pl = new THREE.PointLight(0xffb866, 0, 7, 1.6); pl.position.set(0, 3.05, z); g.add(pl); lampLights.push(pl); }
    scene.add(g); decorObjs.lanternes = g;
  }
  { // bassin et fontaine au croisement
    const g = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 8, 36), new THREE.MeshStandardMaterial({ color: 0xa79f90, roughness: 0.85 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; ring.castShadow = ring.receiveShadow = true; g.add(ring);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.2, 36, 1, true), ring.material); wall.position.y = 0.1; g.add(wall);
    water = new THREE.Mesh(new THREE.CircleGeometry(0.58, 36), M.water); water.rotation.x = -Math.PI / 2; water.position.y = 0.16; g.add(water);
    const col1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.65, 10), ring.material); col1.position.y = 0.35; g.add(col1);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), ring.material); bowl.position.y = 0.82; bowl.material.side = THREE.DoubleSide; g.add(bowl);
    const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.03, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xcfe9ee, transparent: true, opacity: 0.6, roughness: 0.1 })); jet.position.y = 0.9; g.add(jet);
    for (let i = 0; i < 6; i++) { const lily = new THREE.Mesh(new THREE.CircleGeometry(0.09, 10, 0.4, 5.6), new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 0.5, side: THREE.DoubleSide })); lily.rotation.x = -Math.PI / 2; const a = i * 1.1; lily.position.set(Math.cos(a) * 0.38, 0.17, Math.sin(a) * 0.36); g.add(lily); }
    g.position.set(0, 0, -2.6); scene.add(g); decorObjs.bassin = g;
  }
  { // carillon près de la porte
    const g = new THREE.Group(); chime = [];
    for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18 + i * 0.05, 6), M.copper); const piv = new THREE.Group(); t.position.y = -(0.09 + i * 0.025); piv.add(t); const a = (i / 5) * 6.28; piv.position.set(Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06); g.add(piv); chime.push(piv); }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12), wood); g.add(top); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.6, 4), M.iron); st.position.y = 0.3; g.add(st);
    g.position.set(0.55, 2.6, D - 0.5); scene.add(g); decorObjs.carillon = g;
  }
  // étiquettes plantées devant les emplacements du plan
  const lab = new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.7 });
  for (const pl of plants) { const { it } = pl; if (it.nursery || pl.ground.basket || pl.ground.bed) continue; const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.012), lab); m.position.set(it.x + 0.22 * Math.sign(-it.x || 1), 0.3, it.z + 0.3); m.rotation.set(-0.3, 0, 0); m.castShadow = true; scene.add(m); labelMeshes.push({ m, it }); }
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
  M.petal.emissive.set(timeKey === 'night' ? 0x222018 : 0x000000);
  if (fireflies) fireflies.visible = timeKey !== 'day' && P > 0.6;
  if (ernest) ernest.setPose(timeKey === 'night' ? 'lanterne' : P > 0.05 ? 'arrose' : 'attend');
}
export function setTime(k) { timeKey = k; applyTime(); }

export function mount(canvas, opts = {}) {
  onFps = opts.onFps || null;
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
    if (chime && decorObjs.carillon.visible) chime.forEach((p, i) => { p.rotation.z = Math.sin(t * 1.1 + i) * 0.08; p.rotation.x = Math.cos(t * 0.9 + i * 2) * 0.06; });
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
  if (p0 < 1 && p1 >= 1) out.push('La serre Bien-être est accomplie. Une monstera panachée est apparue.');
  return out;
}
