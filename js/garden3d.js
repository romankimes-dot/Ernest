// La serre en 3D, branchée sur les données d'Ernest.
// three.js 0.160 (embarqué dans vendor/), tout est généré par code. Une seule serre par page.
// Correspondance : une chose faite = une plante dans le rang de sa catégorie (Révision : fleurs et lavande,
// Corps : succulentes, Esprit : fougères, Cuisine : aromatiques, Boulot : grandes feuilles, Perso : graminées) ;
// la croissance suit les jours actifs ; les entrées de liste font la mousse ; un objectif = le bonsaï du fond,
// une branche par étape ; le total fait monter les grimpantes et descendre les suspensions ; l'humeur règle la
// lumière et trois jours gris font sortir des champignons. L'heure réelle fait le jour, le soir et la nuit.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { svg as ernestSvg } from './ernest.js';
import { growth, totalDone, moodAvg, catCounts, activeDays } from './model.js';

// ---------- Outils ----------
const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const lerp = (a, b, t) => a + (b - a) * t;
const UP = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();
const col = (h) => new THREE.Color(h);
const vary = (c, rng, amt = 0.08) => { const o = c.clone(); const hsl = {}; o.getHSL(hsl); o.setHSL(hsl.h + (rng() - 0.5) * amt * 0.5, Math.min(1, hsl.s + (rng() - 0.5) * amt), Math.min(1, hsl.l + (rng() - 0.5) * amt)); return o; };

// ---------- Scène ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x08131c, 20, 75);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
let renderer = null, controls = null;
// ---------- Lumières ----------
const hemi = new THREE.HemisphereLight(0xbfe3f0, 0x3a3020, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.position.set(6, 10, 5); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -8; sun.shadow.camera.right = 8; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; sun.shadow.camera.far = 30; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02; sun.shadow.radius = 7;
scene.add(sun);

// ---------- Ciel, étoiles, sol extérieur ----------
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: col('#0a1a2a') }, bottom: { value: col('#10251f') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, glow: { value: col('#ffd9a0') }, glowK: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 glow; uniform float glowK; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.15,0.0,1.0); vec3 c = mix(bottom, top, h); float g = max(dot(normalize(vP), normalize(sunDir)), 0.0); c += glow * (pow(g, 12.0) * 0.9 + pow(g, 3.0) * 0.25) * glowK; c += glow * pow(1.0 - abs(vP.y), 6.0) * 0.18 * glowK; gl_FragColor = vec4(c, 1.0); }',
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(95, 24, 12), skyMat));
const starsGeo = new THREE.BufferGeometry(); { const r = rngOf(7), p = []; for (let i = 0; i < 500; i++) { const th = r() * Math.PI * 2, ph = r() * 1.3; p.push(70 * Math.sin(ph) * Math.cos(th), 70 * Math.cos(ph) + 4, 70 * Math.sin(ph) * Math.sin(th)); } starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xefe6d2, size: 0.18, sizeAttenuation: true, transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
scene.add(stars);
const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf4ecd8, fog: false }));
moon.position.set(-22, 26, -40); scene.add(moon);

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

// ---------- Dehors : relief, prairie au vent, arbres, chemin, muret ----------
// Bruit de valeur 2D (déterministe) et somme d'octaves.
const hash2 = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v); };
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3) * 0.17;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Plat autour de la serre et du chemin, des collines au-delà.
function heightAt(x, z) {
  const r = Math.hypot(x, z * 0.8), pathD = Math.abs(x - pathX(z)) * (z > 6 ? 1 : 9);
  const flat = smooth(9, 26, r) * smooth(1.2, 4, pathD + (z < 6 ? 99 : 0));
  return flat * (fbm(x * 0.045 + 3.1, z * 0.045 + 7.7) * 9 - 1.2) + (fbm(x * 0.3, z * 0.3) - 0.5) * 0.12 * smooth(7, 10, r);
}
const pathX = (z) => Math.sin((z - 6.6) * 0.16) * 1.6 * smooth(6.6, 12, z);
// Saison réelle : couleurs de l'herbe et des feuillages.
const MONTH = new Date().getMonth() + 1;
const SEASON = MONTH <= 2 || MONTH === 12 ? 'hiver' : MONTH <= 5 ? 'printemps' : MONTH <= 8 ? 'ete' : 'automne';
const PAL = {
  hiver: { grass: ['#5d6b4a', '#6f7a5c', '#4f5d42'], leaves: null, flowers: ['#efe6d2'] },
  printemps: { grass: ['#5f9a45', '#76ad52', '#4f8a3e'], leaves: ['#8fc06a', '#a8d07a', '#f2c6d8'], flowers: ['#f2c6d8', '#f4efe6', '#f2d24a', '#9ec8f0'] },
  ete: { grass: ['#6d9a3d', '#88a84a', '#5a8a36'], leaves: ['#4f8a3a', '#3f7a32', '#6a9a42'], flowers: ['#f2d24a', '#e86f8a', '#f4efe6', '#c7a6e8'] },
  automne: { grass: ['#7a7f3e', '#8c8a48', '#6b7038', '#9a8a4a'], leaves: ['#c9772e', '#d9a03a', '#a8452a', '#b8862e', '#8a9a3a'], flowers: ['#d9a03a', '#c7a6e8', '#f4efe6'] },
}[SEASON];

const outdoor = new THREE.Group(); scene.add(outdoor);
// Étape 4 : emplacements du potager (un carré par catégorie) et de la seconde serre. L'herbe s'efface sous eux quand ils apparaissent.
const BED_CATS = ['revision', 'corps', 'esprit', 'cuisine', 'boulot', 'perso'];
const BEDS = [[-5.6, 0.8], [-5.6, 3.6], [-5.6, 6.4], [5.6, 1.3], [5.6, 4.1], [5.6, 6.9]].map(([x, z]) => ({ x, z, hx: 0.6, hz: 1.15 }));
const SERRE2 = { x: 8.6, z: 4.6, hx: 1.25, hz: 1.6 };
const ZONES = [...BEDS, SERRE2];
const zoneAt = (x, z, m = 0.12) => ZONES.findIndex((b) => Math.abs(x - b.x) < b.hx + m && Math.abs(z - b.z) < b.hz + m);
const zoneU = { value: new Array(ZONES.length).fill(0) };
// Terrain
{
  const g = new THREE.PlaneGeometry(190, 190, 150, 150); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, colors = [], r = rngOf(21), base = PAL.grass.map(col);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = Math.abs(x) < GW + 0.3 && Math.abs(z) < GD + 0.3 ? -0.02 : heightAt(x, z);
    p.setY(i, y - 0.03);
    const c = base[Math.floor(fbm(x * 0.12, z * 0.12) * base.length * 1.4) % base.length].clone().offsetHSL(0, 0, (r() - 0.5) * 0.04 + y * 0.004);
    const dp = Math.abs(x - pathX(z)); if (z > GD && dp < 0.9) c.lerp(col('#8a7a5a'), 0.55 * (1 - dp / 0.9));
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); m.receiveShadow = true; outdoor.add(m);
}
// Prairie : des milliers de brins qui ondulent (vent calculé dans le shader)
const windU = { value: 0 };
const ext = { beds: [], serre2: null };
{
  const blade = new THREE.BufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.03, 0, 0, 0.03, 0, 0, -0.02, 0.35, 0, 0.02, 0.35, 0, 0, 0.7, 0], 3));
  blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]); blade.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(15).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); // normales vers le ciel : brins fondus dans le pré
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windU; sh.uniforms.uZone = zoneU;
    sh.vertexShader = `uniform float uTime;\nuniform float uZone[${ZONES.length}];\nattribute float aZone;\n` + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
      float k = position.y * position.y * 1.6;
      float w = sin(uTime * 1.7 + ip.x * 0.35 + ip.z * 0.22) * 0.6 + sin(uTime * 3.1 + ip.x * 1.3) * 0.25;
      transformed.x += w * k * 0.35; transformed.z += w * k * 0.18;
      if (aZone > -0.5) transformed *= 1.0 - uZone[int(aZone + 0.5)];`);
  };
  const N = 24000, im = new THREE.InstancedMesh(blade, mat, N), r = rngOf(33), base = PAL.grass.map(col), aZone = new Float32Array(N); let k = 0;
  for (let i = 0; i < N * 3 && k < N; i++) {
    const a = r() * Math.PI * 2, d = 4.5 + Math.pow(r(), 0.7) * 34, x = Math.cos(a) * d, z = Math.sin(a) * d * 1.15;
    if (Math.abs(x) < GW + 0.4 && Math.abs(z) < GD + 0.4) continue;
    if (z > GD && Math.abs(x - pathX(z)) < 0.85) continue;
    dummy.position.set(x, heightAt(x, z) - 0.03, z); dummy.rotation.set((r() - 0.5) * 0.3, r() * 6.28, 0); const s = 0.45 + r() * 0.5; dummy.scale.set(0.9, s * (0.55 + r() * 0.45), 0.9); dummy.updateMatrix();
    aZone[k] = zoneAt(x, z); im.setMatrixAt(k, dummy.matrix); im.setColorAt(k, base[Math.floor(r() * base.length)].clone().offsetHSL(0, (r() - 0.5) * 0.04, (r() - 0.5) * 0.035 + 0.02)); k++;
  }
  blade.setAttribute('aZone', new THREE.InstancedBufferAttribute(aZone, 1)); im.count = k; im.receiveShadow = true; outdoor.add(im);
  // fleurs sauvages
  const F = SEASON === 'hiver' ? 0 : 900, fm = new THREE.InstancedMesh(GEO_BALL_SMALL(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), Math.max(1, F)); let f = 0;
  for (let i = 0; i < F * 3 && f < F; i++) { const a = r() * 6.28, d = 6 + r() * 24, x = Math.cos(a) * d, z = Math.sin(a) * d; if (Math.abs(x) < GW + 0.5 && Math.abs(z) < GD + 0.5) continue; if (z > GD && Math.abs(x - pathX(z)) < 1) continue; if (zoneAt(x, z, 0.3) >= 0) continue; if (fbm(x * 0.2, z * 0.2) < 0.5) continue;
    dummy.position.set(x, heightAt(x, z) + 0.25 + r() * 0.2, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.035 + r() * 0.03); dummy.updateMatrix(); fm.setMatrixAt(f, dummy.matrix); fm.setColorAt(f++, col(PAL.flowers[Math.floor(r() * PAL.flowers.length)])); }
  fm.count = f; outdoor.add(fm); ext.flowers = { im: fm, n: f, cur: 0.5, target: 0.5 };
}
function GEO_BALL_SMALL() { return new THREE.IcosahedronGeometry(1, 0); }
// Chemin de dalles jusqu'à la porte, et la porte
{
  const r = rngOf(44), n = 46, m = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.06, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), n);
  for (let i = 0; i < n; i++) { const z = GD + 0.5 + i * 0.55, x = pathX(z) + (i % 2 ? 0.22 : -0.22) + (r() - 0.5) * 0.12; dummy.position.set(x, heightAt(x, z) + 0.01, z); dummy.rotation.set(0, r() * 3, 0); dummy.scale.set(0.3 + r() * 0.08, 1, 0.24 + r() * 0.06); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, vary(col('#9a927e'), r, 0.1)); }
  m.receiveShadow = true; outdoor.add(m); ext.stones = { im: m, n, cur: 8, target: 8 };
  const doorM = new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.6, metalness: 0.4 });
  for (const x of [-0.6, 0.6]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.1, 0.07), doorM); post.position.set(x, 1.05, GD + 0.02); outdoor.add(post); }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(1.27, 0.07, 0.07), doorM); lintel.position.set(0, 2.1, GD + 0.02); outdoor.add(lintel);
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.5), M.stone); step.position.set(0, 0.06, GD + 0.3); step.receiveShadow = true; outdoor.add(step);
}
// Muret de pierres sèches autour du jardin, ouvert sur le chemin
{
  const r = rngOf(55), stones = [], R = 12.5;
  for (let a = 0; a < Math.PI * 2; a += 0.045) {
    const x = Math.cos(a) * R, z = Math.sin(a) * R * 1.2; if (z > 8 && Math.abs(x - pathX(z)) < 1.3) continue;
    for (let l = 0; l < 3; l++) stones.push([x + (r() - 0.5) * 0.2, heightAt(x, z) + 0.12 + l * 0.17, z + (r() - 0.5) * 0.2, 0.17 + r() * 0.08 - l * 0.02]);
  }
  const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), stones.length);
  stones.forEach(([x, y, z, s], i) => { dummy.position.set(x, y, z); dummy.rotation.set(r() * 3, r() * 3, r() * 3); dummy.scale.set(s * 1.3, s * 0.8, s); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, vary(col('#8a8474'), r, 0.12)); });
  m.castShadow = m.receiveShadow = true; outdoor.add(m);
}
// Potager : un carré en bois par catégorie, qui sort de terre quand la catégorie a assez servi, puis se remplit.
function crop(cat, r) {
  const g = new THREE.Group(), add = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy ?? sx, sz ?? sx); m.castShadow = true; g.add(m); return m; };
  const ball = new THREE.IcosahedronGeometry(1, 1), cone = new THREE.ConeGeometry(1, 1, 6), stick = new THREE.CylinderGeometry(1, 1, 1, 5);
  const leafM = (h) => new THREE.MeshStandardMaterial({ color: vary(col(h), r, 0.1), roughness: 0.8, flatShading: true });
  if (cat === 'revision') { const pur = new THREE.MeshStandardMaterial({ color: vary(col('#8a6ac8'), r, 0.1), roughness: 0.7 }); add(ball, leafM('#7a9a7a'), 0, 0.08, 0, 0.14, 0.09); for (let i = 0; i < 7; i++) { const a = i * 0.9, d = 0.04 + r() * 0.05; add(stick, M.stem, Math.cos(a) * d, 0.2, Math.sin(a) * d, 0.006, 0.28); add(cone, pur, Math.cos(a) * d, 0.38, Math.sin(a) * d, 0.022, 0.11); } }
  else if (cat === 'corps') { add(stick, M.wood, 0, 0.3, 0, 0.012, 0.6); add(ball, leafM('#3f7a32'), 0, 0.28, 0, 0.13, 0.22); const red = new THREE.MeshStandardMaterial({ color: 0xc8382a, roughness: 0.4 }); for (let i = 0; i < 4; i++) add(ball, red, (r() - 0.5) * 0.18, 0.15 + r() * 0.25, (r() - 0.5) * 0.18, 0.035); }
  else if (cat === 'esprit') { const m = leafM('#8fc06a'); for (let i = 0; i < 5; i++) add(ball, m, (r() - 0.5) * 0.14, 0.06 + r() * 0.06, (r() - 0.5) * 0.14, 0.06 + r() * 0.03, 0.05); }
  else if (cat === 'cuisine') { add(ball, leafM('#9ab87a'), 0, 0.1, 0, 0.16, 0.11); add(ball, leafM('#c8d8a0'), 0, 0.15, 0, 0.09, 0.08); }
  else if (cat === 'boulot') { const m = leafM('#5a9a3a'); for (let i = 0; i < 5; i++) { const a = i * 1.26; const c = add(cone, m, Math.cos(a) * 0.03, 0.14, Math.sin(a) * 0.03, 0.03, 0.26); c.rotation.set(Math.sin(a) * 0.4, 0, Math.cos(a) * 0.4); } add(cone, new THREE.MeshStandardMaterial({ color: 0xe0782a, roughness: 0.6 }), 0, 0.01, 0, 0.035, 0.05).rotation.x = Math.PI; }
  else { add(stick, M.stem, 0, 0.3, 0, 0.012, 0.6); const head = add(ball, new THREE.MeshStandardMaterial({ color: 0xf2c23a, roughness: 0.6 }), 0, 0.62, 0.02, 0.09, 0.03, 0.09); head.rotation.x = 1.2; add(ball, M.woodDark, 0, 0.62, 0.045, 0.04, 0.015, 0.04).rotation.x = 1.2; add(ball, leafM('#4f8a3a'), 0, 0.25, 0, 0.07, 0.03, 0.1); }
  return g;
}
BEDS.forEach((b, bi) => {
  const r = rngOf(900 + bi), g = new THREE.Group(), y = heightAt(b.x, b.z);
  const plank = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), M.wood); m.position.set(x, 0.15, z); m.castShadow = m.receiveShadow = true; g.add(m); };
  plank(b.hx * 2 + 0.08, 0.08, 0, -b.hz); plank(b.hx * 2 + 0.08, 0.08, 0, b.hz); plank(0.08, b.hz * 2, -b.hx, 0); plank(0.08, b.hz * 2, b.hx, 0);
  const soil = new THREE.Mesh(new THREE.BoxGeometry(b.hx * 2, 0.26, b.hz * 2), M.soil); soil.position.y = 0.13; soil.receiveShadow = true; g.add(soil);
  const crops = [];
  for (let i = 0; i < 10; i++) { const c = crop(BED_CATS[bi], r); c.position.set((i % 2 ? 0.25 : -0.25) + (r() - 0.5) * 0.06, 0.26, -b.hz + 0.24 + Math.floor(i / 2) * (b.hz * 2 - 0.48) / 4); c.rotation.y = r() * 6.28; c.scale.setScalar(0.001); g.add(c); crops.push(c); }
  g.position.set(b.x, y - 0.32, b.z); g.visible = false; outdoor.add(g);
  ext.beds.push({ g, crops, y, rise: 0, riseT: 0, grow: 0, growT: 0 });
});
// Seconde serre : arrive après un an de jours actifs.
{
  const s = SERRE2, g = new THREE.Group(), H = 1.5, R = 2.1;
  const bar = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.frame); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  for (const x of [-s.hx, s.hx]) for (const z of [-s.hz, s.hz]) bar(0.05, H, 0.05, x, H / 2, z);
  for (const z of [-s.hz, 0, s.hz]) { bar(s.hx * 2, 0.05, 0.05, 0, H, z); bar(s.hx * 2, 0.05, 0.05, 0, 0.3, z); }
  bar(0.05, 0.05, s.hz * 2, 0, R, 0);
  const base = new THREE.Mesh(new THREE.BoxGeometry(s.hx * 2, 0.3, s.hz * 2), M.stone); base.position.y = 0.15; base.receiveShadow = true; g.add(base);
  const pane = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); };
  pane(s.hx * 2, H - 0.3, 0, (H + 0.3) / 2, -s.hz, 0); pane(s.hx * 2, H - 0.3, 0, (H + 0.3) / 2, s.hz, 0); pane(s.hz * 2, H - 0.3, -s.hx, (H + 0.3) / 2, 0, Math.PI / 2); pane(s.hz * 2, H - 0.3, s.hx, (H + 0.3) / 2, 0, Math.PI / 2);
  const slope = Math.hypot(s.hx, R - H), ang = Math.atan2(R - H, s.hx);
  for (const side of [-1, 1]) { const gp = new THREE.Group(), m = new THREE.Mesh(new THREE.PlaneGeometry(slope, s.hz * 2), M.glass); m.rotation.x = -Math.PI / 2; gp.add(m); gp.rotation.z = -side * ang; gp.position.set(side * s.hx / 2, (H + R) / 2, 0); g.add(gp);
    const e = bar(slope, 0.05, 0.05, side * s.hx / 2, (H + R) / 2, -s.hz); e.rotation.z = side * -ang; const f = bar(slope, 0.05, 0.05, side * s.hx / 2, (H + R) / 2, s.hz); f.rotation.z = side * -ang; }
  const lamp = new THREE.PointLight(0xffc070, 0, 4, 1.8); lamp.position.set(0, 1.2, 0); g.add(lamp); g.userData.light = lamp;
  const r = rngOf(4242); for (let i = 0; i < 6; i++) { const c = crop(BED_CATS[i], r); c.position.set((i % 2 ? 0.55 : -0.55), 0.3, -1.0 + Math.floor(i / 2) * 1.0); c.scale.setScalar(1.6); g.add(c); }
  g.position.set(s.x, heightAt(s.x, s.z) - 0.05, s.z); g.scale.setScalar(0.001); g.visible = false; outdoor.add(g);
  ext.serre2 = { g, cur: 0, target: 0 };
}
// Arbres : conifères et feuillus aux couleurs de la saison, buissons
{
  const r = rngOf(66), trunks = [], cones = [], blobs = [], bushes = [];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = 23 + Math.pow(r(), 0.8) * 30, x = Math.cos(a) * d, z = Math.sin(a) * d * 1.1;
    if (z > 8 && Math.abs(x - pathX(z)) < 4) continue;
    const y = heightAt(x, z), conifer = r() < 0.45, H = (conifer ? 4.5 : 3.6) * (0.7 + r() * 0.7);
    trunks.push([x, y, z, conifer ? 0.16 : 0.2, H * (conifer ? 0.35 : 0.55)]);
    if (conifer) for (let l = 0; l < 4; l++) cones.push([x, y + H * (0.25 + l * 0.18), z, H * (0.32 - l * 0.06), H * 0.36, r()]);
    else for (let b = 0; b < 5; b++) blobs.push([x + (r() - 0.5) * H * 0.4, y + H * (0.6 + r() * 0.3), z + (r() - 0.5) * H * 0.4, H * (0.22 + r() * 0.12), r()]);
  }
  for (let i = 0; i < 60; i++) { const a = r() * 6.28, x = Math.cos(a) * (11 + r() * 3), z = Math.sin(a) * (11 + r() * 3) * 1.2; if (z > 8 && Math.abs(x - pathX(z)) < 2) continue; bushes.push([x, heightAt(x, z) + 0.25, z, 0.35 + r() * 0.35, r()]); }
  const tm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1, 1, 10), M.bark, trunks.length);
  trunks.forEach(([x, y, z, rad, h], i) => { dummy.position.set(x, y + h / 2, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(rad, h, rad); dummy.updateMatrix(); tm.setMatrixAt(i, dummy.matrix); });
  const cm = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), cones.length);
  cones.forEach(([x, y, z, rad, h, v], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0, v * 6, 0); dummy.scale.set(rad, h, rad); dummy.updateMatrix(); cm.setMatrixAt(i, dummy.matrix); cm.setColorAt(i, col(['#2f5a3a', '#3a6a40', '#28503a'][Math.floor(v * 3)])); });
  const leafy = PAL.leaves || ['#6b5a4a'];
  const bm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), blobs.length);
  blobs.forEach(([x, y, z, s, v], i) => { dummy.position.set(x, y, z); dummy.rotation.set(v * 3, v * 5, 0); dummy.scale.set(s * 1.1, s * 0.85, s * 1.1); dummy.updateMatrix(); bm.setMatrixAt(i, dummy.matrix); bm.setColorAt(i, col(leafy[Math.floor(v * leafy.length)])); });
  bm.visible = !!PAL.leaves;
  const um = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), bushes.length);
  bushes.forEach(([x, y, z, s, v], i) => { dummy.position.set(x, y, z); dummy.rotation.set(v, v * 4, 0); dummy.scale.set(s * 1.3, s * 0.8, s); dummy.updateMatrix(); um.setMatrixAt(i, dummy.matrix); um.setColorAt(i, vary(col(SEASON === 'automne' ? '#7a6a3a' : '#3f6a3a'), rngOf(i), 0.15)); });
  for (const m of [tm, cm, bm, um]) { m.castShadow = true; m.receiveShadow = true; outdoor.add(m); }
}


// ---------- Ciel et vie du dehors ----------
const skyLife = { sunDir: new THREE.Vector3(0, 1, 0) };
const softTex = (draw, w = 128, h = 128) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
// soleil : un halo
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex((x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,250,235,1)'); g.addColorStop(0.18, 'rgba(255,236,190,.95)'); g.addColorStop(0.4, 'rgba(255,200,120,.25)'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
sunSprite.scale.setScalar(22); scene.add(sunSprite);
// nuages : des taches douces qui dérivent
const cloudTex = softTex((x, w, h) => { const r = rngOf(8); for (let i = 0; i < 14; i++) { const cx = w * (0.15 + r() * 0.7), cy = h * (0.45 + (r() - 0.5) * 0.3), rr = h * (0.18 + r() * 0.2); const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); } }, 256, 128);
const clouds = [];
{ const r = rngOf(12); for (let i = 0; i < 16; i++) { const m = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.8 }); const sp = new THREE.Sprite(m); const a = r() * Math.PI * 2, d = 45 + r() * 30, sc = 18 + r() * 22; sp.scale.set(sc, sc * 0.45, 1); sp.position.set(Math.cos(a) * d, 20 + r() * 16, Math.sin(a) * d); clouds.push({ sp, a, d, v: 0.004 + r() * 0.006 }); scene.add(sp); } }
// brume du matin : des voiles bas
const mist = [];
{ const tex = softTex((x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const r = rngOf(14); for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })); const a = r() * 6.28, d = 14 + r() * 18; sp.position.set(Math.cos(a) * d, 0.8 + r() * 1.2, Math.sin(a) * d); sp.scale.set(16 + r() * 10, 3 + r() * 2, 1); mist.push(sp); scene.add(sp); } }

// La maison d'Ernest : pierre, toit, fenêtre qui s'allume le soir, cheminée qui fume
const cottage = new THREE.Group(); scene.add(cottage);
const windowMat = new THREE.MeshStandardMaterial({ color: 0x2a2116, emissive: 0xffb85c, emissiveIntensity: 0.2 });
{
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x9a907c, roughness: 1, flatShading: true }), roofM = new THREE.MeshStandardMaterial({ color: 0x6b3a2a, roughness: 0.9, flatShading: true }), woodM = M.woodDark;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.7, 2.1), stoneM); body.position.y = 0.85; cottage.add(body);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 1.85, 1.2, 4, 1), roofM); roof.rotation.y = Math.PI / 4; roof.scale.set(1.15, 1, 0.95); roof.position.y = 2.25; cottage.add(roof);
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.1, 0.32), stoneM); chim.position.set(0.7, 2.6, -0.4); cottage.add(chim);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.05, 0.06), woodM); door.position.set(-0.55, 0.53, 1.06); cottage.add(door);
  for (const x of [0.55]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.06), windowMat); w.position.set(x, 1.05, 1.06); cottage.add(w); const sill = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.06, 0.14), woodM); sill.position.set(x, 0.82, 1.1); cottage.add(sill); }
  const side = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.45), windowMat); side.position.set(1.31, 1.05, 0.2); cottage.add(side);
  const winLight = new THREE.PointLight(0xffb070, 0, 5, 1.8); winLight.position.set(0.5, 1.1, 1.5); cottage.add(winLight); cottage.userData.light = winLight;
  // tas de bois et banc
  for (let i = 0; i < 9; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6), M.bark); l.rotation.x = Math.PI / 2; l.position.set(-1.6 + (i % 3) * 0.15, 0.08 + Math.floor(i / 3) * 0.13, -0.3 + (i % 2) * 0.05); cottage.add(l); }
  cottage.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const cx = -8.6, cz = -6.2; cottage.position.set(cx, heightAt(cx, cz), cz); cottage.rotation.y = 0.75;
}
const smoke = [];
{ const tex = softTex((x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(230,226,215,.7)'); g.addColorStop(1, 'rgba(230,226,215,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const base = new THREE.Vector3(0.7, 3.2, -0.4); cottage.updateMatrixWorld(); base.applyMatrix4(cottage.matrixWorld);
  for (let i = 0; i < 12; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); smoke.push({ sp, t: i / 12, base }); scene.add(sp); } }
// La mare : eau, nénuphars, roseaux
{
  const px = 7.6, pz = -3.8, py = heightAt(px, pz);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshStandardMaterial({ color: 0x2f5f6a, roughness: 0.08, metalness: 0.65 })); water.rotation.x = -Math.PI / 2; water.scale.set(1, 0.7, 1); water.position.set(px, py + 0.02, pz); water.receiveShadow = true; scene.add(water);
  const r = rngOf(15), pads = new THREE.InstancedMesh(new THREE.CircleGeometry(0.16, 10, 0.3, Math.PI * 1.85), new THREE.MeshStandardMaterial({ color: 0x4f8a4a, roughness: 0.7, side: THREE.DoubleSide }), 7);
  for (let i = 0; i < 7; i++) { dummy.position.set(px + (r() - 0.5) * 2, py + 0.04, pz + (r() - 0.5) * 1.2); dummy.rotation.set(-Math.PI / 2, 0, r() * 6); dummy.scale.setScalar(0.8 + r() * 0.6); dummy.updateMatrix(); pads.setMatrixAt(i, dummy.matrix); }
  scene.add(pads);
  const reeds = new THREE.InstancedMesh(new THREE.ConeGeometry(0.02, 1, 3), new THREE.MeshStandardMaterial({ color: 0x6b7a3a, roughness: 1 }), 60);
  for (let i = 0; i < 60; i++) { const a = r() * 6.28; dummy.position.set(px + Math.cos(a) * (1.6 + r() * 0.35), py + 0.4, pz + Math.sin(a) * (1.1 + r() * 0.3)); dummy.rotation.set((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3); dummy.scale.set(1, 0.6 + r() * 0.7, 1); dummy.updateMatrix(); reeds.setMatrixAt(i, dummy.matrix); }
  scene.add(reeds);
}
// Oiseaux le jour
const birds = [];
{ const wingG = new THREE.BufferGeometry(); wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.08, 0, 0, 0.1, 0.42, 0, 0.02], 3)); wingG.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a, side: THREE.DoubleSide });
  const r = rngOf(16); for (let i = 0; i < 9; i++) { const g = new THREE.Group(); const L = new THREE.Mesh(wingG, mat), R = new THREE.Mesh(wingG, mat); R.scale.x = -1; g.add(L, R); scene.add(g); birds.push({ g, L, R, a: r() * 6.28, rad: 14 + r() * 14, h: 9 + r() * 7, v: 0.12 + r() * 0.08, ph: r() * 6 }); } }
// Papillons le jour
const flutters = [];
{ const wg = new THREE.PlaneGeometry(0.09, 0.07); wg.translate(0.045, 0, 0);
  const r = rngOf(17), cols = SEASON === 'automne' ? ['#d9a03a', '#c9772e', '#f4efe6'] : ['#f2d24a', '#9ec8f0', '#f4efe6', '#e86f8a'];
  for (let i = 0; i < (SEASON === 'hiver' ? 0 : 12); i++) { const m = new THREE.MeshBasicMaterial({ color: col(cols[i % cols.length]), side: THREE.DoubleSide }); const g = new THREE.Group(); const L = new THREE.Mesh(wg, m), R = new THREE.Mesh(wg, m); R.rotation.y = Math.PI; g.add(L, R); scene.add(g);
    const a = r() * 6.28, d = 5 + r() * 6; flutters.push({ g, L, R, cx: Math.cos(a) * d, cz: Math.sin(a) * d * 1.1, ph: r() * 10, sp: 0.4 + r() * 0.4 }); } }
// Lucioles du dehors
const outFlies = (() => {
  const n = 80, pos = new Float32Array(n * 3), seed = [], r = rngOf(18);
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = 5 + r() * 9; seed.push([Math.cos(a) * d, 0.3 + r() * 1.4, Math.sin(a) * d * 1.15, r() * 10, 0.2 + r() * 0.4]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.14, map: softTex((x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,240,170,1)'); g.addColorStop(0.3, 'rgba(242,190,61,.6)'); g.addColorStop(1, 'rgba(242,178,61,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }, 64, 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  scene.add(pts); return { pts, pos, seed, n };
})();

function updateLife(a, t, dt, sd, hour) {
  const dayF = Math.max(0, Math.min(1, (sd.y + 0.05) * 5));
  // soleil et lune
  sunSprite.position.copy(sd).multiplyScalar(80); sunSprite.material.opacity = Math.max(0, Math.min(1, (sd.y + 0.08) * 6)); sunSprite.visible = sunSprite.material.opacity > 0.01;
  sunSprite.material.color.set(sd.y < 0.15 ? '#ffb070' : '#fff1d6');
  // nuages : teinte selon l'heure
  const tint = col(a.top).lerp(col('#ffffff'), 0.35 + dayF * 0.55); if (sd.y > -0.1 && sd.y < 0.2) tint.lerp(col('#ffb48a'), 0.45);
  for (const c of clouds) { c.a += c.v * dt; c.sp.position.x = Math.cos(c.a) * c.d; c.sp.position.z = Math.sin(c.a) * c.d; c.sp.material.color.copy(tint); c.sp.material.opacity = 0.35 + dayF * 0.5; }
  // brume du matin, de l'aube à 10 h
  const { rise } = sunTimes(), mf = Math.max(0, 1 - Math.abs(hour - (rise + 1.2)) / 2.2) * 0.55;
  for (const m of mist) { m.material.opacity = mf; m.visible = mf > 0.01; m.material.color.set(a.fog); }
  // maison : fenêtre et fumée
  const night = 1 - dayF; windowMat.emissiveIntensity = 0.2 + night * 2.2; cottage.userData.light.intensity = night * 3; ext.serre2.g.userData.light.intensity = night * 2.5 * ext.serre2.cur;
  for (const s of smoke) { s.t = (s.t + dt * 0.08) % 1; const k = s.t; s.sp.position.set(s.base.x + Math.sin(k * 6 + t * 0.3) * 0.3 + k * 1.2, s.base.y + k * 4, s.base.z - k * 0.6); s.sp.scale.setScalar(0.4 + k * 1.8); s.sp.material.opacity = (1 - k) * 0.45 * (0.6 + night * 0.4); s.sp.material.color.set(night > 0.5 ? '#8a8a90' : '#e6e2d7'); }
  // oiseaux
  for (const b of birds) { b.g.visible = dayF > 0.4; if (!b.g.visible) continue; b.a += b.v * dt; b.g.position.set(Math.cos(b.a) * b.rad, b.h + Math.sin(t * 0.5 + b.ph) * 0.8, Math.sin(b.a) * b.rad); b.g.rotation.y = -b.a; const f = Math.sin(t * 9 + b.ph) * 0.6; b.L.rotation.z = f; b.R.rotation.z = -f; }
  // papillons
  for (const f of flutters) { f.g.visible = dayF > 0.5; if (!f.g.visible) continue; const k = t * f.sp + f.ph; const x = f.cx + Math.sin(k) * 1.4 + Math.sin(k * 2.3) * 0.4, z = f.cz + Math.cos(k * 0.8) * 1.2; f.g.position.set(x, heightAt(x, z) + 0.45 + Math.sin(k * 3) * 0.25, z); f.g.rotation.y = k; const w = Math.sin(t * 18 + f.ph) * 1.1; f.L.rotation.y = w; f.R.rotation.y = Math.PI - w; }
  // lucioles du dehors
  outFlies.pts.material.opacity = a.flies; outFlies.pts.visible = a.flies > 0.02;
  if (outFlies.pts.visible) { for (let i = 0; i < outFlies.n; i++) { const [x, y, z, ph, sp] = outFlies.seed[i]; outFlies.pos[i * 3] = x + Math.sin(t * sp + ph) * 0.8; outFlies.pos[i * 3 + 1] = heightAt(x, z) + y + Math.sin(t * sp * 1.6 + ph) * 0.3; outFlies.pos[i * 3 + 2] = z + Math.cos(t * sp * 0.7 + ph) * 0.8; } outFlies.pts.geometry.attributes.position.needsUpdate = true; }
}

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

// ---------- Emplacements ----------
const SPECIES_BY_CAT = { revision: 'flowering', corps: 'succulent', esprit: 'fern', cuisine: 'aromatic', boulot: 'broadleaf', perso: 'grass' };
const SLOTS = [];
{ const t = [];
  for (const s of [1, -1]) for (let i = 0; i < 12; i++) for (const row of [0, 1]) t.push({ x: s * (TABLE_X - 0.25 + row * 0.45), z: GD - 2.1 - i * 0.82 + row * 0.35, y: TABLE_Y + 0.03, i, row, s, floor: false });
  t.sort((a, b) => (a.i - b.i) || (a.row - b.row) || (a.s - b.s));
  SLOTS.push(...t);
  for (const [x, z] of [[1.35, 2.6], [-1.35, 1.2], [1.35, -0.8], [-1.35, -3.2], [1.35, -4.4], [-1.35, 3.9]]) SLOTS.push({ x, z, y: 0, floor: true });
}
const live = new Map(); // id de plante -> { obj, plant, cur, target, phase, sway, slot }
function buildPlant(p, slotIdx) {
  const sl = SLOTS[slotIdx], rng = rngOf(p.seed >>> 0), sp = SPECIES_BY_CAT[p.cat] || 'grass', g = new THREE.Group();
  if (sl.floor) { g.add(makePot(2.1, M.terraDark)); const pl = SPECIES[sp](rng, sp === 'broadleaf' ? 0.95 : 1.2); pl.position.y = 0.42; g.add(pl); g.position.set(sl.x, 0, sl.z); g.rotation.y = rng() * 6; greenhouse.add(g); return { obj: g, plant: pl }; }
  const big = sp === 'broadleaf' ? 1.25 : 1, ps = (0.85 + rng() * 0.35) * big;
  g.add(makePot(ps, rng() < 0.25 ? M.terraDark : M.terra));
  const pl = SPECIES[sp](rng, 0.55 + rng() * 0.35); pl.position.y = 0.19 * ps; g.add(pl);
  g.position.set(sl.x + (rng() - 0.5) * 0.08, sl.y, sl.z + (rng() - 0.5) * 0.08); g.rotation.y = rng() * Math.PI * 2;
  greenhouse.add(g); return { obj: g, plant: pl };
}
// bonsaï du fond : un objectif, une branche par étape franchie
const pedestal = new THREE.Group(); greenhouse.add(pedestal);
{ const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.7, 20), M.stone); ped.position.set(0, 0.35, -GD + 0.9); ped.castShadow = ped.receiveShadow = true; pedestal.add(ped);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.4), M.terraDark); tray.position.set(0, 0.74, -GD + 0.9); pedestal.add(tray); }
let bonsaiObj = null, bonsaiKey = '';
function setBonsai(b) {
  const key = b ? `${b.seed}:${b.branches}` : '';
  if (key === bonsaiKey) return; bonsaiKey = key;
  if (bonsaiObj) { greenhouse.remove(bonsaiObj); bonsaiObj = null; }
  if (!b) return;
  bonsaiObj = bonsai(rngOf(b.seed >>> 0), Math.min(1.45, 0.6 + 0.12 * b.branches)); bonsaiObj.position.set(0, 0.78, -GD + 0.9); greenhouse.add(bonsaiObj);
}
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
  g.add(im); g.position.set(x, y0, z); greenhouse.add(g); g.visible = false; hanging.push({ g, phase: rng() * 10, cur: 0, target: 0 });
});// grimpantes le long des poteaux puis sous le toit
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
const ernestSprite = (() => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  sp.scale.set(0.74, 0.77, 1); sp.position.set(0.42, 0.4, 1.4); scene.add(sp);
  const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 460; c.height = 480; c.getContext('2d').drawImage(img, 0, 0, 460, 480); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; sp.material.map = t; sp.material.needsUpdate = true; };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ernestSvg('lanterne').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  // ombre au sol
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.set(0.42, 0.02, 1.4); sh.scale.setScalar(0.9); scene.add(sh); sp.userData.shadow = sh;
  return sp;
})();

// ---------- Données → scène ----------
// Pure : ce que la serre doit montrer pour un état d'Ernest.
// Dehors : le chemin s'allonge avec le total, un carré de potager par catégorie (dès 8 choses faites), la seconde serre après 365 jours actifs.
export function extFromState(S, n, mood) {
  const keys = Object.keys(S.days), counts = catCounts(S, keys);
  return {
    path: Math.min(1, n / 300),
    beds: BED_CATS.map((c) => ((counts[c] || 0) >= 8 ? Math.min(1, ((counts[c] || 0) - 8) / 60) : -1)),
    flowers: Math.max(0.15, Math.min(1, 0.35 + 0.4 * Math.min(1, n / 150) + (mood === 'high' ? 0.25 : mood === 'low' ? -0.15 : 0))),
    serre2: activeDays(S, keys) >= 365,
  };
}
export function modelFromState(S, today) {
  const ps = S.garden.plants || [];
  const plants = ps.filter((p) => p.kind === 'plant').slice(0, SLOTS.length).map((p) => ({ id: p.id, cat: p.cat, seed: p.seed, g: growth(p, S, today) }));
  const mossN = ps.filter((p) => p.kind === 'moss').length;
  const n = totalDone(S);
  const goalB = ps.filter((p) => p.kind === 'bonsai').sort((a, b) => (b.branches || 0) - (a.branches || 0))[0];
  const mood = moodAvg(S, today);
  return {
    plants, moss: Math.min(1400, mossN * 8 + Math.max(0, n - 30) * 3), vine: Math.min(1, n / 160),
    hanging: [20, 45, 80, 120].filter((k) => n >= k).length, bonsai: goalB ? { seed: goalB.seed, branches: goalB.branches || 0 } : null,
    shrooms: mood === 'low', mood: mood === 'low' ? 1 : mood === 'high' ? 4 : 3,
    ...extFromState(S, n, mood),
  };
}
let model = { plants: [], moss: 0, vine: 0, hanging: 0, bonsai: null, shrooms: false, mood: 3, path: 0, beds: [], flowers: 0.5, serre2: false };
let pop = null;
function applyModel(m) {
  model = m;
  const keep = new Set();
  m.plants.forEach((p, i) => {
    keep.add(p.id);
    let L = live.get(p.id);
    if (!L) { const b = buildPlant(p, i); L = { ...b, cur: 0.001, phase: (p.seed % 1000) / 100, sway: p.cat === 'perso' || p.cat === 'revision' ? 0.05 : 0.025 }; live.set(p.id, L); }
    L.target = 0.35 + 0.65 * p.g;
  });
  for (const [id, L] of live) if (!keep.has(id)) { greenhouse.remove(L.obj); live.delete(id); }
  ext.stones.target = Math.round(8 + (ext.stones.n - 8) * (m.path || 0));
  ext.flowers.target = m.flowers ?? 0.5;
  ext.beds.forEach((b, i) => { const v = m.beds ? m.beds[i] : -1; b.riseT = v >= 0 ? 1 : 0; b.growT = v >= 0 ? 0.25 + 0.75 * v : 0; });
  ext.serre2.target = m.serre2 ? 1 : 0;
  vines.forEach((v, i) => { v.target = Math.max(0, Math.min(1, m.vine * 1.25 - i * 0.08)); });
  moss.target = m.moss;
  hanging.forEach((h, i) => { h.target = i < m.hanging ? 1 : 0; });
  shrooms.forEach((s) => { s.visible = m.shrooms; });
  setBonsai(m.bonsai);
}

// ---------- Ambiances ----------
const TIMES = {
  day: { top: '#7fb8d6', bottom: '#d9e6c8', fog: '#bcd6d0', hemiSky: '#cfe8f2', hemiGround: '#5b4a30', hemi: 1.15, sun: '#fff1d6', sunI: 2.6, sunPos: [6, 10, 5], lantern: 0.6, flies: 0, stars: 0, moon: 0, exposure: 1.0 },
  dusk: { top: '#2a3a5c', bottom: '#e0956a', fog: '#6b5a5a', hemiSky: '#e0a080', hemiGround: '#3a2a1a', hemi: 0.7, sun: '#ffb070', sunI: 1.4, sunPos: [-9, 3.5, 2], lantern: 4, flies: 0.5, stars: 0.3, moon: 0.4, exposure: 1.05 },
  night: { top: '#071321', bottom: '#122a2a', fog: '#08131c', hemiSky: '#34507a', hemiGround: '#12201a', hemi: 0.6, sun: '#9fb8e0', sunI: 0.45, sunPos: [-6, 9, -6], lantern: 7, flies: 1, stars: 1, moon: 1, exposure: 1.1 },
};
const amb = { cur: null, to: null, fixed: null };
// Heure réelle → ambiance, avec fondus à l'aube et au crépuscule.
const DAYLEN = [8.4, 9.9, 11.8, 13.6, 15.2, 16.1, 15.7, 14.3, 12.5, 10.7, 9.1, 8.2];
const NOON = [12.9, 13.1, 13.2, 13.9, 13.8, 13.9, 14.1, 14.0, 13.8, 13.6, 12.7, 12.8];
function sunTimes(d = new Date()) { const m = d.getMonth(), L = DAYLEN[m], n = NOON[m]; return { rise: n - L / 2, set: n + L / 2, maxEl: [0.36, 0.48, 0.66, 0.85, 1.0, 1.1, 1.06, 0.95, 0.78, 0.58, 0.42, 0.33][m] }; }
function sunDirAt(h) {
  const { rise, set, maxEl } = sunTimes(), t = (h - rise) / (set - rise), el = Math.sin(Math.PI * Math.max(-0.15, Math.min(1.15, t))) * maxEl - (t < 0 || t > 1 ? 0.25 : 0), az = Math.PI * t;
  return new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el) - 0.35).normalize();
}
function timeFor(h) {
  const { rise, set } = sunTimes();
  const mix = (a, b, t) => { const o = {}; for (const k of Object.keys(a)) o[k] = typeof a[k] === 'number' ? lerp(a[k], b[k], t) : Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], t)) : '#' + col(a[k]).lerp(col(b[k]), t).getHexString(); return o; };
  const T = TIMES;
  if (h < rise - 1.2 || h >= set + 1.6) return T.night;
  if (h < rise) return mix(T.night, T.dusk, (h - rise + 1.2) / 1.2);
  if (h < rise + 1.2) return mix(T.dusk, T.day, (h - rise) / 1.2);
  if (h < set - 1.2) return T.day;
  if (h < set) return mix(T.day, T.dusk, (h - set + 1.2) / 1.2);
  return mix(T.dusk, T.night, (h - set) / 1.6);
}
const nowHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
function updateAmbience(dt, t) {
  const { set } = sunTimes(), hourSun = amb.fixed ? { day: 13.2, dusk: set - 0.25, night: 23 }[amb.fixed] : nowHour();
  amb.to = amb.fixed ? TIMES[amb.fixed] : timeFor(hourSun);
  if (!amb.cur) amb.cur = JSON.parse(JSON.stringify(amb.to));
  const a = amb.cur, b = amb.to, k = Math.min(1, dt * 2.5);
  for (const key of Object.keys(b)) { if (typeof b[key] === 'number') a[key] = lerp(a[key], b[key], k); else if (Array.isArray(b[key])) a[key] = a[key].map((v, i) => lerp(v, b[key][i], k)); else a[key] = '#' + col(a[key]).lerp(col(b[key]), k).getHexString(); }
  const mood = model.mood, m = 0.75 + mood * 0.09;
  skyMat.uniforms.top.value.set(a.top); skyMat.uniforms.bottom.value.set(a.bottom); scene.fog.color.set(a.fog);
  hemi.color.set(a.hemiSky); hemi.groundColor.set(a.hemiGround); hemi.intensity = a.hemi * m * 1.2;
  const sd = sunDirAt(hourSun); skyLife.sunDir.copy(sd);
  sun.color.set(a.sun); sun.intensity = a.sunI * m * 0.9;
  if (sd.y > 0.02) sun.position.copy(sd).multiplyScalar(16); else sun.position.set(...a.sunPos);
  skyMat.uniforms.sunDir.value.copy(sd); skyMat.uniforms.glowK.value = Math.max(0, Math.min(1, (sd.y + 0.12) * 4)); skyMat.uniforms.glow.value.set(sd.y < 0.18 ? '#ff9a5a' : '#ffe2b0');
  for (const l of lanterns) l.light.intensity = a.lantern * (0.8 + mood * 0.08) * (0.95 + Math.sin(t * 7 + l.g.position.z) * 0.03);
  M.bulb.emissiveIntensity = 0.4 + a.lantern * 0.3;
  moon.position.copy(sd).multiplyScalar(-60).setY(Math.max(18, -sd.y * 60)); flies.mat.opacity = a.flies; stars.material.opacity = a.stars * 0.85; moon.material.opacity = a.moon; moon.material.transparent = true; moon.visible = a.moon > 0.02;
  if (renderer) renderer.toneMappingExposure = a.exposure * (0.9 + mood * 0.04);
  updateLife(a, t, dt, sd, hourSun);
  return a;
}

// ---------- Croissance, vent ----------
function updateGrowth(dt, t) {
  const k = Math.min(1, dt * 2.2);
  for (const L of live.values()) {
    L.cur = lerp(L.cur, L.target, k);
    let s = L.cur; if (pop && pop.obj === L.obj) { const e = (t - pop.t) / 0.9; if (e > 1) pop = null; else s *= 1 + Math.sin(e * Math.PI) * 0.18; }
    L.plant.scale.setScalar(Math.max(0.001, s));
    const w = Math.sin(t * 1.3 + L.phase) * L.sway + Math.sin(t * 2.7 + L.phase * 2) * L.sway * 0.4;
    L.plant.rotation.z = w; L.plant.rotation.x = w * 0.6;
  }
  for (const h of hanging) { h.cur = lerp(h.cur, h.target, k); h.g.visible = h.cur > 0.01; h.g.scale.setScalar(Math.max(0.001, h.cur)); const w = Math.sin(t * 1.3 + h.phase) * 0.03; h.g.rotation.z = w * 0.5; h.g.rotation.x = w * 0.3; }
  for (const v of vines) { v.cur = lerp(v.cur, v.target, k); const tri = Math.floor((v.idx / 3) * v.cur) * 3; v.mesh.geometry.setDrawRange(0, tri); v.im.count = Math.floor(v.n * v.cur); v.mesh.visible = v.cur > 0.01; }
  moss.cur = lerp(moss.cur, moss.target, k); moss.im.count = Math.round(moss.cur);
  { const S = ext.stones; S.cur = lerp(S.cur, S.target, k * 0.6); S.im.count = Math.round(S.cur); const F = ext.flowers; F.cur = lerp(F.cur, F.target, k); F.im.count = Math.round(F.n * F.cur); }
  ext.beds.forEach((b, i) => {
    b.rise = lerp(b.rise, b.riseT, k * 0.7); b.grow = lerp(b.grow, b.riseT > 0 && b.rise > 0.9 ? b.growT : 0, k * 0.8);
    b.g.visible = b.rise > 0.01; b.g.position.y = b.y - 0.32 + 0.32 * b.rise; zoneU.value[i] = b.rise;
    b.crops.forEach((c, j) => { const s = Math.max(0.001, Math.min(1, b.grow * 11 - j) * (0.55 + 0.45 * b.grow)); c.scale.setScalar(s * 1.7); c.rotation.z = Math.sin(t * 1.4 + j + i) * 0.04; });
  });
  { const s2 = ext.serre2; s2.cur = lerp(s2.cur, s2.target, k * 0.5); s2.g.visible = s2.cur > 0.01; s2.g.scale.setScalar(Math.max(0.001, s2.cur)); zoneU.value[ZONES.length - 1] = s2.cur; }
  if (bonsaiObj) { const w = Math.sin(t * 0.9) * 0.006; bonsaiObj.rotation.z = w; }
}

// ---------- Rendu ----------
const clock = new THREE.Clock();
let mode = 'band', running = false, visible = true, last = 0, onFps = null, frames = 0, fpsT = 0;
const BAND = { pos: new THREE.Vector3(1.2, 6.6, 11.8), target: new THREE.Vector3(0, 0.6, 0.8) }; // vue plongeante : toutes les tables visibles
function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  if (!visible) return;
  if (mode === 'band' && now - last < 31) return; // ~30 i/s dans la bande
  last = now;
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  if (mode === 'band') {
    camera.position.copy(BAND.pos); camera.lookAt(BAND.target); // vue fixe : aucun mouvement de caméra dans la bande
  } else { controls.update(); const hy = heightAt(camera.position.x, camera.position.z) + 0.9; if (camera.position.y < hy) camera.position.y = hy; }
  updateAmbience(dt, t); updateGrowth(dt, t); windU.value = t;
  for (let i = 0; i < flies.n; i++) { const [x, y, z, ph, sp] = flies.seed[i]; flies.pos[i * 3] = x + Math.sin(t * sp + ph) * 0.5; flies.pos[i * 3 + 1] = y + Math.sin(t * sp * 1.7 + ph * 2) * 0.25; flies.pos[i * 3 + 2] = z + Math.cos(t * sp * 0.8 + ph) * 0.5; }
  flies.pts.geometry.attributes.position.needsUpdate = true;
  ernestSprite.position.y = 0.4 + Math.sin(t * 1.6) * 0.012;
  renderer.render(scene, camera);
  frames++; fpsT += dt; if (fpsT > 1) { if (onFps) onFps(Math.round(frames / fpsT)); frames = 0; fpsT = 0; }
}
function resize() {
  if (!renderer) return; const c = renderer.domElement, w = c.clientWidth || c.parentElement.clientWidth, h = c.clientHeight || c.parentElement.clientHeight;
  if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}

// ---------- API ----------
export function webglOk() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; } }
// Monte la serre sur un canvas. opts : { mode: 'band' | 'full', onFps }
export function mount(canvas, opts = {}) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; // + radius : bords d'ombre fondus
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = false; controls.minDistance = 2.2; controls.maxDistance = 19;
  controls.maxPolarAngle = Math.PI * 0.49; controls.minPolarAngle = 0.25; controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.8;
  onFps = opts.onFps || null;
  setMode(opts.mode || 'band');
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; if (visible) clock.getDelta(); });
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting && document.visibilityState === 'visible'; if (visible) clock.getDelta(); }).observe(canvas);
  resize(); running = true; requestAnimationFrame(frame);
  return api;
}
export function setMode(m) {
  mode = m;
  if (!renderer) return;
  controls.enabled = m === 'full';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, m === 'full' ? 2 : 1.5));
  ernestSprite.visible = ernestSprite.userData.shadow.visible = m === 'full';
  if (m === 'full') { camera.position.set(1.15, 1.75, 6.3); controls.target.set(0, 1.0, -1.2); camera.fov = 52; }
  else camera.fov = 46;
  camera.updateProjectionMatrix(); controls.update(); resize();
}
export const api = {
  mount, setMode, resize, webglOk, modelFromState,
  update(S, today) { applyModel(modelFromState(S, today)); },
  setModel: applyModel,
  setTime(k) { amb.fixed = k; },
  water() { const last = [...live.values()].pop(); if (last) pop = { obj: last.obj, t: clock.elapsedTime }; },
  stop() { running = false; }, start() { if (!running && renderer) { running = true; clock.getDelta(); requestAnimationFrame(frame); } },
  get camera() { return camera; }, get controls() { return controls; },
};
export default api;
