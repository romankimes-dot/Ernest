// Les trois serres en 3D, branchées sur les données d'Ernest.
// three.js 0.160 (embarqué dans vendor/), tout est généré par code. Trois petites serres en arc devant la chaumière :
// « Travail » (Révision : lavande et fleurs violettes, Boulot : ficus et grandes feuilles), « Bien-être » (Corps :
// succulentes et cactus, Esprit : fougères et mousse, Cuisine : thym, basilic, romarin) et « Vie perso » (fleurs
// des champs et hautes herbes). Une chose faite = une plante dans la serre de sa catégorie ; la croissance suit les
// jours actifs ; dans chaque serre, les entrées de liste font la mousse et le nombre de choses faites fait monter
// les grimpantes et descendre les suspensions ; un objectif actif = un bonsaï au fond de la serre de sa catégorie,
// une branche par étape. L'humeur règle la lumière et trois jours gris font sortir des champignons. L'heure réelle
// fait le jour, le soir et la nuit.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createErnest } from './ernest3d.js';
import { buildCottage } from './cottage3d.js';
import { growth, totalDone, moodAvg, catCounts, catId, floraOf } from './model.js';
import { bonsaiInSerre } from './flore.js';

// ---------- Outils ----------
const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const lerp = (a, b, t) => a + (b - a) * t;
const UP = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();
const col = (h) => new THREE.Color(h);
const vary = (c, rng, amt = 0.08) => { const o = c.clone(); const hsl = {}; o.getHSL(hsl); o.setHSL(hsl.h + (rng() - 0.5) * amt * 0.5, Math.min(1, hsl.s + (rng() - 0.5) * amt), Math.min(1, hsl.l + (rng() - 0.5) * amt)); return o; };

// ---------- Étalonnage : ACES puis un peu de saturation et de contraste (gratuit : dans le tone mapping) ----------
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }',
  'vec3 CustomToneMapping( vec3 color ) { vec3 c = ACESFilmicToneMapping( color ); float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) ); c = mix( vec3( l ), c, 1.16 ); c = mix( c, c * c * ( 3.0 - 2.0 * c ), 0.18 ); return saturate( c ); }');

// ---------- Scène ----------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x08131c, 20, 75);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
let renderer = null, controls = null;
// ---------- Lumières ----------
const hemi = new THREE.HemisphereLight(0xbfe3f0, 0x3a3020, 1.0); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
sun.position.set(6, 10, 5); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -13; sun.shadow.camera.right = 13; sun.shadow.camera.top = 13; sun.shadow.camera.bottom = -13; sun.shadow.camera.far = 40; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02; sun.shadow.radius = 7;
scene.add(sun);

// ---------- Ciel, étoiles, sol extérieur ----------
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: col('#0a1a2a') }, bottom: { value: col('#10251f') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, glow: { value: col('#ffd9a0') }, glowK: { value: 0 } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 glow; uniform float glowK; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.15,0.0,1.0); vec3 c = mix(bottom, top, h); float g = max(dot(normalize(vP), normalize(sunDir)), 0.0); c += glow * (pow(g, 12.0) * 0.9 + pow(g, 3.0) * 0.25) * glowK; c += glow * pow(1.0 - abs(vP.y), 6.0) * 0.18 * glowK; gl_FragColor = vec4(c, 1.0); }',
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(95, 24, 12), skyMat));
// Lumière d'ambiance réfléchie : le ciel (et un sol d'herbe) rendu dans une petite scène à part, puis filtré (PMREM).
// Le verre, la fonte et les pots reflètent le vrai ciel de l'heure ; régénéré seulement quand le ciel change.
const envU = { k: { value: 0.35 }, ground: { value: col('#3c5530') } };
const envSkyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, uniforms: Object.assign({}, skyMat.uniforms, envU), vertexShader: skyMat.vertexShader,
  fragmentShader: skyMat.fragmentShader.replace('uniform vec3 top;', 'uniform float k; uniform vec3 ground; uniform vec3 top;').replace('gl_FragColor = vec4(c, 1.0);', 'c = mix(c, ground, smoothstep(0.02, -0.12, vP.y)); gl_FragColor = vec4(c * k, 1.0);'),
});
const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), envSkyMat));
let pmrem = null, envRT = null, envKey = '', envT = -99;
function refreshEnv(force) {
  if (!renderer) return; const now = performance.now() / 1000; if (!force && now - envT < 1.5) return;
  const u = skyMat.uniforms, key = [u.top.value.getHexString(), u.bottom.value.getHexString(), u.glowK.value.toFixed(2), u.sunDir.value.x.toFixed(2), u.sunDir.value.y.toFixed(2), envU.ground.value.getHexString()].join();
  if (key === envKey) return; envKey = key; envT = now;
  if (!pmrem) pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0, 0.1, 50); scene.environment = rt.texture; if (envRT) envRT.dispose(); envRT = rt;
}
const starsGeo = new THREE.BufferGeometry(); { const r = rngOf(7), p = []; for (let i = 0; i < 500; i++) { const th = r() * Math.PI * 2, ph = r() * 1.3; p.push(70 * Math.sin(ph) * Math.cos(th), 70 * Math.cos(ph) + 4, 70 * Math.sin(ph) * Math.sin(th)); } starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xefe6d2, size: 0.18, sizeAttenuation: true, transparent: true, opacity: 0.8, fog: false, depthWrite: false }));
scene.add(stars);
const moon = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf4ecd8, fog: false }));
moon.position.set(-22, 26, -40); scene.add(moon);

// ---------- Matériaux ----------
const M = {
  frame: new THREE.MeshStandardMaterial({ color: 0xe9e3cf, roughness: 0.6, metalness: 0 }), // fonte peinte crème, à la victorienne
  glass: new THREE.MeshStandardMaterial({ color: 0x8fb3ab, roughness: 0.04, metalness: 0.2, envMapIntensity: 0.4, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false }),
  wood: new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.85 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 }),
  terra: new THREE.MeshStandardMaterial({ color: 0xb4652a, roughness: 0.9 }),
  terraDark: new THREE.MeshStandardMaterial({ color: 0x8e4c1f, roughness: 0.95 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x4a3422, roughness: 1 }),
  gravel: new THREE.MeshStandardMaterial({ color: 0x4a4636, roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x8c8676, roughness: 0.95 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, side: THREE.DoubleSide }),
  leafFlat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }),
  stem: new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.8 }),
  bark: new THREE.MeshStandardMaterial({ color: 0x5b3f26, roughness: 0.95 }),
  bulb: new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xf2b23d, emissiveIntensity: 2.2 }),
  chain: new THREE.MeshStandardMaterial({ color: 0x3a3a34, roughness: 0.6, metalness: 0.7 }),
  cactus: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
};

// ---------- Textures procédurales (canvas) : grain, rouille, terre, gravier, crasse des vitres ----------
const TX = (() => {
  if (typeof document === 'undefined') return null;
  const r = rngOf(808);
  const mk = (w, h, draw, rx = 1, ry = 1) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; };
  const g = (v, a = 1) => `rgba(${v},${v},${v},${a})`;
  const speck = (x, w, h, n, lo, hi, rmin, rmax, a = 0.7) => { for (let i = 0; i < n; i++) { x.fillStyle = g(lo + Math.floor(r() * (hi - lo)), a); x.beginPath(); x.arc(r() * w, r() * h, rmin + r() * (rmax - rmin), 0, 6.29); x.fill(); } };
  const grain = (base, dark, light) => (x, w, h) => { x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const px = r() * w; x.strokeStyle = r() < 0.5 ? dark : light; x.globalAlpha = 0.25 + r() * 0.5; x.lineWidth = 0.5 + r() * 2.2; x.beginPath(); x.moveTo(px, 0); for (let y = 0; y <= h; y += 12) x.lineTo(px + Math.sin(y * 0.04 + i) * 4 * r(), y); x.stroke(); }
    x.globalAlpha = 0.7; for (let i = 0; i < 5; i++) { x.strokeStyle = dark; x.lineWidth = 1.2; const cx = r() * w, cy = r() * h; for (let k = 1; k < 4; k++) { x.beginPath(); x.ellipse(cx, cy, 2 * k, 6 * k, 0, 0, 6.29); x.stroke(); } } x.globalAlpha = 1; };
  const T = {
    wood: mk(128, 256, grain('#d9cbb8', '#6b5440', '#f2e6d4'), 1, 1),
    woodB: mk(128, 256, grain('#9a9a9a', '#3a3a3a', '#d0d0d0'), 1, 1),
    terra: mk(128, 128, (x, w, h) => { x.fillStyle = '#e8d2c0'; x.fillRect(0, 0, w, h); speck(x, w, h, 900, 150, 255, 0.5, 2.2, 0.5); for (let i = 0; i < 14; i++) { x.fillStyle = 'rgba(245,245,235,.35)'; x.beginPath(); x.ellipse(r() * w, r() * h, 6 + r() * 14, 3 + r() * 6, r() * 3, 0, 6.29); x.fill(); } }, 2, 1),
    terraB: mk(128, 128, (x, w, h) => { x.fillStyle = '#888'; x.fillRect(0, 0, w, h); speck(x, w, h, 1100, 40, 220, 0.5, 2, 0.6); }, 2, 1),
    soil: mk(128, 128, (x, w, h) => { x.fillStyle = '#9a8e80'; x.fillRect(0, 0, w, h); speck(x, w, h, 1400, 40, 255, 0.6, 2.6, 0.6); }, 3, 3),
    gravel: mk(256, 256, (x, w, h) => { x.fillStyle = '#6a6458'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 90 + Math.floor(r() * 150); x.fillStyle = `rgb(${v},${v - 4},${v - 12})`; x.beginPath(); x.ellipse(r() * w, r() * h, 1.2 + r() * 3, 1 + r() * 2.4, r() * 3, 0, 6.29); x.fill(); } }, 4, 7),
    stone: mk(128, 128, (x, w, h) => { x.fillStyle = '#c8c4b8'; x.fillRect(0, 0, w, h); speck(x, w, h, 800, 80, 255, 0.5, 2.4, 0.5); for (let i = 0; i < 10; i++) { x.fillStyle = `rgba(${150 + r() * 40},${170 + r() * 40},${90 + r() * 30},.35)`; x.beginPath(); x.arc(r() * w, r() * h, 4 + r() * 12, 0, 6.29); x.fill(); } }, 2, 2),
    // pierre du muret : grain, taches de teinte, fissures, lichens (jaune pâle, gris clair, vert)
    wallStone: mk(256, 256, (x, w, h) => {
      x.fillStyle = '#cfc8b8'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { const v = 170 + Math.floor(r() * 70); x.fillStyle = `rgba(${v},${v - 6},${v - 18},.35)`; x.beginPath(); x.ellipse(r() * w, r() * h, 10 + r() * 40, 6 + r() * 26, r() * 3, 0, 6.29); x.fill(); }
      speck(x, w, h, 4200, 60, 255, 0.4, 1.6, 0.5);
      x.strokeStyle = 'rgba(40,36,30,.7)'; for (let i = 0; i < 7; i++) { x.lineWidth = 0.8 + r() * 1.2; x.beginPath(); let px = r() * w, py = r() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 40; py += (r() - 0.3) * 30; x.lineTo(px, py); } x.stroke(); }
      const lich = ['rgba(222,214,140,.85)', 'rgba(236,234,222,.8)', 'rgba(150,170,96,.75)', 'rgba(200,170,90,.7)'];
      for (let i = 0; i < 26; i++) { const cx = r() * w, cy = r() * h, rad = 3 + r() * 11; x.fillStyle = lich[Math.floor(r() * lich.length)]; for (let k = 0; k < 9; k++) { x.beginPath(); x.arc(cx + (r() - 0.5) * rad * 1.6, cy + (r() - 0.5) * rad * 1.6, rad * (0.25 + r() * 0.45), 0, 6.29); x.fill(); } }
    }, 1, 1),
    wallStoneB: mk(256, 256, (x, w, h) => { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); speck(x, w, h, 5000, 20, 240, 0.4, 2.2, 0.6); x.strokeStyle = 'rgba(0,0,0,.9)'; for (let i = 0; i < 8; i++) { x.lineWidth = 1 + r() * 1.5; x.beginPath(); let px = r() * w, py = r() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.5) * 40; py += (r() - 0.3) * 30; x.lineTo(px, py); } x.stroke(); } }, 1, 1),
    // feuille de buisson : nervure, bord plus sombre
    bushLeaf: mk(64, 64, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#b8b8b8'); g.addColorStop(0.5, '#f4f4f4'); g.addColorStop(1, '#b8b8b8'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,230,.95)'; x.lineWidth = 2; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke(); x.lineWidth = 1; x.strokeStyle = 'rgba(255,255,230,.6)'; for (let y = 8; y < h; y += 10) { x.beginPath(); x.moveTo(w / 2, y); x.lineTo(6, y - 9); x.moveTo(w / 2, y); x.lineTo(w - 6, y - 9); x.stroke(); } speck(x, w, h, 90, 150, 230, 0.4, 1.2, 0.4); }),
    stoneB: mk(128, 128, (x, w, h) => { x.fillStyle = '#888'; x.fillRect(0, 0, w, h); speck(x, w, h, 1200, 30, 230, 0.5, 2.6, 0.6); }, 2, 2),
    metal: mk(64, 256, (x, w, h) => { x.fillStyle = '#c8d0c8'; x.fillRect(0, 0, w, h); for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(${120 + r() * 60},${70 + r() * 30},${30 + r() * 20},${0.3 + r() * 0.4})`; x.beginPath(); x.ellipse(r() * w, r() * h, 2 + r() * 8, 3 + r() * 16, 0, 0, 6.29); x.fill(); } speck(x, w, h, 300, 140, 255, 0.4, 1.4, 0.4); }, 1, 2),
    glassA: mk(128, 128, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, g(40)); gr.addColorStop(0.65, g(60)); gr.addColorStop(1, g(170)); x.fillStyle = gr; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) { const px = r() * w, py = r() * h * 0.6; x.strokeStyle = g(110, 0.6); x.lineWidth = 0.6 + r(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 3, py + 20 + r() * 50); x.stroke(); } speck(x, w, h, 200, 90, 200, 0.4, 1.6, 0.5); x.strokeStyle = g(150); x.lineWidth = 3; x.strokeRect(1.5, 1.5, w - 3, h - 3); }),
    leaf: mk(64, 64, (x, w, h) => { x.fillStyle = '#e6e6e6'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,240,.9)'; x.lineWidth = 2; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke(); x.lineWidth = 1; for (let y = 6; y < h; y += 9) { x.beginPath(); x.moveTo(w / 2, y); x.lineTo(4, y - 8); x.moveTo(w / 2, y); x.lineTo(w - 4, y - 8); x.stroke(); } speck(x, w, h, 120, 170, 230, 0.4, 1.2, 0.5); }),
  };
  return T;
})();
if (TX) {
  const set = (m, o) => { Object.assign(m, o); m.needsUpdate = true; };
  set(M.wood, { map: TX.wood, bumpMap: TX.woodB, bumpScale: 4 });
  set(M.woodDark, { map: TX.wood, bumpMap: TX.woodB, bumpScale: 4 });
  set(M.bark, { map: TX.wood, bumpMap: TX.woodB, bumpScale: 6 });
  set(M.terra, { map: TX.terra, bumpMap: TX.terraB, bumpScale: 3 });
  set(M.terraDark, { map: TX.terra, bumpMap: TX.terraB, bumpScale: 3 });
  set(M.soil, { map: TX.soil, bumpMap: TX.soil, bumpScale: 5 });
  TX.gravel.repeat.set(2.9, 4.6); // sol des petites serres
  set(M.gravel, { color: new THREE.Color(0x9a9282), map: TX.gravel, bumpMap: TX.gravel, bumpScale: 6 });
  set(M.stone, { map: TX.stone, bumpMap: TX.stoneB, bumpScale: 4 });
  set(M.frame, { map: TX.metal, bumpMap: TX.metal, bumpScale: 2, roughness: 0.7 });
  set(M.glass, { alphaMap: TX.glassA, opacity: 0.55 });
  set(M.leaf, { map: TX.leaf, bumpMap: TX.leaf, bumpScale: 1.5 });
  set(M.leafFlat, { bumpMap: TX.leaf, bumpScale: 1.5 });
}
// Verre : un liseré de Fresnel (bords rasants plus opaques et teintés) ; plantes : un liseré de contre-jour
// qui détache les feuilles du fond. Deux uniformes partagés, réglés par l'ambiance.
const glassU = { uGlassK: { value: 1 }, uGlassTint: { value: col('#dfeee6') }, uGlow: { value: 0 }, uGlowCol: { value: col('#ffb45a') } }; // uGlow : verre ambré la nuit (lanternes allumées), sans lumière en plus
const rimU = { uRimK: { value: 0.5 }, uRimCol: { value: col('#ffe2b0') } };
M.glass.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, glassU);
  sh.fragmentShader = 'uniform float uGlassK;\nuniform vec3 uGlassTint;\nuniform float uGlow;\nuniform vec3 uGlowCol;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
    float frG = pow( 1.0 - abs( dot( normalize( vViewPosition ), normal ) ), 3.0 );
    outgoingLight += uGlassTint * frG * 0.28 * uGlassK; diffuseColor.a = min( 1.0, diffuseColor.a + frG * 0.3 + 0.02 );
    outgoingLight += uGlowCol * uGlow * ( 0.55 + frG * 0.6 ); diffuseColor.a = min( 1.0, diffuseColor.a + uGlow * 0.16 );
    #include <opaque_fragment>`);
};
for (const m of [M.leaf, M.leafFlat, M.stem, M.cactus]) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, rimU);
    sh.fragmentShader = 'uniform float uRimK;\nuniform vec3 uRimCol;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      float frR = pow( 1.0 - abs( dot( normalize( vViewPosition ), normal ) ), 2.5 );
      outgoingLight += uRimCol * frR * uRimK * ( 0.35 + 0.65 * diffuseColor.g );
      #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'rim';
}
M.glass.customProgramCacheKey = () => 'glassFresnel';

// ---------- Les trois serres ----------
// Trois petites serres (chacune ≈ 46 % de l'ancienne grande) en arc devant la chaumière, portes tournées vers le
// chemin. Coordonnées locales d'une serre : porte vers +z, origine au centre du sol.
const HW = 2.6, HD = 4.2, HH = 2.2, HR = 3.35; // demi-largeur, demi-profondeur, hauteur des murs, faîtage
// Chaque serre a son accent (porte, panneau, lanterne, chemin de table) et ses pots : on les distingue de dehors.
const HOUSES = [
  { id: 'travail', name: 'Travail', cats: ['travail'], x: 0, z: -2.6, ry: 0, accent: '#5f7fa6', signBg: '#26395a', pot: ['#8d9db0', '#6f8199'], potR: 0.45 }, // ardoise, grès bleu-gris
  { id: 'bienetre', name: 'Bien-être', cats: ['bienetre'], x: 7.1, z: -0.3, ry: -0.32, accent: '#8fa58a', signBg: '#34502f', pot: ['#c8794a', '#a85f34'], potR: 0.95 }, // sauge, terre cuite brute
  { id: 'perso', name: 'Vie perso', cats: ['perso'], x: -7.1, z: -0.3, ry: 0.32, accent: '#c9786a', signBg: '#5e2430', pot: ['#f1e7d0', '#e2d3b4'], potR: 0.55 }, // rose, pots peints crème
];
export const HOUSE_IDS = HOUSES.map((h) => h.id);
export const HOUSE_OF = { travail: 'travail', bienetre: 'bienetre', perso: 'perso' }; // une catégorie = une serre
const houseOf = (cat) => catId(cat); // sans catégorie : la vie perso, comme catOf()
const HB = {};
for (const h of HOUSES) { const g = new THREE.Group(); g.position.set(h.x, 0, h.z); g.rotation.y = h.ry; g.updateMatrixWorld(true); scene.add(g); HB[h.id] = Object.assign(h, { g, cos: Math.cos(h.ry), sin: Math.sin(h.ry) }); }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const toWorld = (h, x, y, z) => V(h.x + x * h.cos + z * h.sin, y, h.z - x * h.sin + z * h.cos);
const toLocal = (h, x, z) => { const dx = x - h.x, dz = z - h.z; return [dx * h.cos - dz * h.sin, dx * h.sin + dz * h.cos]; };
const inHouse = (x, z, m = 0) => HOUSES.some((h) => { const [lx, lz] = toLocal(h, x, z); return Math.abs(lx) < HW + m && Math.abs(lz) < HD + m; });
const roofY = (x) => HH + (HR - HH) * (1 - Math.abs(x) / HW);
// Chaque serre a dehors l'architecture de son intérieur (js/botaniste3d.js) : voûte ronde, ogive ou deux pans,
// la couleur de son ossature, son soubassement et son sol.
const STYLE = {
  bienetre: { roof: 'vault', top: 3.75, frame: '#3a5a48', base: '#9a5038', tiles: ['#b9b2a0'], beam: 0.055 },
  travail: { roof: 'ogive', top: 4.4, frame: '#2a2e33', base: '#57524c', tiles: ['#ece6d8', '#2c2c30'], beam: 0.05 },
  perso: { roof: 'gable', top: HR, frame: '#ffffff', base: '#f2ede0', tiles: ['#cfc6b4'], beam: 0.075 },
};
const roofOf = (h, x) => { const st = STYLE[h.id], u = Math.min(1, Math.abs(x) / HW); if (st.roof === 'gable') return HH + (st.top - HH) * (1 - u);
  const k = st.roof === 'ogive' ? 0.4 : 0; return HH + (st.top - HH) * Math.sqrt(Math.max(0, (1 + k) ** 2 - (u + k) ** 2)) / Math.sqrt(1 + 2 * k); };
const roofPts = (h) => { const n = STYLE[h.id].roof === 'gable' ? 1 : 10, out = []; for (let i = 0; i <= n; i++) { const x = HW * (1 - i / n); out.push([x, roofOf(h, x)]); } return out; };
// Fusion de géométries (une seule passe de dessin pour des tiges, des chaînes, des vitrages…)
function mergeGeos(parts) {
  const P = [], N = [], U = [];
  for (const [geo, mat] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); if (mat) g.applyMatrix4(mat);
    const p = g.attributes.position.array, n = g.attributes.normal && g.attributes.normal.array, u = g.attributes.uv && g.attributes.uv.array;
    for (let i = 0; i < p.length; i++) { P.push(p[i]); N.push(n ? n[i] : 0); }
    for (let i = 0; i < p.length / 3 * 2; i++) U.push(u ? u[i] : 0);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  return out;
}
// Regroupe les meshes simples d'un groupe qui partagent un matériau (tiges, branches) : moins d'appels de dessin.
function compact(g) {
  g.updateMatrixWorld(true); const inv = g.matrixWorld.clone().invert(), by = new Map();
  for (const o of g.children) if (o.isMesh && !o.isInstancedMesh && !Array.isArray(o.material)) { if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(o); }
  for (const [mat, list] of by) {
    if (list.length < 2) continue;
    const m = new THREE.Mesh(mergeGeos(list.map((o) => [o.geometry, inv.clone().multiply(o.matrixWorld)])), mat);
    m.castShadow = list.some((o) => o.castShadow); m.receiveShadow = list.some((o) => o.receiveShadow); m.userData.own = true;
    for (const o of list) { g.remove(o); o.geometry.dispose(); }
    g.add(m);
  }
  return g;
}
function disposeObj(o) { o.traverse((c) => { if (c.isInstancedMesh) c.dispose(); else if (c.isMesh && c.userData.own) c.geometry.dispose(); }); }
// Pièces répétées des trois serres (armature, briques, tables, dalles, portes, panneaux) : un InstancedMesh par matériau.
const IB = new Map(), m4 = new THREE.Matrix4(), Q0 = new THREE.Quaternion(), WHITE = col('#ffffff');
const ibDef = (k, geo, mat, cast = true, receive = true) => IB.set(k, { geo, mat, cast, receive, items: [] });
const ibPut = (k, base, pos, quat, scl, color) => { m4.compose(pos, quat, scl); IB.get(k).items.push([base ? base.clone().multiply(m4) : m4.clone(), color]); };
const qY = (a) => (a ? new THREE.Quaternion().setFromAxisAngle(UP, a) : Q0);
const boxAt = (k, base, x, y, z, sx, sy, sz, ry = 0, color) => ibPut(k, base, V(x, y, z), qY(ry), V(sx, sy, sz), color);
let frameCol = null; // couleur de l'ossature de la serre en cours de construction
const beam = (base, a, b, t = 0.06) => { const d = new THREE.Vector3().subVectors(b, a); ibPut('frame', base, a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()), V(t, d.length(), t), frameCol); };
function ibFlush(parent) {
  for (const b of IB.values()) {
    const im = new THREE.InstancedMesh(b.geo, b.mat, b.items.length), hasCol = b.items.some(([, c]) => c);
    b.items.forEach(([mm, c], i) => { im.setMatrixAt(i, mm); if (hasCol) im.setColorAt(i, c || WHITE); });
    im.castShadow = b.cast; im.receiveShadow = b.receive; parent.add(im);
  }
  IB.clear();
}
{
  const box1 = new THREE.BoxGeometry(1, 1, 1), floorGeo = new THREE.PlaneGeometry(HW * 2, HD * 2); floorGeo.rotateX(-Math.PI / 2);
  ibDef('frame', box1, M.frame); ibDef('brick', box1, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 })); // soubassement : la couleur de l'instance (briques, pierre, planches)
  ibDef('wood', box1, M.wood); ibDef('dark', box1, M.woodDark); ibDef('door', box1, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, metalness: 0 })); // portes peintes : couleur de la serre (par instance)
  ibDef('cloth', box1, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), false, true); // chemins de table
  ibDef('tile', box1, Object.assign(M.stone.clone(), { color: col('#ffffff') }), false, true); ibDef('floor', floorGeo, M.gravel, false, true); // dalles : matériau blanc, la couleur est celle de l'instance
}
// Vitrages d'une serre, fusionnés : murs, toit (sa coupe extrudée), pignon arrière plein, pignon avant ouvert sur la porte.
const glassGeoOf = (h) => {
  const parts = [], mk = (g, x, y, z, rx = 0, ry = 0, rz = 0) => parts.push([g, new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(1, 1, 1))]);
  for (const s of [-1, 1]) mk(new THREE.PlaneGeometry(HD * 2, HH - 0.5), s * HW, 0.5 + (HH - 0.5) / 2, 0, 0, Math.PI / 2, 0);
  const pr = roofPts(h), sec = [...pr.map(([x, y]) => [-x, y]), ...pr.slice(0, -1).reverse()], P = [];
  for (let i = 0; i < sec.length - 1; i++) { const [ax, ay] = sec[i], [bx, by] = sec[i + 1]; P.push(ax, ay, -HD, bx, by, -HD, bx, by, HD, ax, ay, -HD, bx, by, HD, ax, ay, HD); }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((P.length / 3) * 2).fill(0), 2)); rg.computeVertexNormals(); parts.push([rg, null]);
  const v2 = (x, y) => new THREE.Vector2(x, y), gable = sec.map(([x, y]) => v2(x, y));
  mk(new THREE.ShapeGeometry(new THREE.Shape([v2(-HW, 0.5), ...gable, v2(HW, 0.5)])), 0, 0, -HD);
  mk(new THREE.ShapeGeometry(new THREE.Shape([v2(-HW, 0.5), ...gable, v2(HW, 0.5), v2(0.6, 0.5), v2(0.6, 2.1), v2(-0.6, 2.1), v2(-0.6, 0.5)])), 0, 0, HD);
  return mergeGeos(parts);
};
// Panneau peint : planche de bois, nom en lettres crème (empattements, un peu penchées comme à la main).
function signTex(text, bg = '#6e4526') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 200; const x = c.getContext('2d'), r = rngOf(text.length * 97);
  x.fillStyle = bg; x.fillRect(0, 0, 512, 200);
  for (let i = 0; i < 40; i++) { const y = r() * 200; x.strokeStyle = r() < 0.5 ? 'rgba(40,22,10,.35)' : 'rgba(150,100,60,.3)'; x.lineWidth = 1 + r() * 3; x.beginPath(); x.moveTo(0, y); for (let px = 0; px <= 512; px += 32) x.lineTo(px, y + Math.sin(px * 0.02 + i) * 3); x.stroke(); }
  x.strokeStyle = 'rgba(241,232,210,.75)'; x.lineWidth = 4; x.strokeRect(14, 14, 484, 172);
  x.fillStyle = '#f1e8d2'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let fs = 112; do { x.font = `italic 700 ${fs}px "Bradley Hand", Georgia, "Times New Roman", serif`; fs -= 4; } while (x.measureText(text).width > 456 && fs > 64); // jamais sous 64 : lisible dans le bandeau
  x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 4; x.shadowOffsetY = 2; x.fillText(text, 256, 106);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const SIGNS = []; // panneaux des serres : on les touche pour voir les choses du jour de la serre
const BAYS = 6, TBX = 1.75, TY = 0.82, TZ0 = -HD + 1.5, TZ1 = HD - 1.0; // tables : axe, hauteur, début et fin
const lanterns = [], signMats = [], bulbMats = [];
for (const h of HOUSES) {
  const g = h.g, W = g.matrixWorld, r = rngOf(3 + HOUSES.indexOf(h) * 31);
  ibPut('floor', W, V(0, 0, 0), Q0, V(1, 1, 1));
  const st = STYLE[h.id], top = roofOf(h, 0), pr = roofPts(h), bt = st.beam; frameCol = col(st.frame);
  for (let i = 0; i < 21; i++) { const z = HD - 0.3 - i * 0.39, x = (i % 2 ? 0.28 : -0.28) + (r() - 0.5) * 0.06; boxAt('tile', W, x, 0.015, z, 0.52 + r() * 0.1, 0.04, 0.34 + r() * 0.04, (r() - 0.5) * 0.2, vary(col(st.tiles[i % st.tiles.length]), r, st.tiles.length > 1 ? 0.02 : 0.08)); }
  // soubassement : briques (Bien-être), pierre sombre (Travail), planches peintes (Vie perso)
  const bc = () => vary(col(st.base), r, 0.05);
  for (const s of [-1, 1]) { boxAt('brick', W, s * HW, 0.25, 0, 0.16, 0.5, HD * 2, 0, bc()); boxAt('brick', W, s * (HW + 0.62) / 2, 0.25, HD, HW - 0.62, 0.5, 0.16, 0, bc()); }
  boxAt('brick', W, 0, 0.25, -HD, HW * 2, 0.5, 0.16, 0, bc());
  // armature : poteaux, chevrons qui suivent la coupe, faîtage, lisses, pignons
  for (let i = 0; i <= BAYS; i++) { const z = -HD + (i * 2 * HD) / BAYS; for (const s of [-1, 1]) { beam(W, V(s * HW, 0.5, z), V(s * HW, HH, z), bt); for (let k = 0; k < pr.length - 1; k++) beam(W, V(s * pr[k][0], pr[k][1], z), V(s * pr[k + 1][0], pr[k + 1][1], z), bt); }
    if (st.roof === 'ogive') beam(W, V(-HW * 0.62, roofOf(h, HW * 0.62), z), V(HW * 0.62, roofOf(h, HW * 0.62), z), 0.02); }
  for (const s of [-1, 1]) { beam(W, V(s * HW, HH, -HD), V(s * HW, HH, HD), bt); beam(W, V(s * HW, 1.25, -HD), V(s * HW, 1.25, HD), 0.035); beam(W, V(s * HW * 0.5, roofOf(h, HW * 0.5), -HD), V(s * HW * 0.5, roofOf(h, HW * 0.5), HD), 0.035); }
  beam(W, V(0, top, -HD), V(0, top, HD), bt * 1.5);
  for (const x of [-HW / 2, 0, HW / 2]) beam(W, V(x, 0.5, -HD), V(x, roofOf(h, x), -HD), 0.05);
  beam(W, V(-HW, 1.25, -HD), V(HW, 1.25, -HD), 0.035);
  for (const x of [-HW / 2, HW / 2]) beam(W, V(x, 0.5, HD), V(x, roofOf(h, x), HD), 0.05);
  beam(W, V(0, 2.1, HD), V(0, top, HD), 0.05);
  for (const s of [-1, 1]) beam(W, V(s * HW, 1.25, HD), V(s * 0.6, 1.25, HD), 0.035);
  frameCol = null;
  const gl = new THREE.Mesh(glassGeoOf(h), M.glass); gl.renderOrder = 2; g.add(gl);
  // de loin : épis de faîtage (boules vertes, flèches noires, épis blancs), jardinières devant l'orangerie
  { const fm = new THREE.MeshStandardMaterial({ color: st.frame, roughness: 0.5, metalness: st.roof === 'gable' ? 0 : 0.6 });
    for (const z of [-HD, HD]) { const f = st.roof === 'ogive' ? new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 8), fm) : st.roof === 'vault' ? new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), fm) : new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), fm);
      f.position.set(0, top + (st.roof === 'ogive' ? 0.3 : 0.1), z); f.castShadow = true; g.add(f); }
    if (st.roof === 'gable') for (const x of [-1.6, 1.6]) { const bx = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.22), new THREE.MeshStandardMaterial({ color: 0x9fb8c8, roughness: 0.6 })); bx.position.set(x, 0.62, HD + 0.14); g.add(bx);
      for (let k = 0; k < 9; k++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: ['#e8708a', '#f2d27a', '#f0f0e8', '#c060a0'][k % 4], roughness: 0.7 })); fl.position.set(x - 0.34 + k * 0.085, 0.76 + r() * 0.05, HD + 0.14 + (r() - 0.5) * 0.1); g.add(fl); } }
    if (st.roof === 'vault') for (let k = 0; k < 9; k++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 5), new THREE.MeshStandardMaterial({ color: [0x7a8a5a, 0x9a7ab0, 0xc8b060][k % 3], roughness: 1 })); b.rotation.x = Math.PI; b.position.set(-1.6 + k * 0.4, HH - 0.15, HD - 0.15); g.add(b); }
  }
  // porte et marche
  const acc = col(h.accent);
  for (const x of [-0.6, 0.6]) boxAt('door', W, x, 1.05, HD + 0.02, 0.1, 2.1, 0.09, 0, acc);
  boxAt('door', W, 0, 2.12, HD + 0.02, 1.3, 0.1, 0.09, 0, acc);
  // battant ouvert vers le dehors, rabattu contre la façade à droite : cadre et soubassement plein, de la couleur de la serre
  { const ry = -0.3, ux = Math.cos(ry), uz = -Math.sin(ry), at = (u, y, sx, sy, sz) => boxAt('door', W, 0.6 + ux * u, y, HD + 0.06 + uz * u, sx, sy, sz, ry, acc);
    for (const u of [0.04, 1.08]) at(u, 1.03, 0.07, 1.98, 0.05); for (const y of [0.08, 0.82, 2.0]) at(0.56, y, 1.04, 0.07, 0.05); at(0.56, 0.45, 1.0, 0.7, 0.03); }
  boxAt('tile', W, 0, 0.06, HD + 0.3, 1.5, 0.12, 0.5, 0, col('#9a9484'));
  // tables le long des murs, étagère dessous
  for (const s of [-1, 1]) {
    const L = TZ1 - TZ0, zc = (TZ0 + TZ1) / 2;
    boxAt('wood', W, s * TBX, TY, zc, 0.95, 0.06, L);
    boxAt('dark', W, s * (TBX - 0.47), TY + 0.03, zc, 0.05, 0.12, L);
    for (let i = 0; i < 5; i++) for (const dx of [-0.4, 0.4]) boxAt('dark', W, s * TBX + dx, TY / 2, TZ0 + 0.2 + i * (L - 0.4) / 4, 0.06, TY, 0.06);
    boxAt('dark', W, s * TBX, 0.22, zc, 0.85, 0.04, L - 0.2);
    boxAt('cloth', W, s * TBX, TY + 0.036, zc, 0.97, 0.012, L + 0.04, 0, acc); // chemin de table de la couleur de la serre
    boxAt('cloth', W, s * (TBX - 0.49), TY - 0.03, zc, 0.012, 0.13, L + 0.04, 0, acc); // et son retombé côté allée
  }
  // panneau de bois peint, à gauche de la porte, un peu tourné vers le chemin
  const sg = new THREE.Group(); sg.position.set(-1.62, 0, HD + 0.75); sg.rotation.y = 0.22; g.add(sg); sg.updateMatrixWorld(true); sg.userData.pick = { kind: 'sign', house: h.id }; SIGNS.push(sg);
  const SW = sg.matrixWorld;
  for (const x of [-0.72, 0.72]) boxAt('dark', SW, x, 0.78, -0.04, 0.08, 1.56, 0.08);
  boxAt('wood', SW, 0, 1.25, 0, 1.88, 0.78, 0.05);
  const tex = signTex(h.name, h.signBg), sm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 }); signMats.push(sm); // un peu de lueur la nuit, pour rester lisible
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.7), sm);
  face.position.set(0, 1.25, 0.027); face.castShadow = true; sg.add(face);
  // lanterne suspendue au faîtage
  const lg = new THREE.Group(), ly = HH + 0.1;
  lg.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.22, 6, 1, true), new THREE.MeshStandardMaterial({ color: 0x2a2116, metalness: 0.6, roughness: 0.5, wireframe: true })));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.08, 6), M.chain); cap.position.y = 0.15; lg.add(cap);
  const tint = col('#ffb85c').lerp(acc, 0.3), bulbM = M.bulb.clone(); bulbM.emissive = col('#f2b23d').lerp(acc, 0.35); bulbMats.push(bulbM);
  lg.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), bulbM));
  const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, roofOf(h, 0) - ly - 0.15, 4), M.chain); ch.position.y = (roofOf(h, 0) - ly - 0.15) / 2 + 0.15; lg.add(ch);
  const light = new THREE.PointLight(tint, 9, 9, 1.5); lg.add(light);
  lg.position.set(0, ly, 0.3); g.add(lg); lanterns.push({ g: lg, light, house: h, tint });
  // pots de la serre : deux teintes de sa matière (grès, terre cuite, peint)
  h.pots = h.pot.map((c) => { const m = M.terra.clone(); m.color = col(c); m.roughness = h.potR; return m; });
}
// arrosoir, pour la vie (serre Travail, près de la porte)
{ const can = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0x5f87a8, roughness: 0.4, metalness: 0.5 })); body.position.y = 0.11; can.add(body);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.3, 8), body.material); spout.position.set(0.17, 0.2, 0); spout.rotation.z = -0.9; can.add(spout);
  can.position.set(0.75, 0, HD - 0.8); can.rotation.y = 0.6; can.traverse((o) => { o.castShadow = true; }); HB.travail.g.add(can); }
ibFlush(scene);

// ---------- Dehors : relief, prairie au vent, arbres, chemin, muret ----------
// Bruit de valeur 2D (déterministe) et somme d'octaves.
const hash2 = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v); };
const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1, y * 2.1) * 0.28 + vnoise(x * 4.3, y * 4.3) * 0.17;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Plat autour des serres et du chemin, des collines au-delà.
function heightAt(x, z) {
  const r = Math.hypot(x, z * 0.8), pathD = Math.abs(x - pathX(z));
  const flat = smooth(11, 27, r) * smooth(1.2, 4, pathD + (z < 6 ? 99 : 0));
  return flat * (fbm(x * 0.045 + 3.1, z * 0.045 + 7.7) * 9 - 1.2) + (fbm(x * 0.3, z * 0.3) - 0.5) * 0.12 * smooth(9.5, 12.5, r);
}
// Chemin : de la porte de la serre Travail jusqu'au portail et au-delà ; à mi-chemin, deux branches vers les portes
// des serres Bien-être et Vie perso.
const DOOR_Z = HB.travail.z + HD + 0.3, FORK_Z = 6.2;
const pathX = (z) => Math.sin((z - 6.6) * 0.16) * 1.6 * smooth(6.6, 12, z);
const BRANCHES = ['bienetre', 'perso'].map((id) => {
  const h = HB[id], door = toWorld(h, 0, 0, HD + 0.45), n = V(h.sin, 0, h.cos), c = door.clone().addScaledVector(n, 2.4);
  const curve = new THREE.QuadraticBezierCurve3(V(pathX(FORK_Z), 0, FORK_Z), c, door), pts = curve.getSpacedPoints(48);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  return { id, curve, pts, len: curve.getLength(), box: [x0 - 1.5, x1 + 1.5, z0 - 1.5, z1 + 1.5] };
});
// La maison d'Ernest : chaumière de conte (js/cottage3d.js), fenêtres qui s'allument le soir, cheminée qui fume
const cottageB = buildCottage(THREE, { rng: rngOf(77), M });
const cottage = cottageB.group; scene.add(cottage);
{ const cx = -6.0, cz = -9.6; cottage.position.set(cx, heightAt(cx, cz), cz); cottage.rotation.y = 0.5; cottage.updateMatrixWorld(true); } // derrière les serres, porte vers le jardin
// Allée de la chaumière : elle quitte la branche de Vie perso, passe entre cette serre et la serre Travail, et
// finit au pas de la porte ronde. Toujours là (ce n'est pas un chemin qui pousse).
const COT_PATH = (() => {
  const door = cottageB.door.clone().applyMatrix4(cottage.matrixWorld), out = V(Math.sin(0.5), 0, Math.cos(0.5)), br = BRANCHES.find((b) => b.id === 'perso').curve.getPoint(0.42);
  door.y = 0; br.y = 0;
  const curve = new THREE.CatmullRomCurve3([br, V(-3.1, 0, 3.4), V(-3.2, 0, 0.6), V(-3.75, 0, -3.0), door.clone().addScaledVector(out, 1.6), door.clone().addScaledVector(out, 0.15)], false, 'centripetal'), pts = curve.getSpacedPoints(60);
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  return { curve, pts, len: curve.getLength(), box: [x0 - 1.5, x1 + 1.5, z0 - 1.5, z1 + 1.5] };
})();
// Distance au chemin (allée principale, branches, allée de la chaumière), pour l'herbe, les fleurs et la teinte du sol.
function pathDist(x, z) {
  let d = z > DOOR_Z - 0.3 ? Math.abs(x - pathX(z)) : 99;
  for (const b of [...BRANCHES, COT_PATH]) { const [x0, x1, z0, z1] = b.box; if (x < x0 || x > x1 || z < z0 || z > z1) continue; for (const p of b.pts) d = Math.min(d, Math.hypot(x - p.x, z - p.z)); }
  return d;
}
// Saison réelle : couleurs de l'herbe et des feuillages.
const MONTH = new Date().getMonth() + 1;
const SEASON = MONTH <= 2 || MONTH === 12 ? 'hiver' : MONTH <= 5 ? 'printemps' : MONTH <= 8 ? 'ete' : 'automne';
const PAL = {
  hiver: { grass: ['#5b7046', '#6e7f56', '#4d6140'], leaves: null, flowers: ['#efe6d2'] },
  printemps: { grass: ['#5f9a45', '#76ad52', '#4f8a3e'], leaves: ['#8fc06a', '#a8d07a', '#f2c6d8'], flowers: ['#f2c6d8', '#f4efe6', '#f2d24a', '#9ec8f0'] },
  ete: { grass: ['#6d9a3d', '#88a84a', '#5a8a36'], leaves: ['#4f8a3a', '#3f7a32', '#6a9a42'], flowers: ['#f2d24a', '#e86f8a', '#f4efe6', '#c7a6e8'] },
  automne: { grass: ['#6f8a36', '#86923f', '#5f7d33', '#9a8c3c'], leaves: ['#d8772a', '#e6a532', '#b8422a', '#c98a28', '#7f9a34'], flowers: ['#d9a03a', '#c7a6e8', '#f4efe6'] },
}[SEASON];

const outdoor = new THREE.Group(); scene.add(outdoor);
// Étape 4 : le potager, un carré par catégorie, entre les serres et le portail (Travail au milieu, Bien-être à droite,
// Vie perso et Cuisine à gauche, près de la chaumière). L'herbe s'efface sous eux quand ils apparaissent.
const BED_LOOK = ['revision', 'corps', 'esprit', 'cuisine', 'boulot', 'perso']; // aspect des cultures de chaque carré
const BED_CATS = ['travail', 'bienetre', 'bienetre', 'bienetre', 'travail', 'perso']; // serre qui fait pousser le carré
const BEDS = [[-3.4, 9.4], [5.4, 8.8], [7.4, 7.8], [-7.4, 7.8], [3.4, 9.4], [-5.4, 8.8]].map(([x, z]) => ({ x, z, hx: 0.6, hz: 1.15 }));
const ZONES = BEDS;
const zoneAt = (x, z, m = 0.12) => ZONES.findIndex((b) => Math.abs(x - b.x) < b.hx + m && Math.abs(z - b.z) < b.hz + m);
const zoneU = { value: new Array(ZONES.length).fill(0) };
// Terrain
{
  const g = new THREE.PlaneGeometry(190, 190, 150, 150); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, colors = [], r = rngOf(21), base = PAL.grass.map(col);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = Math.abs(x) < 13 && Math.abs(z) < 13 && inHouse(x, z, 0.3) ? -0.02 : heightAt(x, z);
    p.setY(i, y - 0.03);
    const c = base[Math.floor(fbm(x * 0.12, z * 0.12) * base.length * 1.4) % base.length].clone().offsetHSL(0, 0, (r() - 0.5) * 0.04 + y * 0.004);
    const dp = pathDist(x, z); if (dp < 0.9) c.lerp(col('#8a7a5a'), 0.55 * (1 - dp / 0.9));
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); m.receiveShadow = true; outdoor.add(m);
}
// Prairie : des milliers de brins qui ondulent (vent calculé dans le shader)
const windU = { value: 0 };
const ext = { beds: [] };
let wallStones = [], bushLeafMat = null; const treeSpots = [], bushSpots = []; // pour les ombres portées douces (plus bas)
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
      if (aZone > -0.5) transformed *= 1.0 - uZone[int(aZone + 0.5)];
      vBladeH = position.y / 0.7;`).replace('void main() {', 'varying float vBladeH;\nvoid main() {');
    // DoubleSide retournerait la normale des faces arrière (brins noirs) : on la garde vers le ciel des deux côtés,
    // et le pied du brin est assombri (faux AO).
    sh.fragmentShader = 'varying float vBladeH;\n' + sh.fragmentShader
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize( vNormal ); nonPerturbedNormal = normal;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= mix( 0.42, 1.08, smoothstep( 0.0, 0.85, vBladeH ) );');
  };
  mat.customProgramCacheKey = () => 'grassUp';
  const N = 24000, im = new THREE.InstancedMesh(blade, mat, N), r = rngOf(33), base = PAL.grass.map(col), aZone = new Float32Array(N); let k = 0;
  for (let i = 0; i < N * 3 && k < N; i++) {
    const a = r() * Math.PI * 2, d = 4.5 + Math.pow(r(), 0.7) * 34, x = Math.cos(a) * d, z = Math.sin(a) * d * 1.15;
    if (inHouse(x, z, 0.4) || pathDist(x, z) < 0.85) continue;
    dummy.position.set(x, heightAt(x, z) - 0.03, z); dummy.rotation.set((r() - 0.5) * 0.3, r() * 6.28, 0); const s = 0.45 + r() * 0.5; dummy.scale.set(0.9, s * (0.55 + r() * 0.45), 0.9); dummy.updateMatrix();
    aZone[k] = zoneAt(x, z); im.setMatrixAt(k, dummy.matrix); im.setColorAt(k, base[Math.floor(r() * base.length)].clone().offsetHSL(0, (r() - 0.5) * 0.04, (r() - 0.5) * 0.035 + 0.02)); k++;
  }
  blade.setAttribute('aZone', new THREE.InstancedBufferAttribute(aZone, 1)); im.count = k; im.receiveShadow = true; outdoor.add(im); ext.grass = { im, n: k };
  // fleurs sauvages
  const F = SEASON === 'hiver' ? 0 : 900, fm = new THREE.InstancedMesh(GEO_BALL_SMALL(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), Math.max(1, F)); let f = 0;
  for (let i = 0; i < F * 3 && f < F; i++) { const a = r() * 6.28, d = 6 + r() * 24, x = Math.cos(a) * d, z = Math.sin(a) * d; if (inHouse(x, z, 0.5) || pathDist(x, z) < 1) continue; if (zoneAt(x, z, 0.3) >= 0) continue; if (fbm(x * 0.2, z * 0.2) < 0.5) continue;
    dummy.position.set(x, heightAt(x, z) + 0.25 + r() * 0.2, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.035 + r() * 0.03); dummy.updateMatrix(); fm.setMatrixAt(f, dummy.matrix); fm.setColorAt(f++, col(PAL.flowers[Math.floor(r() * PAL.flowers.length)])); }
  fm.count = f; outdoor.add(fm); ext.flowers = { im: fm, n: f, cur: 0.5, target: 0.5 };
}
function GEO_BALL_SMALL() { return new THREE.IcosahedronGeometry(1, 0); }
// Chemin de dalles : il part des trois portes et s'allonge avec le total jusqu'au portail, puis au-delà.
{
  const r = rngOf(44), st = [];
  for (let i = 0; i < 54; i++) { const z = DOOR_Z + 0.25 + i * 0.55, x = pathX(z) + (i % 2 ? 0.22 : -0.22) + (r() - 0.5) * 0.12; st.push([x, z, i * 0.55]); }
  for (const b of BRANCHES) { const n = Math.floor(b.len / 0.55); for (let i = 1; i <= n; i++) { const u = 1 - i / (n + 1), p = b.curve.getPointAt(u), tn = b.curve.getTangentAt(u), o = (i % 2 ? 0.22 : -0.22) + (r() - 0.5) * 0.12; st.push([p.x - tn.z * o, p.z + tn.x * o, (1 - u) * b.len]); } }
  st.sort((a, b) => a[2] - b[2]); // dans l'ordre où elles apparaissent : depuis chaque porte, vers le portail
  const n = st.length, m = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 0.06, 7), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), n);
  st.forEach(([x, z], i) => { dummy.position.set(x, heightAt(x, z) + 0.01, z); dummy.rotation.set(0, r() * 3, 0); dummy.scale.set(0.3 + r() * 0.08, 1, 0.24 + r() * 0.06); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, vary(col('#9a927e'), r, 0.1)); });
  m.receiveShadow = true; outdoor.add(m); ext.stones = { im: m, n, cur: 9, target: 9 };
  // allée de la chaumière : mêmes dalles, toutes posées
  const C = COT_PATH, cn = Math.floor(C.len / 0.55), cm = new THREE.InstancedMesh(m.geometry, m.material, cn);
  for (let i = 0; i < cn; i++) { const u = (i + 0.5) / cn, p = C.curve.getPointAt(u), tn = C.curve.getTangentAt(u), o = (i % 2 ? 0.2 : -0.2) + (r() - 0.5) * 0.1, x = p.x - tn.z * o, z = p.z + tn.x * o;
    dummy.position.set(x, heightAt(x, z) + 0.01, z); dummy.rotation.set(0, r() * 3, 0); dummy.scale.set(0.28 + r() * 0.07, 1, 0.22 + r() * 0.05); dummy.updateMatrix(); cm.setMatrixAt(i, dummy.matrix); cm.setColorAt(i, vary(col('#a39b86'), r, 0.1)); }
  cm.receiveShadow = true; outdoor.add(cm);
}
// Muret de pierres sèches autour du jardin, ouvert sur le chemin : trois assises jointives à joints décalés,
// deux parements avec un léger fruit (plus large en bas), un couronnement de pierres debout, de la mousse dessus.
{
  const r = rngOf(55), stones = [], R = 12.5, RZ = 1.2;
  // pierre : sphère poussée vers un pavé arrondi, bosselée ; normales calculées de la même façon (pas d'arêtes)
  const stoneGeo = (seed) => {
    const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, nr = g.attributes.normal, n = new THREE.Vector3(), c = new THREE.Vector3(), rr = rngOf(300 + seed), ph = [rr() * 6, rr() * 6, rr() * 6], col3 = [];
    for (let i = 0; i < p.count; i++) {
      n.fromBufferAttribute(p, i).normalize(); const m = Math.max(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
      c.copy(n).divideScalar(m); const v = n.clone().lerp(c, 0.8);
      const k = 1 + 0.09 * Math.sin(n.x * 6.3 + ph[0]) * Math.sin(n.y * 5.1 + ph[1]) + 0.06 * Math.sin(n.z * 8.7 + n.x * 3 + ph[2]) + Math.sin(n.x * 41.3 + n.y * 27.1 + n.z * 13.7 + ph[0]) * 0.03;
      p.setXYZ(i, v.x * k * 0.5, v.y * k * 0.5, v.z * k * 0.5);
      const ax = Math.abs(n.x) === m ? new THREE.Vector3(Math.sign(n.x), 0, 0) : Math.abs(n.y) === m ? new THREE.Vector3(0, Math.sign(n.y), 0) : new THREE.Vector3(0, 0, Math.sign(n.z));
      const nn = n.clone().lerp(ax, 0.45).normalize(); nr.setXYZ(i, nn.x, nn.y, nn.z);
      const f = 0.72 + 0.34 * smooth(-0.6, 0.5, n.y); col3.push(f, f, f); // dessous assombri
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col3, 3)); return g;
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.97, vertexColors: true, flatShading: true, ...(TX ? { map: TX.wallStone, bumpMap: TX.wallStoneB, bumpScale: 5 } : {}) }); // pierres taillées : facettes nettes
  const VAR = 3, lists = Array.from({ length: VAR }, () => []);
  const at = (a) => [Math.cos(a) * R, Math.sin(a) * R * RZ];
  const open = (a) => { const [x, z] = at(a); return z > 8 && Math.abs(x - pathX(z)) < 1.3; };
  const dsda = (a) => Math.hypot(R * Math.sin(a), R * RZ * Math.cos(a));
  const tints = ['#9b9381', '#8f8a7a', '#a39a86', '#857f70'], moss = '#7f8a5a';
  const put = (x, y, z, sx, sy, sz, rotY, tint, tilt = 0.06) => {
    const q = lists[Math.floor(r() * VAR)]; q.push([x, y, z, sx, sy, sz, rotY + (r() - 0.5) * 0.12, (r() - 0.5) * tilt, (r() - 0.5) * tilt, tint]);
  };
  const COURSES = [{ h: 0.17, off: 0.17 }, { h: 0.15, off: 0.145 }, { h: 0.14, off: 0.12 }];
  COURSES.forEach((C, l) => {
    for (const side of [-1, 1]) {
      let a = (l % 2 ? 0.012 : 0) + (side > 0 ? 0.006 : 0);
      while (a < Math.PI * 2) {
        const len = 0.32 + r() * 0.2, da = len / dsda(a), am = a + da / 2; a += da; if (open(am)) continue;
        const [x0, z0] = at(am), tx = -R * Math.sin(am), tz = R * RZ * Math.cos(am), tl = Math.hypot(tx, tz), nx = tz / tl, nz = -tx / tl;
        const x = x0 + nx * C.off * side, z = z0 + nz * C.off * side;
        let y = heightAt(x0, z0) - 0.07; for (let k = 0; k < l; k++) y += COURSES[k].h; y += C.h / 2;
        const t = l === 0 && r() < 0.35 ? moss : tints[Math.floor(r() * tints.length)];
        put(x, y, z, len * 1.04, C.h * (0.95 + r() * 0.2), 0.2 + r() * 0.06, -Math.atan2(tz, tx), col(t).multiplyScalar(l === 0 ? 0.85 : 1));
        if (side > 0) stones.push([x0, y, z0, len * 0.6, C.h, am]);
      }
    }
  });
  // couronnement : pierres debout, serrées, en travers du mur
  const top = COURSES.reduce((s, C) => s + C.h, 0) - 0.07, mossTop = [];
  for (let a = 0; a < Math.PI * 2;) {
    const th = 0.1 + r() * 0.05, da = th / dsda(a), am = a + da / 2; a += da; if (open(am)) continue;
    const [x, z] = at(am), tx = -R * Math.sin(am), tz = R * RZ * Math.cos(am), h = 0.2 + r() * 0.08;
    put(x, heightAt(x, z) + top + h / 2 - 0.02, z, th * 1.05, h, 0.36 + r() * 0.06, -Math.atan2(tz, tx), col(r() < 0.3 ? moss : tints[Math.floor(r() * tints.length)]).multiplyScalar(1.05), 0.18);
    if (r() < 0.22) mossTop.push([x, heightAt(x, z) + top + h - 0.01, z, -Math.atan2(tz, tx)]);
  }
  lists.forEach((L, v) => {
    const m = new THREE.InstancedMesh(stoneGeo(v), mat, L.length);
    L.forEach(([x, y, z, sx, sy, sz, ry, rx, rz, tint], i) => { dummy.position.set(x, y, z); dummy.rotation.set(rx, ry, rz, 'YXZ'); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, vary(tint, r, 0.08)); });
    m.castShadow = m.receiveShadow = true; outdoor.add(m);
  });
  // mousse en coussins sur le couronnement
  const mm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), Math.max(1, mossTop.length * 5)); let mk = 0;
  for (const [x, y, z, ry] of mossTop) for (let j = 0, n = 3 + Math.floor(r() * 3); j < n; j++) { const ox = (r() - 0.5) * 0.1, oz = (r() - 0.5) * 0.26; dummy.position.set(x + Math.cos(ry) * ox + Math.sin(ry) * oz, y - 0.015 - Math.abs(oz) * 0.25, z - Math.sin(ry) * ox + Math.cos(ry) * oz); dummy.rotation.set(r(), r() * 6.28, r()); dummy.scale.set(0.03 + r() * 0.03, 0.02 + r() * 0.012, 0.03 + r() * 0.035); dummy.updateMatrix(); mm.setMatrixAt(mk, dummy.matrix); mm.setColorAt(mk++, vary(col(r() < 0.5 ? '#4f6a30' : '#66803c'), r, 0.14)); }
  mm.count = mk; mm.receiveShadow = true; outdoor.add(mm);
  // touffes d'herbe haute et de fougère au pied du muret, des deux côtés : le mur sort du pré au lieu d'être posé dessus
  const tuft = (() => { const P = [], rt = rngOf(77); for (let b = 0; b < 7; b++) { const a = (b / 7) * 6.28 + rt() * 0.6, lean = 0.25 + rt() * 0.35, h = 0.55 + rt() * 0.5, w = 0.035; const cx = Math.cos(a), cz = Math.sin(a);
    P.push(-cz * w, 0, cx * w, cz * w, 0, -cx * w, cx * lean, h, cz * lean); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g; })();
  const tufts = [];
  for (const side of [-1, 1]) for (let a = 0; a < Math.PI * 2;) { const da = (0.18 + r() * 0.35) / dsda(a); a += da; if (open(a) || r() < 0.25) continue;
    const [x0, z0] = at(a), tx = -R * Math.sin(a), tz = R * RZ * Math.cos(a), tl = Math.hypot(tx, tz), off = 0.3 + r() * 0.12; tufts.push([x0 + (tz / tl) * off * side, z0 - (tx / tl) * off * side]); }
  const tm2 = new THREE.InstancedMesh(tuft, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }), tufts.length);
  tufts.forEach(([x, z], i) => { dummy.position.set(x, heightAt(x, z) - 0.02, z); dummy.rotation.set(0, r() * 6.28, 0); dummy.scale.setScalar(0.35 + r() * 0.35); dummy.updateMatrix(); tm2.setMatrixAt(i, dummy.matrix); tm2.setColorAt(i, vary(col(PAL.grass ? PAL.grass[Math.floor(r() * PAL.grass.length)] : '#5f8a3a'), r, 0.1).multiplyScalar(0.9)); });
  tm2.receiveShadow = true; outdoor.add(tm2);
  wallStones = stones;
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
  for (let i = 0; i < 10; i++) { const c = crop(BED_LOOK[bi], r); c.position.set((i % 2 ? 0.25 : -0.25) + (r() - 0.5) * 0.06, 0.26, -b.hz + 0.24 + Math.floor(i / 2) * (b.hz * 2 - 0.48) / 4); c.rotation.y = r() * 6.28; c.scale.setScalar(0.001); g.add(c); crops.push(c); }
  g.position.set(b.x, y - 0.32, b.z); g.visible = false; outdoor.add(g);
  ext.beds.push({ g, crops, y, rise: 0, riseT: 0, grow: 0, growT: 0 });
});
// Arbres : conifères et feuillus aux couleurs de la saison, buissons
{
  const r = rngOf(66), trunks = [], cones = [], blobs = [], bushes = [];
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, d = 23 + Math.pow(r(), 0.8) * 30, x = Math.cos(a) * d, z = Math.sin(a) * d * 1.1;
    if (z > 8 && Math.abs(x - pathX(z)) < 4) continue;
    const y = heightAt(x, z), conifer = r() < 0.45, H = (conifer ? 4.5 : 3.6) * (0.7 + r() * 0.7);
    trunks.push([x, y, z, conifer ? 0.16 : 0.2, H * (conifer ? 0.35 : 0.55)]);
    if (conifer) for (let l = 0; l < 4; l++) cones.push([x, y + H * (0.25 + l * 0.18), z, H * (0.32 - l * 0.06), H * 0.36, r()]);
    else { // houppier plein : une grosse boule, trois plus basses qui débordent, une au sommet
      const v = r(), sp = [[0, 0.66, 0, 0.3], [0.22, 0.56, 0, 0.23], [-0.11, 0.55, 0.19, 0.22], [-0.11, 0.57, -0.19, 0.22], [0.03, 0.86, 0.02, 0.19]];
      sp.forEach(([dx, dy, dz, rs], b) => { const ro = v * 6.28 + b; const c = Math.cos(ro), sn = Math.sin(ro); blobs.push([x + (dx * c - dz * sn) * H, y + H * (dy + (r() - 0.5) * 0.05), z + (dx * sn + dz * c) * H, H * rs * (0.92 + r() * 0.16), (v + b * 0.13) % 1]); });
    }
    treeSpots.push([x, z, conifer ? H * 0.34 : H * 0.42]);
  }
  // buissons : en touffes de plusieurs boules, surtout le long du muret (dehors), quelques-uns dedans
  for (let i = 0; i < 64; i++) { const a = r() * 6.28, out = r() < 0.72, d = out ? 13.25 + r() * 1.4 : 10.9 + r() * 0.5, x = Math.cos(a) * d, z = Math.sin(a) * d * 1.2; if ((z > 7 && Math.abs(x - pathX(z)) < 2.2) || inHouse(x, z, 1)) continue; bushes.push([x, heightAt(x, z), z, 0.34 + r() * 0.3, r()]); bushSpots.push(bushes[bushes.length - 1]); }
  // dégradé vertical dans la géométrie : dessous assombri de 35 %, sommet un peu éclairci (multiplié par la couleur d'instance)
  // boule bosselée (houppiers, buissons) : un bruit de position, normales gardées lisses
  const lumpy = (g, amt, seed) => { const p = g.attributes.position, nr = g.attributes.normal, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); const k = 1 + amt * (Math.sin(v.x * 5.1 + seed) * Math.sin(v.y * 4.3 + seed * 2) + 0.6 * Math.sin(v.z * 7.7 - v.x * 3.1 + seed)); nr.setXYZ(i, v.x, v.y, v.z); p.setXYZ(i, v.x * k, v.y * k, v.z * k); } return g; };
  const grad = (g, y0, y1, lo = 0.65, hi = 1.06) => { const p = g.attributes.position, c = []; for (let i = 0; i < p.count; i++) { const k = smooth(y0, y1, p.getY(i)); const f = lo + (hi - lo) * k; c.push(f, f, f); } g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; };
  const tm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1, 1, 10), M.bark, trunks.length);
  trunks.forEach(([x, y, z, rad, h], i) => { dummy.position.set(x, y + h / 2, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(rad, h, rad); dummy.updateMatrix(); tm.setMatrixAt(i, dummy.matrix); });
  const cm = new THREE.InstancedMesh(grad(new THREE.ConeGeometry(1, 1, 12), -0.5, 0.45, 0.62, 1.08), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, vertexColors: true }), cones.length);
  cones.forEach(([x, y, z, rad, h, v], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0, v * 6, 0); dummy.scale.set(rad, h, rad); dummy.updateMatrix(); cm.setMatrixAt(i, dummy.matrix); cm.setColorAt(i, col(['#2f5f3a', '#3a7040', '#2a563a'][Math.floor(v * 3)])); });
  const leafy = PAL.leaves || ['#6b5a4a'];
  const bm = new THREE.InstancedMesh(grad(lumpy(new THREE.IcosahedronGeometry(1, 2), 0.1, 1.3), -0.9, 0.75), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, vertexColors: true }), blobs.length);
  blobs.forEach(([x, y, z, s, v], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0, v * 6.28, 0); dummy.scale.set(s * 1.12, s * 0.9, s * 1.12); dummy.updateMatrix(); bm.setMatrixAt(i, dummy.matrix); bm.setColorAt(i, col(leafy[Math.floor(v * leafy.length)])); });
  bm.visible = !!PAL.leaves;
  // touffe : boules feuillues (silhouette bosselée, ombrage moucheté par des normales bruitées, dessous sombre)
  const leafyGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, nr = g.attributes.normal, n = new THREE.Vector3(), c = [];
    for (let i = 0; i < p.count; i++) {
      n.fromBufferAttribute(p, i).normalize();
      const big = Math.sin(n.x * 5.1 + 4.1) * Math.sin(n.y * 4.3 + 8.2) + 0.6 * Math.sin(n.z * 7.7 - n.x * 3.1 + 4.1), fine = Math.sin(n.x * 17 + n.y * 5) * Math.sin(n.y * 15 - n.z * 7) * Math.sin(n.z * 19 + n.x * 3);
      const k = 1 + 0.13 * big + 0.06 * fine; p.setXYZ(i, n.x * k, n.y * k, n.z * k);
      const nn = n.clone().add(new THREE.Vector3(Math.sin(n.y * 23 + n.z * 7), Math.sin(n.z * 21 + n.x * 5), Math.sin(n.x * 25 + n.y * 9)).multiplyScalar(0.32)).normalize(); nr.setXYZ(i, nn.x, nn.y, nn.z);
      const f = (0.55 + 0.55 * smooth(-0.85, 0.75, n.y)) * (0.86 + 0.2 * (fine * 0.5 + 0.5)); c.push(f, f, f);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g;
  })();
  const bushCols = SEASON === 'automne' ? ['#6f7f34', '#8a7a30', '#a0662c', '#5f7432', '#4f6a30'] : SEASON === 'hiver' ? ['#3f5a3a', '#4a5f42', '#36503a'] : ['#3f6e3a', '#4a7a3e', '#356236', '#5a8442'];
  const lumps = [], dots = [];
  bushes.forEach(([x, y, z, s, v], i) => {
    const rr = rngOf(700 + i), base = col(bushCols[Math.floor(v * bushCols.length)]), n = 3 + Math.floor(rr() * 3), rot = v * 6.28;
    lumps.push([x, y + s * 0.5, z, s, s * 0.82, base.clone().multiplyScalar(1.04)]);
    for (let j = 0; j < n; j++) { const a = rot + (j / n) * 6.28 + rr() * 0.6, d = s * (0.55 + rr() * 0.25), sz = s * (0.55 + rr() * 0.25); lumps.push([x + Math.cos(a) * d, y + sz * 0.42, z + Math.sin(a) * d, sz, sz * 0.78, vary(base, rr, 0.1).multiplyScalar(0.92)]); }
    if (SEASON !== 'hiver' && rr() < 0.45) { const dc = SEASON === 'automne' ? ['#b8322a', '#d0502e'] : ['#f4efe6', '#e8a0b8', '#f2d24a']; const pick = col(dc[Math.floor(rr() * dc.length)]);
      for (let j = 0; j < 9; j++) { const a = rr() * 6.28, el = 0.2 + rr() * 1.0, R0 = s * 0.98; dots.push([x + Math.cos(a) * Math.cos(el) * R0 * 1.05, y + s * 0.5 + Math.sin(el) * R0 * 0.8, z + Math.sin(a) * Math.cos(el) * R0 * 1.05, pick]); } }
  });
  // feuilles posées sur chaque boule (couverture dense, plus claires en haut) : c'est elles qu'on voit
  const leafShape = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.42, 0.45, 0.06, 0.42, 0.45, 0.06, 0, 1, 0.12], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0, 0, 0.45, 1, 0.45, 0.5, 1], 2)); g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals(); return g; })();
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide, ...(TX ? { map: TX.bushLeaf } : {}) });
  const leaves = [], up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), dir = new THREE.Vector3();
  lumps.forEach(([x, y, z, sxz, sy, c], li) => {
    const rr = rngOf(9000 + li), nL = Math.round(70 + 110 * sxz);
    for (let j = 0; j < nL; j++) {
      const th = rr() * 6.28, cy = Math.min(1, Math.max(-0.35, rr() * 1.45 - 0.35)), sr = Math.sqrt(1 - cy * cy); dir.set(Math.cos(th) * sr, cy, Math.sin(th) * sr);
      const px = x + dir.x * sxz * 0.97, py = y + dir.y * sy * 0.97, pz = z + dir.z * sxz * 0.97;
      q.setFromUnitVectors(up, dir.clone().lerp(up, 0.35).normalize()); dummy.quaternion.copy(q); dummy.rotateY(rr() * 6.28); dummy.rotateX(-0.5 - rr() * 0.6);
      dummy.position.set(px, py, pz); const ls = 0.07 + rr() * 0.05; dummy.scale.set(ls * 0.8, ls, ls); dummy.updateMatrix();
      const shade = 0.78 + 0.32 * (cy * 0.5 + 0.5); leaves.push([dummy.matrix.clone(), vary(c, rr, 0.16).multiplyScalar(shade)]);
    }
  });
  const lm = new THREE.InstancedMesh(leafShape, leafMat, leaves.length); leaves.forEach(([mx, c], i) => { lm.setMatrixAt(i, mx); lm.setColorAt(i, c); }); lm.castShadow = lm.receiveShadow = true; outdoor.add(lm);
  bushLeafMat = leafMat;
  const um = new THREE.InstancedMesh(leafyGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, vertexColors: true }), lumps.length);
  lumps.forEach(([x, y, z, sxz, sy, c], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0, i * 1.7, 0); dummy.scale.set(sxz * 0.95, sy * 0.95, sxz * 0.95); c = c.clone().multiplyScalar(0.7); dummy.updateMatrix(); um.setMatrixAt(i, dummy.matrix); um.setColorAt(i, c); });
  if (dots.length) { const dm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), dots.length); dots.forEach(([x, y, z, c], i) => { dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.028); dummy.updateMatrix(); dm.setMatrixAt(i, dummy.matrix); dm.setColorAt(i, c); }); outdoor.add(dm); }
  // vent dans les houppiers : le haut bouge plus que le bas, chaque arbre à son rythme (position de l'instance)
  const sway = (mat, amp, key) => {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = windU;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 wp = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        float hk = clamp(position.y + 0.6, 0.0, 1.6);
        float w = sin(uTime * 0.9 + wp.x * 0.21 + wp.z * 0.17) * 0.7 + sin(uTime * 2.3 + wp.x * 0.9 + position.y * 2.0 + position.x * 1.7) * 0.3;
        transformed.x += w * hk * ${amp.toFixed(3)}; transformed.z += w * hk * ${(amp * 0.5).toFixed(3)};`);
    };
    mat.customProgramCacheKey = () => key;
  };
  sway(cm.material, 0.035, 'swayCone'); sway(bm.material, 0.05, 'swayBlob'); sway(um.material, 0.02, 'swayBush'); if (bushLeafMat) sway(bushLeafMat, 0.35, 'swayBushLeaf'); // les feuilles frémissent
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

// La maison d'Ernest (construite plus haut, avec son allée) : fumée de la cheminée
const smoke = [];
{ const tex = softTex((x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(230,226,215,.7)'); g.addColorStop(1, 'rgba(230,226,215,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); });
  const base = cottageB.smokeOrigin.clone(); cottage.updateMatrixWorld(); base.applyMatrix4(cottage.matrixWorld);
  for (let i = 0; i < 12; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); smoke.push({ sp, t: i / 12, base }); scene.add(sp); } }
// La mare : eau, nénuphars, roseaux
const pond = { water: null };
{
  const px = 7.2, pz = -9.0, py = heightAt(px, pz); // derrière la serre Bien-être
  // eau non métallique, teinte du ciel (réglée par l'ambiance), et une rive de vase claire autour
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshStandardMaterial({ color: 0x4f7f84, roughness: 0.42, metalness: 0 })); water.rotation.x = -Math.PI / 2; water.scale.set(1, 0.7, 1); water.position.set(px, py + 0.02, pz); water.receiveShadow = true; scene.add(water); pond.water = water;
  const shore = new THREE.Mesh(new THREE.CircleGeometry(2.05, 32), new THREE.MeshStandardMaterial({ color: 0x9a8a68, roughness: 1, map: TX ? TX.soil : null })); shore.rotation.x = -Math.PI / 2; shore.scale.set(1, 0.72, 1); shore.position.set(px, py + 0.012, pz); shore.receiveShadow = true; scene.add(shore);
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
  const night = 1 - dayF; cottageB.update(clock.elapsedTime, night);
  for (const h of halos.cottage) setHalo(h, night * 0.9);
  for (const m of signMats) m.emissiveIntensity = night * 0.45;
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
  needle: leafGeo(0.006, 0.055, 0.01, 0.2, 2),
  // feuille ronde et festonnée du géranium, à plat (normale vers le haut), un peu en coupe
  roundLeaf: (() => { const s = new THREE.Shape(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 2, r = 0.05 * (1 + 0.07 * Math.cos(a * 9)) * (a > 4.5 && a < 4.92 ? 0.7 : 1); i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r + 0.045) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r + 0.045); }
    const g = new THREE.ShapeGeometry(s, 3); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i) + 0.045; p.setY(i, (x * x + z * z) * 6); } g.computeVertexNormals(); return g; })(),
  // colonne de cactus à côtes, hauteur 1, rayon 0,5, sommet arrondi
  cactus: (() => { const g = new THREE.LatheGeometry([[0, 0], [0.44, 0], [0.5, 0.08], [0.5, 0.78], [0.43, 0.93], [0.24, 0.99], [0, 1]].map(([x, y]) => new THREE.Vector2(x, y)), 16); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), k = 1 + 0.09 * Math.cos(Math.atan2(z, x) * 8); p.setX(i, x * k); p.setZ(i, z * k); } g.computeVertexNormals(); return g; })(),
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
const VIOLETS = ['#9d7cc8', '#b28fe0', '#7f5fb8', '#c7a6e8', '#8a6ac8'];
function flowering(rng, size, o = {}) {
  const pal = o.palette || FLOWERS, g = new THREE.Group(), stems = 3 + Math.floor(rng() * 5), fc = col(pal[Math.floor(rng() * pal.length)]);
  const leaves = inst(GEO.leafMid, M.leaf, stems * 6), petals = inst(GEO.petal, M.leaf, stems * 7), cores = inst(GEO.ball, M.leafFlat, stems); let kl = 0, kp = 0;
  const lavender = rng() < (o.lavender ?? 0.3); const spikes = lavender ? inst(GEO.ball, M.leafFlat, stems * 14) : null; let ks = 0;
  for (let s = 0; s < stems; s++) {
    const a = rng() * Math.PI * 2, r = rng() * 0.06, H = size * (0.35 + rng() * 0.3), lean = 0.05 + rng() * 0.12;
    const pts = [V(Math.cos(a) * r, 0, Math.sin(a) * r), V(Math.cos(a) * (r + lean * 0.4), H * 0.5, Math.sin(a) * (r + lean * 0.4)), V(Math.cos(a) * (r + lean), H, Math.sin(a) * (r + lean))];
    const { mesh, curve } = tube(pts, 0.0045, M.stem, 8); g.add(mesh);
    for (let i = 0; i < 3; i++) { const t = 0.15 + i * 0.22, p = curve.getPoint(t); for (const sd of [-1, 1]) { dummy.position.copy(p); dummy.rotation.set(0.9 * sd, a + i, 0.3); dummy.scale.setScalar(size * (1.1 - t)); dummy.updateMatrix(); leaves.setMatrixAt(kl, dummy.matrix); leaves.setColorAt(kl++, vary(col('#4f8a4a'), rng, 0.08)); } }
    const top = curve.getPoint(1);
    if (lavender) { for (let i = 0; i < 14; i++) { dummy.position.copy(top).add(V((rng() - 0.5) * 0.02, -i * 0.012 * size * 2, (rng() - 0.5) * 0.02)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.011 * (1 - i / 20)); dummy.updateMatrix(); spikes.setMatrixAt(ks, dummy.matrix); spikes.setColorAt(ks++, vary(col('#9d7cc8'), rng, 0.08)); } }
    else {
      for (let i = 0; i < 7; i++) { dummy.position.copy(top); dummy.rotation.set(-1.2, (i / 7) * Math.PI * 2, 0, 'YXZ'); dummy.scale.setScalar(size * 1.5); dummy.updateMatrix(); petals.setMatrixAt(kp, dummy.matrix); petals.setColorAt(kp++, vary(fc, rng, 0.06)); }
      dummy.position.copy(top).add(V(0, 0.01, 0)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.014); dummy.updateMatrix(); cores.setMatrixAt(s, dummy.matrix); cores.setColorAt(s, col('#e8b440'));
    }
  }
  leaves.count = kl; petals.count = kp; g.add(leaves); if (!lavender) { g.add(petals); g.add(cores); } else { spikes.count = ks; g.add(spikes); }
  return g;
}
function broadleaf(rng, size) {
  const g = new THREE.Group(), n = 4 + Math.floor(rng() * 4), im = inst(GEO.leafBig, M.leaf, n), base = col(['#4f8a5a', '#5a9462', '#467f52'][Math.floor(rng() * 3)]); // caoutchouc : vert franc, lisible
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
function grass(rng, size, tall = false) {
  const g = new THREE.Group(), n = (tall ? 28 : 36) + Math.floor(rng() * 30), im = inst(GEO.blade, M.leaf, n), base = col(['#7aa35e', '#9cc46a', '#5f8f4a', '#b8c48a'][Math.floor(rng() * 4)]);
  const plumes = tall ? inst(GEO.ball, M.leafFlat, 12) : null; let kp = 0;
  for (let i = 0; i < n; i++) { const a = rng() * Math.PI * 2, r = rng() * 0.07, h = size * (0.35 + rng() * 0.45); dummy.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); dummy.rotation.set((rng() - 0.5) * 0.3, a, 0, 'YXZ'); dummy.rotateX(-0.15 - rng() * 0.35); dummy.scale.set(1 + rng(), h, 1); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, vary(base, rng, 0.1));
    if (plumes && kp < 12 && i % 3 === 0) { const tip = V(0, 1, -0.25).applyMatrix4(dummy.matrix); dummy.position.copy(tip); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.012, 0.045, 0.012); dummy.updateMatrix(); plumes.setMatrixAt(kp, dummy.matrix); plumes.setColorAt(kp++, vary(col('#d8c890'), rng, 0.1)); } }
  g.add(im); if (plumes) { plumes.count = kp; g.add(plumes); } return g;
}
// Vie perso : fleurs des champs (marguerites, coquelicots, bleuets) dans un pied d'herbes
function wildflowers(rng, size) {
  const g = grass(rng, size * 0.5), heads = 7 + Math.floor(rng() * 5), petals = inst(GEO.petal, M.leaf, heads * 8), cores = inst(GEO.ball, M.leafFlat, heads); let kp = 0;
  const kinds = [['#f6f1e4', '#e8b440'], ['#d8402e', '#2a1a14'], ['#4f7fd8', '#2f3f80'], ['#f2d24a', '#c98a28'], ['#e9a6c8', '#e8b440']];
  for (let s = 0; s < heads; s++) {
    const a = rng() * 6.28, r = rng() * 0.07, H = size * (0.45 + rng() * 0.35), [pc, cc] = kinds[Math.floor(rng() * kinds.length)];
    const { mesh, curve } = tube([V(Math.cos(a) * r, 0, Math.sin(a) * r), V(Math.cos(a) * (r + 0.02), H * 0.55, Math.sin(a) * (r + 0.02)), V(Math.cos(a) * (r + 0.05 + rng() * 0.05), H, Math.sin(a) * (r + 0.05))], 0.0035, M.stem, 6); g.add(mesh);
    const top = curve.getPoint(1), np = pc === '#d8402e' ? 5 : 8;
    for (let i = 0; i < np; i++) { dummy.position.copy(top); dummy.rotation.set(pc === '#d8402e' ? -0.6 : -1.35, (i / np) * Math.PI * 2, 0, 'YXZ'); dummy.scale.setScalar(size * (pc === '#d8402e' ? 3.8 : 2.6)); dummy.updateMatrix(); petals.setMatrixAt(kp, dummy.matrix); petals.setColorAt(kp++, vary(col(pc), rng, 0.05)); }
    dummy.position.copy(top).add(V(0, 0.012, 0)); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(0.022); dummy.updateMatrix(); cores.setMatrixAt(s, dummy.matrix); cores.setColorAt(s, col(cc));
  }
  petals.count = kp; g.add(petals, cores); return g;
}
// Vie perso : géranium, un dôme de feuilles rondes et des boules de fleurs rouges sur de longues tiges
function geranium(rng, size) {
  const g = new THREE.Group(), nl = 10 + Math.floor(rng() * 5), stems = 3 + Math.floor(rng() * 3), leaves = inst(GEO.roundLeaf, M.leaf, nl), florets = inst(GEO.blob, M.leafFlat, stems * 18);
  const leafC = col(['#4f8a3a', '#5a9442', '#46803a'][Math.floor(rng() * 3)]), red = col(['#d8283a', '#e0323c', '#c81e34', '#e8504a', '#e0306a'][Math.floor(rng() * 5)]);
  for (let i = 0; i < nl; i++) {
    const a = i * 2.39996 + rng() * 0.3, out = 0.03 + (i / nl) * 0.1, y = size * (0.2 - (i / nl) * 0.13) + rng() * 0.02;
    dummy.position.set(Math.cos(a) * out, y, Math.sin(a) * out); dummy.quaternion.setFromUnitVectors(UP, V(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55).normalize()); dummy.rotateY(-a - Math.PI / 2); dummy.scale.setScalar(size * (1.05 + rng() * 0.45)); dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix); leaves.setColorAt(i, vary(leafC, rng, 0.08));
  }
  let k = 0;
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * 6.28 + rng() * 0.8, r = 0.02 + rng() * 0.05, H = size * (0.42 + rng() * 0.16), top = V(Math.cos(a) * (r + 0.04), H, Math.sin(a) * (r + 0.04));
    g.add(tube([V(Math.cos(a) * 0.015, 0.02, Math.sin(a) * 0.015), V(Math.cos(a) * r, H * 0.6, Math.sin(a) * r), top], 0.004, M.stem, 6).mesh);
    const R = size * (0.055 + rng() * 0.015), c = vary(red, rng, 0.05);
    for (let i = 0; i < 18; i++) { const u = i / 18, th = i * 2.39996, ph = Math.acos(1 - u * 1.3); dummy.position.set(top.x + Math.sin(ph) * Math.cos(th) * R, top.y + R * 0.5 + Math.cos(ph) * R * 0.8, top.z + Math.sin(ph) * Math.sin(th) * R); dummy.rotation.set(rng() * 3, rng() * 3, 0); dummy.scale.setScalar(R * (0.36 + rng() * 0.12)); dummy.updateMatrix(); florets.setMatrixAt(k, dummy.matrix); florets.setColorAt(k++, vary(c, rng, 0.06)); }
  }
  florets.count = k; g.add(leaves, florets); return g;
}
// Boulot : ficus, un petit tronc et un houppier de feuilles vernies
function ficus(rng, size) {
  const g = new THREE.Group(), H = size * (0.7 + rng() * 0.25), lean = V((rng() - 0.5) * 0.08, 0, (rng() - 0.5) * 0.08);
  const { mesh, curve } = tube([V(0, 0, 0), V(lean.x * 0.3, H * 0.45, lean.z * 0.3), V(lean.x, H, lean.z)], 0.01 * size + 0.006, M.bark, 8); g.add(mesh);
  const tips = [curve.getPoint(1)];
  for (let b = 0; b < 4; b++) { const a = b * 1.57 + rng() * 0.8, p0 = curve.getPoint(0.55 + b * 0.1), p1 = p0.clone().add(V(Math.cos(a) * 0.13 * size, (0.08 + rng() * 0.08) * size, Math.sin(a) * 0.13 * size)); g.add(tube([p0, p0.clone().lerp(p1, 0.5).add(V(0, 0.015, 0)), p1], 0.003 * size + 0.003, M.bark, 4).mesh); tips.push(p1); }
  const n = 70 + Math.floor(rng() * 30), im = inst(GEO.leafMid, M.leaf, n), base = col(['#2f5a2e', '#3a6a32', '#2a4f2c'][Math.floor(rng() * 3)]);
  for (let i = 0; i < n; i++) { const c = tips[i % tips.length], d = V(rng() - 0.5, rng() * 0.8 - 0.25, rng() - 0.5).normalize(); dummy.position.copy(c).addScaledVector(d, 0.16 * size * (0.35 + rng() * 0.65)); dummy.quaternion.setFromUnitVectors(UP, d.clone().add(V(0, 0.5, 0)).normalize()); dummy.rotateY(rng() * 6); dummy.scale.setScalar(size * (0.6 + rng() * 0.3)); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, vary(base, rng, 0.08)); }
  g.add(im); return g;
}
// Corps : cactus colonnaire, un ou deux bras, parfois une fleur
function cactus(rng, size) {
  const g = new THREE.Group(), arms = Math.floor(rng() * 3), im = inst(GEO.cactus, M.cactus, 1 + arms * 2), base = col(['#4f8a5a', '#5f9a62', '#46805a'][Math.floor(rng() * 3)]), H = size * (0.4 + rng() * 0.25), R = size * 0.085;
  let k = 0; const put = (x, y, z, sx, sy, rz = 0) => { dummy.position.set(x, y, z); dummy.rotation.set(0, 0, rz); dummy.scale.set(sx, sy, sx); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); im.setColorAt(k++, vary(base, rng, 0.06)); };
  put(0, 0, 0, R * 2, H);
  for (let a = 0; a < arms; a++) { const sd = a ? -1 : 1, y = H * (0.3 + rng() * 0.25), L = R * 1.6, ar = R * 1.3; put(sd * R * 0.5, y, 0, ar, L, -sd * Math.PI / 2); put(sd * (R * 0.5 + L), y - ar * 0.3, 0, ar, H * (0.3 + rng() * 0.2)); }
  g.add(im);
  if (rng() < 0.45) { const f = inst(GEO.petal, M.leaf, 6); for (let i = 0; i < 6; i++) { dummy.position.set(0, H * 0.98, 0); dummy.rotation.set(-0.9, (i / 6) * 6.28, 0, 'YXZ'); dummy.scale.setScalar(size * 1.4); dummy.updateMatrix(); f.setMatrixAt(i, dummy.matrix); f.setColorAt(i, col(['#e86f8a', '#f2b23d', '#f4efe6'][Math.floor(rng() * 3)])); } g.add(f); }
  return g;
}
// Esprit : un coussin de mousse, des pointes de jeunes frondes
function mossy(rng, size) {
  const g = new THREE.Group(), n = 70 + Math.floor(rng() * 40), im = inst(GEO.blob, M.leafFlat, n);
  for (let i = 0; i < n; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * 0.12, y = Math.sqrt(Math.max(0, 1 - (d / 0.13) ** 2)) * 0.07 * size * 1.4; dummy.position.set(Math.cos(a) * d, y, Math.sin(a) * d); dummy.rotation.set(rng(), rng() * 6, 0); const s = 0.018 + rng() * 0.02; dummy.scale.set(s * 1.4, s, s * 1.4); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, vary(col(rng() < 0.2 ? '#8fb04a' : rng() < 0.5 ? '#4f7a3a' : '#5f8a40'), rng, 0.12)); }
  g.add(im); const f = fern(rng, size * 0.45); f.position.y = 0.04; g.add(f); return g;
}
function aromatic(rng, size) {
  const g = new THREE.Group(), n = 70 + Math.floor(rng() * 50), im = inst(GEO.ball, M.leafFlat, n), base = col(['#6c9a52', '#7f9f6a', '#5d8a4e'][Math.floor(rng() * 3)]);
  for (let i = 0; i < n; i++) { const u = rng(), v = rng(), th = u * Math.PI * 2, ph = Math.acos(v), R = size * 0.2; dummy.position.set(Math.sin(ph) * Math.cos(th) * R, Math.cos(ph) * R * 0.9 + R * 0.35, Math.sin(ph) * Math.sin(th) * R); dummy.rotation.set(rng() * 3, rng() * 3, 0); dummy.scale.setScalar(0.012 + rng() * 0.012); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, vary(base, rng, 0.12)); }
  g.add(im); return g;
}
// Cuisine : basilic (grandes feuilles tendres par paires) et romarin (tiges dressées, aiguilles)
function basil(rng, size) {
  const g = new THREE.Group(), stems = 3 + Math.floor(rng() * 3), im = inst(GEO.leafMid, M.leaf, stems * 10), base = col(['#5fae3d', '#6cba44', '#4f9a36'][Math.floor(rng() * 3)]); let k = 0;
  for (let s = 0; s < stems; s++) { const a = (s / stems) * 6.28 + rng() * 0.5, H = size * (0.22 + rng() * 0.15), top = V(Math.cos(a) * 0.04, H, Math.sin(a) * 0.04); const { mesh, curve } = tube([V(0, 0, 0), V(Math.cos(a) * 0.02, H * 0.5, Math.sin(a) * 0.02), top], 0.004, M.stem, 6); g.add(mesh);
    for (let i = 0; i < 5; i++) { const t = 0.3 + i * 0.17, p = curve.getPoint(Math.min(1, t)); for (const sd of [-1, 1]) { dummy.position.copy(p); dummy.rotation.set(0.8 + (1 - t) * 0.5, a + sd * 1.57 + i * 1.57, 0, 'YXZ'); dummy.scale.setScalar(size * (1.6 - t * 0.7)); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); im.setColorAt(k++, vary(base, rng, 0.07)); } } }
  im.count = k; g.add(im); return g;
}
function rosemary(rng, size) {
  const g = new THREE.Group(), stems = 6 + Math.floor(rng() * 5), im = inst(GEO.needle, M.leaf, stems * 22), base = col('#5d7a5a'); let k = 0;
  for (let s = 0; s < stems; s++) { const a = rng() * 6.28, r = rng() * 0.05, H = size * (0.35 + rng() * 0.3), tilt = 0.04 + rng() * 0.1; const { mesh, curve } = tube([V(Math.cos(a) * r, 0, Math.sin(a) * r), V(Math.cos(a) * (r + tilt * 0.5), H * 0.5, Math.sin(a) * (r + tilt * 0.5)), V(Math.cos(a) * (r + tilt), H, Math.sin(a) * (r + tilt))], 0.003, M.bark, 6); g.add(mesh);
    for (let i = 0; i < 22; i++) { const t = 0.15 + (i / 22) * 0.85, p = curve.getPoint(t); dummy.position.copy(p); dummy.rotation.set(0.5 + rng() * 0.5, i * 2.4, 0, 'YXZ'); dummy.scale.setScalar(1.5 + rng() * 0.6); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); im.setColorAt(k++, vary(base, rng, 0.08)); } }
  im.count = k; g.add(im); return g;
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
const SPECIES = { fern, succulent, cactus, mossy, broadleaf, ficus, grass, wildflowers, aromatic, basil, rosemary, flowering, geranium,
  lavender: (r, s) => flowering(r, s, { palette: VIOLETS, lavender: 1 }), violet: (r, s) => flowering(r, s, { palette: VIOLETS, lavender: 0.25 }),
  thyme: aromatic, tallgrass: (r, s) => grass(r, s * 1.6, true) };

// ---------- Emplacements (coordonnées locales, les mêmes dans chaque serre) ----------
// Chaque catégorie a son allure : une espèce tirée parmi les siennes, à partir de la graine de la plante.
const speciesOf = (p) => floraOf(p)[0]; // mélange de végétaux propre à chaque serre (model.js, FLORA)
const SLOTS = [];
{ const t = [];
  for (const s of [1, -1]) for (let i = 0; i < 6; i++) for (const row of [0, 1]) t.push({ x: s * (TBX - 0.2 + row * 0.42), z: TZ1 - 0.45 - i * 0.92 + row * 0.35, y: TY + 0.042, i, row, s, floor: false });
  t.sort((a, b) => (a.i - b.i) || (a.row - b.row) || (a.s - b.s)); // d'abord près de la porte
  SLOTS.push(...t);
  for (const x of [1.55, -1.55]) SLOTS.push({ x, z: HD - 0.55, y: 0, floor: true }); // deux grands pots au sol, de part et d'autre de la porte
}
export const SLOTS_PER_HOUSE = SLOTS.length;
const live = new Map(); // id de plante -> { obj, plant, cur, target, phase, sway, slot, house }
for (const h of HOUSES) h.used = new Array(SLOTS.length).fill(false);
function buildPlant(p, h, slotIdx) {
  const sl = SLOTS[slotIdx], rng = rngOf(p.seed >>> 0), sp = speciesOf(p), g = new THREE.Group(), tall = sp === 'broadleaf' || sp === 'ficus';
  if (sl.floor) { g.add(makePot(2.1, h.pots[1])); const pl = compact(SPECIES[sp](rng, tall ? 0.95 : 1.2)); pl.position.y = 0.42; g.add(pl); g.position.set(sl.x, 0, sl.z); g.rotation.y = rng() * 6; h.g.add(g); return { obj: g, plant: pl }; }
  const big = tall ? 1.2 : 1, ps = (0.85 + rng() * 0.35) * big;
  g.add(makePot(ps, h.pots[rng() < 0.3 ? 1 : 0]));
  const pl = compact(SPECIES[sp](rng, 0.62 + rng() * 0.36)); pl.position.y = 0.19 * ps; g.add(pl);
  g.position.set(sl.x + (rng() - 0.5) * 0.08, sl.y, sl.z + (rng() - 0.5) * 0.08); g.rotation.y = rng() * Math.PI * 2;
  h.g.add(g); return { obj: g, plant: pl };
}
// Pour la cabane (js/cabane3d.js) : une plante de la réserve dans son pot, un bonsaï de l'étagère.
export function makeSpecimen(p) { const rng = rngOf(p.seed >>> 0), sp = speciesOf(p), g = new THREE.Group(); g.add(makePot(1.1, M.terra)); const pl = compact(SPECIES[sp](rng, 0.85)); pl.position.y = 0.21; g.add(pl); return g; }
export function makeBonsai(seed, branches) { return compact(bonsai(rngOf(seed >>> 0), Math.min(1.45, 0.6 + 0.12 * (branches || 0)))); }
// Bonsaïs du fond : un par objectif actif de la catégorie (trois au plus), une branche par étape franchie ;
// le plus fourni au centre, sur une petite sellette de bois.
const BONSAI_SPOTS = [[0, -HD + 0.85, 1], [-1.15, -HD + 0.7, 0.78], [1.15, -HD + 0.7, 0.78]];
const pedestals = (() => {
  const n = HOUSES.length * BONSAI_SPOTS.length, ped = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.32, 0.4, 12), M.wood, n), tray = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.08, 0.4), M.terraDark, n);
  ped.castShadow = ped.receiveShadow = tray.castShadow = true; scene.add(ped, tray);
  const set = (h, j, on) => { const [x, z, s] = BONSAI_SPOTS[j], i = HOUSES.indexOf(h) * BONSAI_SPOTS.length + j, k = on ? s : 0.0001, W = h.g.matrixWorld;
    m4.compose(V(x, 0.2 * k, z), Q0, V(k, k, k)); ped.setMatrixAt(i, W.clone().multiply(m4));
    m4.compose(V(x, 0.44 * k, z), Q0, V(k, k, k)); tray.setMatrixAt(i, W.clone().multiply(m4));
    ped.instanceMatrix.needsUpdate = tray.instanceMatrix.needsUpdate = true; };
  for (const h of HOUSES) for (let j = 0; j < BONSAI_SPOTS.length; j++) set(h, j, j === 0);
  return { set };
})();
for (const h of HOUSES) h.bonsai = BONSAI_SPOTS.map(() => ({ obj: null, key: '' }));
function setBonsai(h, list) {
  BONSAI_SPOTS.forEach(([x, z, s], j) => {
    const b = list[j], B = h.bonsai[j], key = b ? `${b.seed}:${b.branches}:${b.goal}` : '';
    if (key === B.key) return; B.key = key;
    if (B.obj) { h.g.remove(B.obj); disposeObj(B.obj); B.obj = null; }
    if (j > 0) pedestals.set(h, j, !!b);
    if (!b) return;
    B.obj = compact(bonsai(rngOf(b.seed >>> 0), Math.min(1.45, 0.6 + 0.12 * b.branches) * s)); B.obj.position.set(x, 0.48 * s, z); B.obj.userData.pick = { kind: 'bonsai', goal: b.goal }; h.g.add(B.obj);
  });
}
// suspensions : trois par serre, elles descendent avec les choses faites de la serre
const hanging = [];
for (const h of HOUSES) [[-0.8, 1.7], [0.8, -0.5], [-0.8, -2.5]].forEach(([x, z], i) => {
  const rng = rngOf(900 + i + HOUSES.indexOf(h) * 10), g = new THREE.Group(), topY = roofOf(h, x), y0 = 1.95;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.terra); bowl.castShadow = true; g.add(bowl);
  for (let c = 0; c < 3; c++) { const a = (c / 3) * Math.PI * 2; const p = V(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15), q = V(0, topY - y0, 0); const d = q.clone().sub(p); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, d.length(), 4), M.chain); m.position.copy(p).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); g.add(m); }
  const strands = 9, im = inst(GEO.heart, M.leaf, strands * 16); let k = 0;
  for (let s = 0; s < strands; s++) {
    const a = (s / strands) * Math.PI * 2 + rng() * 0.3, L = 0.4 + rng() * 0.5;
    const pts = [V(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12), V(Math.cos(a) * 0.24, -L * 0.3, Math.sin(a) * 0.24), V(Math.cos(a) * 0.2, -L, Math.sin(a) * 0.2)];
    const { mesh, curve } = tube(pts, 0.003, M.stem, 10); g.add(mesh);
    for (let i = 0; i < 16; i++) { const t = i / 16, p = curve.getPoint(t); dummy.position.copy(p); dummy.rotation.set(Math.PI * (0.5 + rng() * 0.5), a + (i % 2 ? 1 : -1) * 0.9, 0, 'YXZ'); dummy.scale.setScalar(1 + rng() * 0.6); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); im.setColorAt(k++, vary(col('#5fae6d'), rng, 0.1)); }
  }
  g.add(im); compact(g); g.position.set(x, y0, z); h.g.add(g); g.visible = false; hanging.push({ g, house: h, i, phase: rng() * 10, cur: 0, target: 0 });
});
// grimpantes : trois par serre, le long des poteaux puis sous le toit
const vines = [];
for (const h of HOUSES) [[HW - 0.08, 1], [-HW + 0.08, 3], [HW - 0.08, 5]].forEach(([x, bay], i) => {
  const z = -HD + (2 * HD) / BAYS * bay, rng = rngOf(300 + i + HOUSES.indexOf(h) * 10), s = Math.sign(x), pts = [];
  for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(V(x - s * 0.04 * Math.sin(t * 9), 0.5 + t * (HH - 0.5), z + 0.05 * Math.cos(t * 7))); }
  for (let k = 1; k <= 10; k++) { const t = k / 10; pts.push(V(lerp(x, s * 0.4, t) - s * 0.05, lerp(HH, roofOf(h, 0.4), t) - 0.08 + 0.04 * Math.sin(t * 8), z + 0.06 * Math.sin(t * 6))); }
  const curve = new THREE.CatmullRomCurve3(pts), geo = new THREE.TubeGeometry(curve, 100, 0.012, 5, false), mesh = new THREE.Mesh(geo, M.stem); mesh.castShadow = true;
  const n = 110, im = inst(GEO.heart, M.leaf, n);
  for (let k = 0; k < n; k++) { const t = k / n, p = curve.getPoint(t), tan = curve.getTangent(t); const side = new THREE.Vector3().crossVectors(tan, V(s, 0, 0)).normalize(); dummy.position.copy(p).addScaledVector(side, (k % 2 ? 1 : -1) * 0.02); dummy.quaternion.setFromUnitVectors(UP, V(-s, 0.6 + rng() * 0.4, (rng() - 0.5)).normalize()); dummy.rotateY((rng() - 0.5) * 1.2); dummy.scale.setScalar(1.6 + rng() * 1.6); dummy.updateMatrix(); im.setMatrixAt(k, dummy.matrix); im.setColorAt(k, vary(col('#4f8a4a'), rng, 0.12)); }
  h.g.add(mesh, im); vines.push({ mesh, im, n, house: h, i, idx: geo.index.count, cur: 0, target: 0 });
});
// mousses : au pied des murs, au bord de l'allée, entre les dalles ; une nappe par serre
const MOSS_MAX = 600;
const mosses = {};
for (const h of HOUSES) {
  const r = rngOf(5 + HOUSES.indexOf(h)), n = MOSS_MAX, im = new THREE.InstancedMesh(GEO.blob, M.leafFlat, n); im.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    let x, z;
    if (i % 3 === 0) { const s = r() < 0.5 ? -1 : 1; x = s * (HW - 0.15 - r() * 0.4); z = (r() - 0.5) * HD * 1.9; }
    else if (i % 3 === 1) { x = (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.32); z = (r() - 0.5) * HD * 1.9; }
    else { x = (r() - 0.5) * 1.2; z = HD - 0.2 - Math.floor(r() * 21) * 0.39 + 0.18; }
    dummy.position.set(x, 0, z); dummy.rotation.set(0, r() * 6, 0); const s = 0.012 + r() * 0.03; dummy.scale.set(s * 1.5, s * 0.55, s * 1.5); dummy.updateMatrix();
    im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, vary(col(r() < 0.15 ? '#7f9a4a' : r() < 0.5 ? '#3f6a35' : '#4f7a3a'), r, 0.12));
  }
  im.count = 0; h.g.add(im); mosses[h.id] = { im, n, cur: 0, target: 0 };
}
// champignons des jours gris : deux InstancedMesh pour les trois serres
const shrooms = (() => {
  const st = [], capM = new THREE.MeshStandardMaterial({ color: 0xc9783e, roughness: 0.7 }), stemM = new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.9 });
  HOUSES.forEach((h, hi) => [[-0.85, 2.9], [0.9, 0.4], [-0.9, -1.8]].forEach(([cx, cz], ci) => { const r = rngOf(60 + hi * 7 + ci); for (let i = 0, n = 4 + Math.floor(r() * 4); i < n; i++) st.push([toWorld(h, cx + (r() - 0.5) * 0.25, 0, cz + (r() - 0.5) * 0.25), 0.04 + r() * 0.05, 0.025 + r() * 0.02]); }));
  const sm = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.011, 1, 6), stemM, st.length), cm = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capM, st.length);
  st.forEach(([p, hh, cr], i) => { dummy.rotation.set(0, 0, 0); dummy.position.set(p.x, hh / 2, p.z); dummy.scale.set(1, hh, 1); dummy.updateMatrix(); sm.setMatrixAt(i, dummy.matrix); dummy.position.set(p.x, hh, p.z); dummy.scale.set(cr, cr * 0.7, cr); dummy.updateMatrix(); cm.setMatrixAt(i, dummy.matrix); });
  for (const m of [sm, cm]) { m.castShadow = true; m.visible = false; scene.add(m); }
  return { set(v) { sm.visible = cm.visible = !!v; } };
})();
// ---------- Lucioles des serres ----------
const flies = (() => {
  const n = 90, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seed = []; const r = rngOf(9);
  for (let i = 0; i < n; i++) { const h = HOUSES[i % HOUSES.length], p = toWorld(h, (r() - 0.5) * HW * 1.6, 0, (r() - 0.5) * HD * 1.8); seed.push([p.x, 0.4 + r() * 1.8, p.z, r() * 10, 0.2 + r() * 0.5]); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,230,160,1)'); gr.addColorStop(0.3, 'rgba(242,178,61,.6)'); gr.addColorStop(1, 'rgba(242,178,61,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const mat = new THREE.PointsMaterial({ size: 0.12, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const pts = new THREE.Points(geo, mat); scene.add(pts); return { pts, seed, pos, mat, n };
})();
// ---------- Ernest en 3D (js/ernest3d.js), sur l'allée devant la serre Travail ----------
// En plein écran, on peut se promener avec lui (3e ou 1re personne) : joystick, clavier, ou un tap sur une serre et il
// y va tout seul (chemin calculé autour des serres, de la chaumière et de la mare), puis arrose en arrivant.
const ERNEST = { x: 0.38, z: DOOR_Z + 0.75, y: 0 }; ERNEST.y = heightAt(ERNEST.x, ERNEST.z);
const ernest = createErnest({ scale: 0.4, lanternShadow: false });
ernest.root.position.set(ERNEST.x, ERNEST.y, ERNEST.z); ernest.root.rotation.y = 0.35; scene.add(ernest.root); ernest.attach(scene);
let ernestState = 'attend'; const GRIP = ernest.parts.lantern.parent; // la main qui tient la lanterne
const ERNEST_POSE = { attend: 'attend', arrose: 'arrose', assis: 'assis', dort: 'dort', salue: 'salue', lanterne: 'lanterne' };
const groundAt = (x, z) => (inHouse(x, z, 0.05) ? 0.03 : heightAt(x, z));
const houseAt = (x, z) => { for (const h of HOUSES) { const [lx, lz] = toLocal(h, x, z); if (Math.abs(lx) < HW && Math.abs(lz) < HD) return h.id; } return null; };

// Obstacles. Murs : segments (serres, battant de porte ouvert, panneaux) ; tables : boîtes dans le repère de leur serre ;
// chaumière, mare, buissons : cercles ; le muret : une ellipse dont on ne sort pas.
const WALLS = [], TABLES = [], ROUND = [];
for (const h of HOUSES) {
  const seg = (x0, z0, x1, z1) => WALLS.push([toWorld(h, x0, 0, z0), toWorld(h, x1, 0, z1)]);
  seg(-HW, -HD, -HW, HD); seg(HW, -HD, HW, HD); seg(-HW, -HD, HW, -HD); seg(-HW, HD, -0.62, HD); seg(0.62, HD, HW, HD);
  seg(0.62, HD + 0.06, 0.62 + Math.cos(-0.3) * 1.12, HD + 0.06 - Math.sin(-0.3) * 1.12); // battant ouvert
  { const c = Math.cos(0.22), sn = Math.sin(0.22); seg(-1.62 - 0.76 * c, HD + 0.75 + 0.76 * sn, -1.62 + 0.76 * c, HD + 0.75 - 0.76 * sn); } // panneau
  for (const sd of [-1, 1]) TABLES.push({ h, x0: sd * TBX - 0.5, x1: sd * TBX + 0.5, z0: TZ0 - 0.04, z1: TZ1 + 0.04 });
}
ROUND.push([cottage.position.x + 0.1, cottage.position.z, 2.35], [7.2, -9.0, 1.85]);
for (const [x, , z, sz] of bushSpots) if (Math.hypot(x / 12.5, z / 15) < 1) ROUND.push([x, z, sz * 1.1 + 0.1]);
const closestOnSeg = (px, pz, a, b, out) => { const dx = b.x - a.x, dz = b.z - a.z, L = dx * dx + dz * dz; const t = L ? Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / L)) : 0; out[0] = a.x + dx * t; out[1] = a.z + dz * t; return out; };
const _c = [0, 0];
function collide(p, r = 0.24) {
  for (let it = 0; it < 3; it++) {
    for (const [a, b] of WALLS) { closestOnSeg(p.x, p.z, a, b, _c); const dx = p.x - _c[0], dz = p.z - _c[1], d = Math.hypot(dx, dz); if (d < r && d > 1e-6) { p.x = _c[0] + (dx / d) * r; p.z = _c[1] + (dz / d) * r; } }
    for (const T of TABLES) { const [lx, lz] = toLocal(T.h, p.x, p.z); if (lx < T.x0 - r || lx > T.x1 + r || lz < T.z0 - r || lz > T.z1 + r) continue;
      const cx = Math.max(T.x0, Math.min(T.x1, lx)), cz = Math.max(T.z0, Math.min(T.z1, lz)); let dx = lx - cx, dz = lz - cz, d = Math.hypot(dx, dz);
      if (d < 1e-6) { const ex = Math.min(lx - T.x0, T.x1 - lx), ez = Math.min(lz - T.z0, T.z1 - lz); if (ex < ez) { dx = lx - (T.x0 + T.x1) / 2 > 0 ? 1 : -1; dz = 0; } else { dz = lz - (T.z0 + T.z1) / 2 > 0 ? 1 : -1; dx = 0; } d = 1; }
      if (d < r) { const nx = cx + (dx / d) * r, nz = cz + (dz / d) * r, w = toWorld(T.h, nx, 0, nz); p.x = w.x; p.z = w.z; } }
    for (const [x, z, R] of ROUND) { const dx = p.x - x, dz = p.z - z, d = Math.hypot(dx, dz), m = R + r; if (d < m && d > 1e-6) { p.x = x + (dx / d) * m; p.z = z + (dz / d) * m; } }
    ext.beds.forEach((b, i) => { if (b.rise < 0.5) return; const B = BEDS[i], cx = Math.max(B.x - B.hx, Math.min(B.x + B.hx, p.x)), cz = Math.max(B.z - B.hz, Math.min(B.z + B.hz, p.z)), dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz); if (d < r && d > 1e-6) { p.x = cx + (dx / d) * r; p.z = cz + (dz / d) * r; } });
    const e = Math.hypot(p.x / 11.7, p.z / (11.7 * 1.2)); if (e > 1) { p.x /= e; p.z /= e; } // le muret
  }
  return p;
}
// Le segment a→b traverse-t-il un mur ? (renvoie la fraction du premier choc, ou 1)
function wallHit(ax, az, bx, bz) {
  let best = 1; const rx = bx - ax, rz = bz - az;
  for (const [a, b] of WALLS) { const sx = b.x - a.x, sz = b.z - a.z, den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) continue; const t = ((a.x - ax) * sz - (a.z - az) * sx) / den, u = ((a.x - ax) * rz - (a.z - az) * rx) / den; if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < best) best = t; }
  return best;
}
const roundHit = (ax, az, bx, bz, pad) => ROUND.some(([x, z, R]) => { closestOnSeg(x, z, { x: ax, z: az }, { x: bx, z: bz }, _c); return Math.hypot(x - _c[0], z - _c[1]) < R + pad; });
// Un passage est libre s'il ne coupe rien et qu'il garde une marge le long des murs et des panneaux (Ernest a une
// largeur : sans marge, le chemin frôlait le bout du panneau Travail et il s'y cognait en allant à la chaumière).
const clearPath = (a, b) => {
  if (wallHit(a.x, a.z, b.x, b.z) < 1 || roundHit(a.x, a.z, b.x, b.z, 0.3)) return false;
  const L = Math.hypot(b.x - a.x, b.z - a.z), n = Math.ceil(L / 0.15);
  for (let i = 1; i < n; i++) { const d = (i / n) * L; if (d < 0.4 || L - d < 0.4) continue; const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n;
    for (const [p, q] of WALLS) { closestOnSeg(x, z, p, q, _c); if (Math.hypot(x - _c[0], z - _c[1]) < 0.34) return false; } }
  return true;
};
// Graphe de passage : coins des serres (élargis), devant et derrière chaque porte, l'allée, le tour de la chaumière et de la mare.
const NAV = [];
for (const h of HOUSES) { for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) NAV.push(toWorld(h, x * (HW + 0.75), 0, z * (HD + 0.75))); NAV.push(toWorld(h, 0, 0, HD + 1.3), toWorld(h, 0, 0, HD - 0.6), toWorld(h, 0, 0, 0.2));
  NAV.push(toWorld(h, -1.62, 0, HD + 1.9), toWorld(h, -3.1, 0, HD + 0.6), toWorld(h, -0.35, 0, HD + 1.6)); } // autour du panneau : devant, au-delà de son bout, entre lui et la porte
for (const [x, z, R] of ROUND.slice(0, 2)) for (let i = 0; i < 8; i++) NAV.push(V(x + Math.cos(i * 0.785) * (R + 0.7), 0, z + Math.sin(i * 0.785) * (R + 0.7)));
const COT_DOOR = (() => { const d = cottageB.door.clone().applyMatrix4(cottage.matrixWorld); d.addScaledVector(V(Math.sin(0.5), 0, Math.cos(0.5)), 1.3); d.y = 0; return d; })();
function route(from, to) {
  const nodes = [from, ...NAV.filter((n) => Math.hypot(n.x / 11.7, n.z / 14) < 1), to], N = nodes.length, dist = new Array(N).fill(Infinity), prev = new Array(N).fill(-1), done = new Array(N).fill(false);
  dist[0] = 0;
  for (let k = 0; k < N; k++) {
    let u = -1; for (let i = 0; i < N; i++) if (!done[i] && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || dist[u] === Infinity) break; done[u] = true; if (u === N - 1) break;
    for (let v = 0; v < N; v++) { if (done[v]) continue; const d = dist[u] + nodes[u].distanceTo(nodes[v]); if (d < dist[v] && clearPath(nodes[u], nodes[v])) { dist[v] = d; prev[v] = u; } }
  }
  if (prev[N - 1] < 0) return [to];
  const out = []; for (let i = N - 1; i > 0; i = prev[i]) out.unshift(nodes[i].clone()); return out;
}

// Promenade : état, entrées (joystick, clavier, glisser pour regarder), caméras.
const walk = { on: false, view: 'third', yaw: Math.PI, pitch: 0.32, dist: 2.7, distCur: 2.7, ix: 0, iz: 0, keys: new Set(), auto: null, speed: 0, pose: null, poseUntil: 0, onArrive: null, onPlace: null, place: undefined };
const KEYS = { KeyW: [0, 1], KeyZ: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], KeyQ: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => { if (!walk.on || !KEYS[e.code] || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return; walk.keys.add(e.code); walk.auto = null; e.preventDefault(); });
  window.addEventListener('keyup', (e) => walk.keys.delete(e.code));
  window.addEventListener('blur', () => walk.keys.clear());
}
const tmpV = new THREE.Vector3(), camGoal = new THREE.Vector3();
function lanternWanted() { return !!(amb.cur && amb.cur.lantern > 3); }
function setFirstPerson(on) {
  const L = ernest.parts.lantern;
  if (on) { scene.add(camera); camera.add(L); L.position.set(0.17, -0.2, -0.55); L.quaternion.identity(); L.scale.setScalar(0.4 * 1.15); }
  ernest.parts.model.traverse((o) => { if (o.isMesh) o.visible = !on; });
  if (!on) { GRIP.add(L); L.position.set(0, 0, 0); L.scale.setScalar(1.15); }
  // la lanterne garde ses propres réglages de visibilité (allumée ou rangée)
  L.userData.swing.children.forEach((c) => { if (!c.isLight) c.visible = !!(L.userData.on); });
}
function updateWalk(dt, t) {
  const p = ernest.root.position;
  // entrée : clavier + joystick, dans le repère de la caméra
  let ix = walk.ix, iz = walk.iz; for (const k of walk.keys) { ix += KEYS[k][0]; iz += KEYS[k][1]; }
  const im = Math.hypot(ix, iz); if (im > 1) { ix /= im; iz /= im; }
  const fx = Math.sin(walk.yaw), fz = Math.cos(walk.yaw);
  let mx = fx * iz - fz * ix, mz = fz * iz + fx * ix, mag = Math.min(1, Math.hypot(ix, iz));
  if (mag > 0.05) walk.auto = null;
  else if (walk.auto) { // pilote automatique : de point en point
    const w = walk.auto.pts[walk.auto.i], dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz);
    if (d < (walk.auto.i === walk.auto.pts.length - 1 ? 0.12 : 0.45)) { walk.auto.i++; if (walk.auto.i >= walk.auto.pts.length) { const fin = walk.auto; walk.auto = null; if (fin.face != null) walk.faceTo = fin.face; if (fin.pose) { walk.pose = fin.pose; walk.poseUntil = t + 3.2; } if (fin.then) fin.then(); } }
    else { mx = dx / d; mz = dz / d; mag = Math.min(1, d * 1.5 + 0.35); }
    // la caméra se range doucement derrière lui
    if (walk.auto && walk.view === 'third') { const h = Math.atan2(mx, mz); let dy = h - walk.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); walk.yaw += dy * Math.min(1, dt * 1.6); }
  }
  const target = mag * 1.15; walk.speed += (target - walk.speed) * Math.min(1, dt * 6);
  if (walk.speed > 0.02) {
    const ml = Math.hypot(mx, mz) || 1; tmpV.set(p.x + (mx / ml) * walk.speed * dt, 0, p.z + (mz / ml) * walk.speed * dt);
    collide(tmpV); p.x = tmpV.x; p.z = tmpV.z;
    if (walk.view === 'third' || walk.auto) { const h = Math.atan2(mx, mz); let dh = h - ernest.root.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); ernest.root.rotation.y += dh * Math.min(1, dt * 9); }
    walk.pose = null; walk.faceTo = null;
  } else if (walk.faceTo != null) { let dh = walk.faceTo - ernest.root.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); ernest.root.rotation.y += dh * Math.min(1, dt * 5); }
  if (walk.view === 'first' && !walk.auto) ernest.root.rotation.y = walk.yaw;
  p.y += (groundAt(p.x, p.z) - p.y) * Math.min(1, dt * 12);
  ernest.setWalk(walk.speed / 0.75);
  ernest.setPose(walk.pose && t < walk.poseUntil ? walk.pose : 'attend');
  // lieu : pour la légende (« dans la serre Travail »)
  const pl = houseAt(p.x, p.z) || (p.distanceTo(COT_DOOR) < 2.2 ? 'chaumiere' : null); if (pl !== walk.place) { walk.place = pl; if (walk.onPlace) walk.onPlace(pl); }
  // caméra
  if (walk.view === 'first') {
    camera.position.set(p.x, p.y + 0.95, p.z);
    tmpV.set(p.x + Math.sin(walk.yaw) * Math.cos(walk.pitch), p.y + 0.95 - Math.sin(walk.pitch), p.z + Math.cos(walk.yaw) * Math.cos(walk.pitch)); camera.lookAt(tmpV);
    const L = ernest.parts.lantern, ph = t * 9.5; L.position.set(0.17 + Math.sin(ph * 0.5) * 0.008 * walk.speed, -0.2 + Math.abs(Math.cos(ph * 0.5)) * 0.012 * walk.speed, -0.55); L.rotation.set(Math.sin(ph * 0.5) * 0.08 * walk.speed, 0, Math.sin(t * 1.3) * 0.06);
  } else {
    const tg = tmpV.set(p.x, p.y + 0.72, p.z), cp = Math.cos(walk.pitch), sp = Math.sin(walk.pitch);
    camGoal.set(tg.x - Math.sin(walk.yaw) * cp * walk.dist, tg.y + sp * walk.dist, tg.z - Math.cos(walk.yaw) * cp * walk.dist);
    const hit = wallHit(tg.x, tg.z, camGoal.x, camGoal.z), dMax = hit < 1 ? Math.max(0.6, hit * walk.dist * cp - 0.3) / Math.max(0.2, cp) : walk.dist;
    walk.distCur = dMax < walk.distCur ? dMax : walk.distCur + (dMax - walk.distCur) * Math.min(1, dt * 3);
    camera.position.set(tg.x - Math.sin(walk.yaw) * cp * walk.distCur, tg.y + sp * walk.distCur, tg.z - Math.cos(walk.yaw) * cp * walk.distCur);
    const gy = groundAt(camera.position.x, camera.position.z) + 0.25; if (camera.position.y < gy) camera.position.y = gy;
    if (houseAt(camera.position.x, camera.position.z) && camera.position.y > 2.05) camera.position.y = 2.05;
    camera.lookAt(tg.x, tg.y - 0.05, tg.z);
  }
}
function setWalk(on, view) {
  if (view) walk.view = view;
  const wasFirst = walk.on && walk._fp;
  walk.on = !!on && mode === 'full';
  const fp = walk.on && walk.view === 'first';
  if (fp !== !!wasFirst) { setFirstPerson(fp); walk._fp = fp; }
  if (controls) controls.enabled = mode === 'full' && !walk.on;
  if (walk.on) { fly = null; if (!walk.started) { walk.started = true; ernest.root.rotation.y = Math.PI; walk.faceTo = Math.PI; } walk.yaw = ernest.root.rotation.y; walk.pitch = walk.view === 'first' ? 0.08 : 0.3; walk.distCur = walk.dist; camera.fov = walk.view === 'first' ? 70 : 52; } // la première fois : dos à la caméra, face à la serre Travail
  else { walk.ix = walk.iz = 0; walk.keys.clear(); walk.auto = null; walk.speed = 0; ernest.setWalk(0); ernest.setPose(ERNEST_POSE[ernestState] || 'attend'); camera.fov = 55; if (controls) { controls.target.copy(ernest.root.position).add(V(0, 0.6, 0)); controls.update(); } }
  if (renderer) renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, walk.on && !DESK ? 1.5 : 2)); // promenade sur téléphone : un peu moins de pixels, une marche plus fluide
  camera.updateProjectionMatrix(); resize(); poke();
}
function walkTo(id) {
  if (!walk.on) return;
  const p = ernest.root.position, from = V(p.x, 0, p.z);
  let to, face = null, pose = 'arrose';
  if (HB[id]) { const h = HB[id]; to = toWorld(h, 0, 0, -0.6); face = Math.atan2(-h.sin, -h.cos); } // au fond de l'allée, face aux bonsaïs
  else { to = COT_DOOR.clone(); face = 0.5 + Math.PI; pose = 'salue'; }
  walk.auto = { pts: route(from, to), i: 0, face, pose };
}
// Le regard : glisser sur la scène (hors joystick)
function bindLook(canvas) {
  let last = null, pinch = null; const pts = new Map();
  canvas.addEventListener('pointerdown', (e) => { if (!walk.on) return; pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!walk.on || !pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) { const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) walk.dist = Math.max(1.3, Math.min(6, walk.dist * (pinch / d))); pinch = d; return; }
    const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY];
    walk.yaw -= dx * 0.0065; walk.pitch = Math.max(walk.view === 'first' ? -0.7 : -0.1, Math.min(walk.view === 'first' ? 0.95 : 1.05, walk.pitch + dy * 0.005 * (walk.view === 'first' ? 1 : 1)));
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = null; if (pts.size === 1) last = [...pts.values()][0]; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => { if (!walk.on) return; e.preventDefault(); walk.dist = Math.max(1.3, Math.min(6, walk.dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
}
function updateErnest(dt, t, still) {
  if (!walk.on) { ernest.setPose(ERNEST_POSE[ernestState] || 'attend'); }
  const L = ernest.parts.lantern; L.userData.on = walk.on ? lanternWanted() : ernestState === 'lanterne' || (lanternWanted() && ernestState === 'attend');
  ernest.update(dt, { lantern: L.userData.on, lanternK: 2.4, groundY: ernest.root.position.y, still });
}

// ---------- Halos sans bloom : sprites additifs autour des lumières ----------
const glowTex = softTex((x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,220,160,.95)'); g.addColorStop(0.22, 'rgba(255,184,96,.55)'); g.addColorStop(0.6, 'rgba(255,150,60,.16)'); g.addColorStop(1, 'rgba(255,140,50,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }, 64, 64);
const halo = (parent, pos, size) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 })); sp.position.copy(pos); sp.scale.setScalar(size); sp.visible = false; sp.userData.size = size; parent.add(sp); return sp; };
const setHalo = (sp, k) => { sp.material.opacity = Math.min(1, k); sp.visible = k > 0.01; };
const halos = { lanterns: lanterns.map((l) => { const sp = halo(l.g, V(0, 0, 0), 2.1); sp.material.color.set('#ffffff').lerp(col(l.house.accent), 0.3); return sp; }), cottage: cottageB.glowPoints.map((g) => halo(cottage, g.p, g.s * 1.45)) };

// ---------- Monde interactif ----------
// Toucher : un tap court (sans glisser) lance un rayon depuis la caméra ; le premier objet « pickable » touché est
// renvoyé à l'app (plante, bonsaï, panneau, chaumière, Ernest, graine dorée).
let pickFn = null, nearFn = null, findFn = null, near = undefined, nearT = 0;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
cottage.userData.pick = { kind: 'cottage' }; ernest.root.userData.pick = { kind: 'ernest' };
function pickAt(cx, cy) {
  if (!renderer || mode !== 'full' || !pickFn) return;
  const r = renderer.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera); ray.far = 40;
  const list = [...[...live.values()].map((L) => L.obj), ...HOUSES.flatMap((h) => h.bonsai.map((B) => B.obj).filter(Boolean)), ...SIGNS, cottage, ...FINDS.filter((f) => f.on).map((f) => f.g)];
  if (!(walk.on && walk.view === 'first')) list.push(ernest.root);
  const hit = ray.intersectObjects(list, true).find((x) => x.object.visible !== false && !x.object.isSprite && !x.object.isPoints);
  if (!hit) return;
  for (let o = hit.object; o; o = o.parent) if (o.userData.pick) { pickFn({ ...o.userData.pick, dist: hit.distance }); return; }
}
function bindPick(canvas) {
  let d = null;
  canvas.addEventListener('pointerdown', (e) => { d = e.isPrimary ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
  canvas.addEventListener('pointerup', (e) => { if (!d || !e.isPrimary) return; const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y), dt = performance.now() - d.t; d = null; if (moved < 10 && dt < 450) pickAt(e.clientX, e.clientY); });
}
// En promenade : la plante ou le panneau le plus proche d'Ernest (pour un bouton « Arroser » ou « Le panneau »)
const _w = new THREE.Vector3();
function updateNear(t) {
  if (t - nearT < 0.2 || !nearFn) return; nearT = t;
  const p = ernest.root.position; let best = null, bd = 1.05;
  for (const L of live.values()) { L.obj.getWorldPosition(_w); const d = Math.hypot(_w.x - p.x, _w.z - p.z); if (d < bd) { bd = d; best = { kind: 'plant', id: L.id }; } }
  if (!best) for (const sg of SIGNS) { sg.getWorldPosition(_w); if (Math.hypot(_w.x - p.x, _w.z - p.z) < 1.3) { best = { ...sg.userData.pick }; break; } }
  const key = best ? best.kind + (best.id || best.house) : '';
  if (key !== near) { near = key; nearFn(best); }
}
// Arroser une plante : en promenade, Ernest va jusqu'à l'allée devant elle, se tourne et arrose ; sinon, la plante
// frémit tout de suite. done() est appelé quand l'eau tombe.
function waterPlant(id, done) {
  const L = live.get(id); if (!L) { if (done) done(); return; }
  const fire = () => { pop = { obj: L.obj, t: clock.elapsedTime }; poke(); if (done) done(); };
  if (!walk.on) { fire(); return; }
  const h = L.house, lp = L.obj.position, side = Math.sign(lp.x) || 1;
  const [ax, az] = SLOTS[L.slot] && SLOTS[L.slot].floor ? [side * 0.9, HD - 1.0] : [side * 1.0, lp.z];
  const to = toWorld(h, ax, 0, az); L.obj.getWorldPosition(_w);
  const face = Math.atan2(_w.x - to.x, _w.z - to.z), p = ernest.root.position;
  walk.auto = { pts: Math.hypot(p.x - to.x, p.z - to.z) < 0.4 ? [to] : route(V(p.x, 0, p.z), to), i: 0, face, pose: 'arrose', then: () => setTimeout(fire, 700) };
}
// Graines dorées : des emplacements cachés dans le jardin (sous les tables, derrière les serres, au bord de la mare,
// près de la chaumière, au pied du muret) ; l'app en choisit trois par jour. On les ramasse en passant à côté.
const FIND_SPOTS = (() => {
  const out = [], add = (v) => { const q = V(v.x, 0, v.z), c = collide(q.clone(), 0.12); if (q.distanceTo(c) > 0.3) return; out.push(c); };
  for (const h of HOUSES) {
    for (const sd of [-1, 1]) add(toWorld(h, sd * (TBX - 0.42), 0, TZ0 + 0.5)); // sous le bord des tables, au fond
    add(toWorld(h, 0.9, 0, -HD - 0.7)); add(toWorld(h, HW + 0.55, 0, -1.2)); add(toWorld(h, -HW - 0.55, 0, 1.4));
  }
  for (const [x, z] of [[9.4, -8.2], [5.0, -8.6], [7.3, -11.3], [-3.2, -10.6], [-8.7, -7.4], [0, 9.6], [-6.2, 11.0], [6.1, 10.8], [10.4, 2.0], [-10.4, 2.6], [2.6, -9.8], [-1.6, 5.6]]) add(V(x, 0, z));
  return out;
})();
const FINDS = (() => {
  const geo = new THREE.SphereGeometry(0.045, 16, 12); geo.scale(0.8, 1.25, 0.8);
  const mat = new THREE.MeshStandardMaterial({ color: 0xf2c24a, emissive: 0xf2a23d, emissiveIntensity: 1.6, roughness: 0.3, metalness: 0.4 });
  const leafM = new THREE.MeshStandardMaterial({ color: 0x6aa84f });
  return FIND_SPOTS.map((p, i) => {
    const g = new THREE.Group(); g.position.set(p.x, groundAt(p.x, p.z) + 0.16, p.z); g.visible = false; scene.add(g);
    const seed = new THREE.Group(); g.add(seed);
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; seed.add(m);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 6), leafM); leaf.position.y = 0.07; leaf.rotation.z = 0.4; seed.add(leaf);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.85 })); glow.scale.setScalar(0.55); g.add(glow);
    g.userData.pick = { kind: 'seed', id: i };
    return { g, seed, glow, on: false, take: 0, i, y: g.position.y };
  });
})();
function setFinds(ids) { const want = new Set(ids || []); for (const f of FINDS) { f.on = want.has(f.i); f.take = 0; f.g.visible = f.on; f.g.scale.setScalar(1); f.g.position.y = f.y; } poke(); }
function updateFinds(t) {
  const p = ernest.root.position;
  for (const f of FINDS) {
    if (!f.on && !f.take) continue;
    if (f.take) { const k = (t - f.take) / 0.8; if (k >= 1) { f.take = 0; f.g.visible = false; continue; } f.g.position.y = f.y + k * 0.5; f.g.scale.setScalar(1 + k * 0.6); f.glow.material.opacity = 0.85 * (1 - k); continue; }
    f.seed.rotation.y = t * 1.4 + f.i; f.seed.position.y = Math.sin(t * 2.2 + f.i) * 0.025; f.glow.material.opacity = 0.6 + Math.sin(t * 3 + f.i) * 0.25;
    if (walk.on && Math.hypot(f.g.position.x - p.x, f.g.position.z - p.z) < 0.55) { f.on = false; f.take = t; if (findFn) findFn(f.i); }
  }
}
// Position d'Ernest à l'écran (au-dessus du chapeau), pour la bulle ; null s'il n'est pas visible.
function ernestScreen() {
  if (!renderer || mode !== 'full' || (walk.on && walk.view === 'first')) return null;
  ernest.parts.hatP.getWorldPosition(_w); _w.y += 0.45; _w.project(camera);
  if (_w.z > 1 || Math.abs(_w.x) > 1.1 || Math.abs(_w.y) > 1.1) return null;
  const r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (_w.x + 1) / 2 * r.width, y: r.top + (1 - _w.y) / 2 * r.height };
}


// ---------- Ombres douces au sol (« blob shadows ») : un disque radial instancié, un seul appel de dessin ----------
const blobTex = softTex((x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,.62)'); g.addColorStop(0.5, 'rgba(0,0,0,.38)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, w); }, 64, 64);
const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, color: 0x0b120c, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const blobGeo = new THREE.PlaneGeometry(2, 2); blobGeo.rotateX(-Math.PI / 2);
{
  const spots = [[cottage.position.x + 0.1, cottage.position.z, 2.6, 0.82], ...treeSpots.map(([x, z, r]) => [x, z, r, 1]), ...wallStones.filter((_, i) => i % 3 === 0).map(([x, , z, s]) => [x, z, s * 2.1, 0.8])];
  const im = new THREE.InstancedMesh(blobGeo, blobMat, spots.length), e = 0.4, n = new THREE.Vector3();
  spots.forEach(([x, z, r, sx], i) => {
    n.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
    dummy.position.set(x, heightAt(x, z) - 0.01, z); dummy.quaternion.setFromUnitVectors(UP, n); dummy.scale.set(r * sx, 1, r); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
  });
  im.renderOrder = 1; outdoor.add(im);
}

// ---------- Vignette : un quad plein écran dans la scène (pas de passe de post-traitement) ----------
const vignette = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  transparent: true, depthTest: false, depthWrite: false, fog: false,
  uniforms: { uK: { value: 0.5 }, uCol: { value: col('#0c140f') }, uAsp: { value: 1.5 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: 'uniform float uK; uniform vec3 uCol; uniform float uAsp; varying vec2 vUv; void main(){ vec2 d = (vUv - 0.5) * vec2(min(uAsp, 2.0), 1.0) / max(1.0, min(uAsp, 2.0) * 0.75); float v = smoothstep(0.32, 0.92, length(d)) * uK; v += (1.0 - smoothstep(0.0, 0.18, vUv.y)) * uK * 0.25; gl_FragColor = vec4(uCol, v); }',
}));
vignette.frustumCulled = false; vignette.renderOrder = 1e6; scene.add(vignette);

// ---------- Petits effets demandés par l'app : lanterne de minuteur, graines du lendemain, feuille morte ----------
const nowS = () => performance.now() / 1000;
const ease = (k) => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
// Lanterne posée par terre à droite de la porte de la serre Travail : allumée tant qu'une tâche est chronométrée.
const taskLamp = (() => {
  const g = new THREE.Group(), glassM = new THREE.MeshStandardMaterial({ color: 0xffe2a8, roughness: 0.3, emissive: 0xffa040, emissiveIntensity: 0 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.15, 6), glassM); body.position.y = 0.1; g.add(body);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.07, 6), M.chain); cap.position.y = 0.21; g.add(cap);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.085, 0.03, 6), M.chain); foot.position.y = 0.015; g.add(foot);
  for (const o of [body, cap, foot]) o.castShadow = true;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.012; pool.visible = false; g.add(pool);
  const h = halo(g, V(0, 0.11, 0), 0.9);
  { const p = toWorld(HB.travail, 0.98, 0, HD + 0.32); g.position.set(p.x, heightAt(p.x, p.z), p.z); } scene.add(g);
  return { g, glassM, pool, h, k: 0, from: 0, to: 0, t0: -99 };
})();
function setLantern(on) {
  const L = taskLamp, to = on ? 1 : 0; if (to === L.to) return;
  L.from = L.k; L.to = to; L.t0 = nowS(); animate();
}
// Graines du lendemain : de petits godets avec une pousse, dans les places libres des tables.
const SEED_MAX = 12;
const seeds = (() => {
  const pots = new THREE.InstancedMesh(pot, M.terra, SEED_MAX), soils = new THREE.InstancedMesh(soilGeo, M.soil, SEED_MAX), sprouts = new THREE.InstancedMesh(leafGeo(0.035, 0.09, 0.03, 0.4, 4), M.leaf, SEED_MAX * 2);
  for (const m of [pots, soils, sprouts]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
  pots.castShadow = true;
  return { pots, soils, sprouts, n: 0, t0: -99, spots: [] };
})();
// Deux rangées de godets au bord de l'allée principale, entre la serre Travail et la fourche : à gauche, puis à droite.
function seedSpots(n) { const out = []; for (let i = 0; i < n; i++) { const z = DOOR_Z + 1.0 + (i % 6) * 0.42 + (i < 6 ? 0 : 0.21), x = pathX(z) + (i < 6 ? -0.8 : 0.8); out.push({ x, z, y: heightAt(x, z) }); } return out; }
function plantSeeds(n) {
  const S = seeds; S.n = Math.max(0, Math.min(SEED_MAX, Math.round(Number(n) || 0))); S.spots = seedSpots(S.n); S.t0 = nowS(); animate();
}
const seedCol = col('#8fc06a');
function updateSeeds(now) {
  const S = seeds, n = S.n; S.pots.count = S.soils.count = n; S.sprouts.count = n * 2;
  for (let i = 0; i < n; i++) {
    const sl = S.spots[i], h = hash2(i * 7 + 3, 11), k = ease((now - S.t0 - i * 0.1) / 0.7), pop = k * (1 + Math.sin(k * Math.PI) * 0.25), ps = 0.72, px = sl.x + (h - 0.5) * 0.06, pz = sl.z + (hash2(i, 5) - 0.5) * 0.06, py = sl.y;
    dummy.position.set(px, py, pz); dummy.rotation.set(0, h * 6, 0); dummy.scale.setScalar(Math.max(0.001, ps * Math.min(1, k * 1.6))); dummy.updateMatrix(); S.pots.setMatrixAt(i, dummy.matrix); S.soils.setMatrixAt(i, dummy.matrix);
    for (const sd of [-1, 1]) { dummy.position.set(px, py + 0.185 * ps, pz); dummy.rotation.set(sd * 0.75, h * 6, 0, 'YXZ'); dummy.scale.setScalar(Math.max(0.001, pop * (0.9 + h * 0.4))); dummy.updateMatrix(); S.sprouts.setMatrixAt(i * 2 + (sd > 0 ? 1 : 0), dummy.matrix); S.sprouts.setColorAt(i * 2 + (sd > 0 ? 1 : 0), seedCol); }
  }
  S.pots.instanceMatrix.needsUpdate = S.soils.instanceMatrix.needsUpdate = S.sprouts.instanceMatrix.needsUpdate = true; if (S.sprouts.instanceColor) S.sprouts.instanceColor.needsUpdate = true;
}
// Feuille morte : tombe en virevoltant et se pose sur le gravier ; « annuler » la fait remonter et disparaître.
const leafPool = (() => { const geo = leafGeo(0.11, 0.26, 0.08, 0.45, 5), out = [];
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: ['#d9862e', '#e6a83a', '#c2602a'][i % 3], roughness: 0.85, side: THREE.DoubleSide, map: TX ? TX.leaf : null, transparent: true })); m.rotation.order = 'YXZ'; m.visible = false; m.castShadow = true; scene.add(m); out.push({ m, state: 'off', t0: 0, x: 0, y: 0, z: 0, h: 0 }); }
  return out; })();
let leafSeq = 0;
function dropLeaf() {
  const L = leafPool.find((l) => l.state === 'off') || leafPool.reduce((a, b) => (a.t0 < b.t0 ? a : b));
  const i = leafSeq++; L.state = 'fall'; L.t0 = nowS(); L.h = hash2(i, 91); L.z = DOOR_Z + 0.5 + hash2(i, 23) * 2.2; L.x = pathX(L.z) - 0.1 - hash2(i, 17) * 0.45; L.y = heightAt(L.x, L.z); L.m.visible = true; animate(); // sur l'allée, à gauche d'Ernest
}
function restoreLeaf() {
  const L = leafPool.filter((l) => l.state === 'fall' || l.state === 'rest').sort((a, b) => b.t0 - a.t0)[0]; if (!L) return;
  L.state = 'rise'; L.t0 = nowS(); animate();
}
const FALL = 2.1, RISE = 1.6;
function updateLeaves(now) {
  for (const L of leafPool) {
    if (L.state === 'off') continue;
    const m = L.m, e = now - L.t0, ph = L.h * 6.28;
    if (L.state === 'fall' && e >= FALL) L.state = 'rest';
    if (L.state === 'fall') { const k = e / FALL, y = L.y + lerp(2.35, 0.045, ease(k) * 0.35 + k * 0.65), sw = (1 - k) * 0.35;
      m.position.set(L.x + Math.sin(e * 3.2 + ph) * sw, y, L.z + Math.cos(e * 2.1 + ph) * sw * 0.5); m.rotation.set(-Math.PI / 2 * ease(k) + Math.sin(e * 4.1 + ph) * 0.9 * (1 - k), ph + e * 1.5, Math.sin(e * 3.2 + ph) * 0.8 * (1 - k)); m.material.opacity = 1; }
    else if (L.state === 'rest') { m.position.set(L.x, L.y + 0.045, L.z); m.rotation.set(-Math.PI / 2 + 0.06, ph + FALL * 1.5, 0); m.material.opacity = 1; }
    else { const k = Math.min(1, e / RISE); m.position.set(L.x + Math.sin(e * 2.5 + ph) * 0.12 * k, L.y + 0.045 + ease(k) * 1.6, L.z); m.rotation.set(-Math.PI / 2 * (1 - k), ph + FALL * 1.5 - e * 1.2, Math.sin(e * 3 + ph) * 0.4 * k); m.material.opacity = 1 - ease(k);
      if (k >= 1) { L.state = 'off'; m.visible = false; } }
  }
}
function updateFx(now, t) {
  const L = taskLamp; L.k = lerp(L.from, L.to, ease((now - L.t0) / 1.2));
  const fl = 0.9 + 0.06 * Math.sin(t * 9.1) + 0.04 * Math.sin(t * 17.3 + 1), k = L.k * fl;
  L.glassM.emissiveIntensity = k * 2.6; setHalo(L.h, k * 0.95); L.pool.material.opacity = k * 0.7; L.pool.visible = k > 0.01;
  updateSeeds(now); updateLeaves(now);
}
// Bandeau : fenêtre d'animation de 2,5 s après un de ces appels, puis retour à l'image fixe.
let animUntil = 0, animOn = false;
function animate() { animUntil = Math.max(animUntil, performance.now() + 2500); poke(); }

// ---------- Données → scène ----------
// Pure : ce que les serres doivent montrer pour un état d'Ernest.
// Dehors : le chemin s'allonge avec le total, un carré de potager par catégorie (dès 8 choses faites).
export function extFromState(S, n, mood) {
  const keys = Object.keys(S.days), counts = catCounts(S, keys);
  return {
    path: Math.min(1, n / 300),
    beds: BED_CATS.map((c, i) => { const k = BED_CATS.slice(0, i).filter((x) => x === c).length, v = (counts[c] || 0) - 8 - 40 * k; return v >= 0 ? Math.min(1, v / 60) : -1; }), // 1er carré à 8, puis un de plus tous les 40
    flowers: Math.max(0.15, Math.min(1, 0.35 + 0.4 * Math.min(1, n / 150) + (mood === 'high' ? 0.25 : mood === 'low' ? -0.15 : 0))),
  };
}
// Dans chaque serre : ses plantes (les plus récentes, autant que de places), sa mousse, ses grimpantes et ses
// suspensions selon ses propres choses faites, et un bonsaï par objectif actif de ses catégories.
export function houseFromState(S, today, id, counts, n) {
  const H = HB[id], ps = S.garden.plants || [], mine = (p) => houseOf(p.cat) === id;
  const goals = Array.isArray(S.goals) ? new Map(S.goals.map((g) => [g.id, g])) : null;
  let hn = H.cats.reduce((a, c) => a + (counts[c] || 0), 0);
  if (id === 'perso') hn += Math.max(0, n - Object.entries(counts).reduce((a, [c, v]) => a + (HOUSE_OF[c] ? v : 0), 0)); // sans catégorie
  const plants = ps.filter((p) => p.kind === 'plant' && !p.dormant && mine(p)).slice(-SLOTS_PER_HOUSE).map((p) => ({ id: p.id, cat: p.cat, seed: p.seed, v: p.v, sp: p.sp, g: growth(p, S, today) })); // v, sp : l'espèce donne le dessin (floraOf)
  const mossN = ps.filter((p) => (p.kind === 'moss' || p.list) && mine(p)).length;
  const bonsai = ps.filter((p) => p.kind === 'bonsai' && mine(p) && (!goals || !p.goal || bonsaiInSerre(p, goals.get(p.goal))))
    .sort((a, b) => (b.branches || 0) - (a.branches || 0)).slice(0, BONSAI_SPOTS.length).map((p) => ({ seed: p.seed, branches: p.branches || 0, goal: p.goal || null }));
  return { n: hn, plants, moss: Math.min(MOSS_MAX, mossN * 8 + Math.max(0, hn - 10) * 3), vine: Math.min(1, hn / 80), hanging: [8, 25, 50].filter((k) => hn >= k).length, bonsai };
}
export function modelFromState(S, today) {
  const n = totalDone(S), counts = catCounts(S, Object.keys(S.days)), mood = moodAvg(S, today), houses = {};
  for (const id of HOUSE_IDS) houses[id] = houseFromState(S, today, id, counts, n);
  return { houses, shrooms: mood === 'low', mood: mood === 'low' ? 1 : mood === 'high' ? 4 : 3, ...extFromState(S, n, mood) };
}
const EMPTY_HOUSE = { n: 0, plants: [], moss: 0, vine: 0, hanging: 0, bonsai: [] };
let model = { houses: {}, shrooms: false, mood: 3, path: 0, beds: [], flowers: 0.5 };
let pop = null;
function applyModel(m) {
  const sig = JSON.stringify(m); if (sig === lastSig) return; lastSig = sig;
  model = m; poke();
  const hm = (h) => (m.houses && m.houses[h.id]) || EMPTY_HOUSE, keep = new Map();
  for (const h of HOUSES) for (const p of hm(h).plants || []) keep.set(p.id, h);
  for (const [id, L] of live) if (keep.get(id) !== L.house) { L.house.g.remove(L.obj); disposeObj(L.obj); L.house.used[L.slot] = false; live.delete(id); }
  for (const h of HOUSES) {
    const H = hm(h);
    (H.plants || []).forEach((p, i) => {
      let L = live.get(p.id);
      if (!L) {
        const slot = i < SLOTS.length && !h.used[i] ? i : h.used.indexOf(false); if (slot < 0) return; // serre pleine
        h.used[slot] = true; L = { ...buildPlant(p, h, slot), slot, house: h, id: p.id, cur: 0.001, phase: (p.seed % 1000) / 100, sway: p.cat === 'perso' || p.cat === 'revision' ? 0.05 : 0.025 }; live.set(p.id, L); L.obj.userData.pick = { kind: 'plant', id: p.id };
      }
      L.target = 0.35 + 0.65 * p.g;
    });
    vines.filter((v) => v.house === h).forEach((v) => { v.target = Math.max(0, Math.min(1, (H.vine || 0) * 1.25 - v.i * 0.12)); });
    mosses[h.id].target = Math.min(MOSS_MAX, H.moss || 0);
    hanging.filter((g) => g.house === h).forEach((g) => { g.target = g.i < (H.hanging || 0) ? 1 : 0; });
    setBonsai(h, Array.isArray(H.bonsai) ? H.bonsai : H.bonsai ? [H.bonsai] : []);
  }
  ext.stones.target = Math.round(9 + (ext.stones.n - 9) * (m.path || 0));
  ext.flowers.target = m.flowers ?? 0.5;
  ext.beds.forEach((b, i) => { const v = m.beds ? m.beds[i] : -1; b.riseT = v >= 0 ? 1 : 0; b.growT = v >= 0 ? 0.25 + 0.75 * v : 0; });
  shrooms.set(m.shrooms);
}

// ---------- Ambiances ----------
const TIMES = {
  day: { top: '#7fb8d6', bottom: '#d9e6c8', fog: '#bcd6d0', fogNear: 22, fogFar: 80, hemiSky: '#cfe8f2', hemiGround: '#5b4a30', hemi: 1.15, sun: '#fff1d6', sunI: 2.6, sunPos: [6, 10, 5], lantern: 0.6, flies: 0, stars: 0, moon: 0, exposure: 1.0, rim: 0.32, rimCol: '#fff4dc', glass: 1, glow: 0, vig: 0.42, bloom: 0.12, bloomT: 0.95 },
  dusk: { top: '#2a3a5c', bottom: '#e0956a', fog: '#6b5a62', fogNear: 18, fogFar: 70, hemiSky: '#e0a080', hemiGround: '#3a2a22', hemi: 0.7, sun: '#ffb070', sunI: 1.4, sunPos: [-9, 3.5, 2], lantern: 5, flies: 0.5, stars: 0.3, moon: 0.4, exposure: 1.05, rim: 0.5, rimCol: '#ffb880', glass: 0.7, glow: 0.3, vig: 0.5, bloom: 0.45, bloomT: 0.7 },
  night: { top: '#0e2140', bottom: '#1f3352', fog: '#1c2a40', fogNear: 16, fogFar: 80, hemiSky: '#3f5c8c', hemiGround: '#101b2c', hemi: 0.6, sun: '#9fb8e0', sunI: 0.55, sunPos: [-6, 9, -6], lantern: 11, flies: 1, stars: 1, moon: 1, exposure: 0.9, rim: 0.42, rimCol: '#ffc27a', glass: 0.4, glow: 0.75, vig: 0.5, bloom: 0.55, bloomT: 0.55 },
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
  skyMat.uniforms.top.value.set(a.top); skyMat.uniforms.bottom.value.set(a.bottom); scene.fog.color.set(a.fog); scene.fog.near = a.fogNear; scene.fog.far = a.fogFar;
  rimU.uRimK.value = a.rim * (mode === 'band' ? 1.6 : 1); rimU.uRimCol.value.set(a.rimCol); glassU.uGlassK.value = a.glass; glassU.uGlow.value = a.glow * (0.8 + mood * 0.05); vignette.material.uniforms.uK.value = a.vig;
  pond.water.material.color.set(a.top).lerp(col(a.bottom), 0.25).lerp(col('#3d6a6c'), 0.55);
  hemi.color.set(a.hemiSky); hemi.groundColor.set(a.hemiGround); hemi.intensity = a.hemi * m * 1.0; // le reste de l'ambiance vient du ciel réfléchi (refreshEnv)
  envU.ground.value.set(a.hemiGround).lerp(col('#4f7a3a'), 0.5).multiplyScalar(0.4 + a.sunI * 0.15);
  const sd = sunDirAt(hourSun); skyLife.sunDir.copy(sd);
  sun.color.set(a.sun); sun.intensity = a.sunI * m * 0.9;
  if (sd.y > 0.02) sun.position.copy(sd).multiplyScalar(16); else sun.position.set(...a.sunPos);
  skyMat.uniforms.sunDir.value.copy(sd); skyMat.uniforms.glowK.value = Math.max(0, Math.min(1, (sd.y + 0.12) * 4)); skyMat.uniforms.glow.value.set(sd.y < 0.18 ? '#ff9a5a' : '#ffe2b0');
  for (const l of lanterns) l.light.intensity = a.lantern * (0.8 + mood * 0.08) * (0.95 + Math.sin(t * 7 + l.house.x) * 0.03);
  for (const h of halos.lanterns) setHalo(h, Math.max(0, (a.lantern - 1.2) / 6));
  M.bulb.emissiveIntensity = 0.4 + a.lantern * 0.3; for (const b of bulbMats) b.emissiveIntensity = M.bulb.emissiveIntensity;
  moon.position.copy(sd).multiplyScalar(-60).setY(Math.max(18, -sd.y * 60)); flies.mat.opacity = a.flies; stars.material.opacity = a.stars * 0.85; moon.material.opacity = a.moon; moon.material.transparent = true; moon.visible = a.moon > 0.02;
  if (renderer) renderer.toneMappingExposure = a.exposure * (0.9 + mood * 0.04);
  updateLife(a, t, dt, sd, hourSun);
  if (bloom) { bloom.strength = a.bloom; bloom.threshold = a.bloomT; }
  refreshEnv(false);
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
  for (const mo of Object.values(mosses)) { mo.cur = lerp(mo.cur, mo.target, k); mo.im.count = Math.round(mo.cur); }
  { const S = ext.stones; S.cur = lerp(S.cur, S.target, k * 0.6); S.im.count = Math.round(S.cur); const F = ext.flowers; F.cur = lerp(F.cur, F.target, k); F.im.count = Math.round(F.n * F.cur); }
  ext.beds.forEach((b, i) => {
    b.rise = lerp(b.rise, b.riseT, k * 0.7); b.grow = lerp(b.grow, b.riseT > 0 && b.rise > 0.9 ? b.growT : 0, k * 0.8);
    b.g.visible = b.rise > 0.01; b.g.position.y = b.y - 0.32 + 0.32 * b.rise; zoneU.value[i] = b.rise;
    b.crops.forEach((c, j) => { const s = Math.max(0.001, Math.min(1, b.grow * 11 - j) * (0.55 + 0.45 * b.grow)); c.scale.setScalar(s * 1.7); c.rotation.z = Math.sin(t * 1.4 + j + i) * 0.04; });
  });
  for (const h of HOUSES) for (const B of h.bonsai) if (B.obj) B.obj.rotation.z = Math.sin(t * 0.9 + h.x) * 0.006;
}

// ---------- Rendu ----------
const clock = new THREE.Clock();
// Bandeau : une image fixe, recalculée quand quelque chose change, et un nouvel angle toutes les demi-heures.
let stillDirty = true, stillSlot = -1, lastSig = '';
const poke = () => { stillDirty = true; if (renderer) renderer.shadowMap.needsUpdate = true; };
// Six angles, un par demi-heure. Ceux qui portent « house » sont en coordonnées locales de cette serre (porte vers +z).
const ANGLES = [
  { pos: [-0.3, 4.3, 14.8], t: [-0.6, 1.3, -1.5], fov: 54 },                     // vue d'ensemble, plus basse : on voit les plantes à travers le verre
  { house: 'travail', pos: [1.1, 4.6, 12.4], t: [-0.3, 0.5, 1.9], fov: 40 }, // la serre Travail et l'allée (lanterne, graines, feuille)
  { house: 'bienetre', pos: [-0.5, 3.5, 9.6], t: [-0.8, 0.95, -0.4], fov: 40 }, // la serre Bien-être, son panneau à gauche
  { house: 'perso', pos: [-0.5, 3.5, 9.6], t: [-0.8, 0.95, -0.4], fov: 40 },     // la serre Vie perso, son panneau à gauche
  { house: 'perso', pos: [0.2, 1.45, 1.9], t: [-1.75, 0.95, -0.9], fov: 58 },    // à hauteur de table, Vie perso : géraniums, fleurs des champs
  { house: 'bienetre', pos: [0.2, 1.45, 1.9], t: [-1.75, 0.95, -0.9], fov: 58 }, // à hauteur de table, Bien-être : cactus, plantes grasses, aromatiques
];
const angleWorld = (a) => { if (!a.house) return { pos: V(...a.pos), t: V(...a.t) }; const h = HB[a.house]; return { pos: toWorld(h, a.pos[0], a.pos[1], a.pos[2]), t: toWorld(h, a.t[0], a.t[1], a.t[2]) }; };
let forcedAngle = null; // pour la page de démonstration
let mode = 'band', running = false, visible = true, last = 0, onFps = null, frames = 0, fpsT = 0;
// Sélecteur de serre : la caméra glisse vers une serre (vue de trois quarts, porte en face) ou vers l'ensemble.
let fly = null;
// vue d'ensemble : plus haute et plus loin en portrait, pour que les trois serres tiennent dans l'écran
const overview = () => (camera.aspect < 1 ? [new THREE.Vector3(0, 22, 39), new THREE.Vector3(0, 0.4, -3)] : [new THREE.Vector3(2.2, 11.5, 19.5), new THREE.Vector3(0, 0.6, -1.8)]);
function focus(id) {
  if (!renderer) return;
  let p1, t1;
  const h = HB[id];
  if (!h) { const [p, t] = overview(); p1 = p; t1 = t; }
  else { h.g.updateMatrixWorld(true); const portrait = camera.aspect < 1; // un peu à gauche et assez loin : le panneau reste dans le cadre, même en portrait
    p1 = (portrait ? V(-0.8, 4.2, HD + 9.5) : V(-0.3, 3.8, HD + 7.5)).applyMatrix4(h.g.matrixWorld); t1 = (portrait ? V(-0.8, 0.9, 0) : V(-0.6, 0.9, 0)).applyMatrix4(h.g.matrixWorld); }
  fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1, t1, s: performance.now() };
}
function frame(now) {
  if (!running) return;
  requestAnimationFrame(frame);
  if (!visible) return;
  if (mode === 'band') {
    // fenêtre d'animation (lanterne, graines, feuille) : quelques secondes d'images, puis une image fixe propre
    // ordinateur : le bandeau vit en continu (vent dans l'herbe et les arbres), à 30 images/s
    if (LIVE_BAND) { if (stillDirty || stillSlot !== Math.floor(Date.now() / 1800000)) stillFrame(); if ((bandTick++ & 1) === 0) bandAnimFrame(); animOn = true; return; }
    if (performance.now() < animUntil) { if (stillSlot < 0) stillFrame(); bandAnimFrame(); animOn = true; }
    else { if (animOn) { animOn = false; stillDirty = true; } stillFrame(); }
    return;
  }
  const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
  updateErnest(dt, t, false); updateFinds(t); if (walk.on) updateNear(t);
  if (walk.on) updateWalk(dt, t);
  else {
    if (fly) { const e = Math.min(1, (performance.now() - fly.s) / 1100), k = e < 0.5 ? 2 * e * e : 1 - (-2 * e + 2) ** 2 / 2; camera.position.lerpVectors(fly.p0, fly.p1, k); controls.target.lerpVectors(fly.t0, fly.t1, k); if (e >= 1) fly = null; }
    { const T = controls.target; T.x = Math.max(-10, Math.min(10, T.x)); T.z = Math.max(-9, Math.min(9, T.z)); T.y = Math.max(0.4, Math.min(2.2, T.y)); }
    controls.update(); { const hy = heightAt(camera.position.x, camera.position.z) + 0.9; if (camera.position.y < hy) camera.position.y = hy; }
  }
  if ((frames & (walk.on ? (DESK ? 0 : 1) : 7)) === 0) renderer.shadowMap.needsUpdate = true; // ombres : une image sur huit, à chaque image (ou une sur deux) en promenade
  updateAmbience(dt, t); updateGrowth(dt, t); windU.value = t; updateFx(nowS(), t);
  for (let i = 0; i < flies.n; i++) { const [x, y, z, ph, sp] = flies.seed[i]; flies.pos[i * 3] = x + Math.sin(t * sp + ph) * 0.5; flies.pos[i * 3 + 1] = y + Math.sin(t * sp * 1.7 + ph * 2) * 0.25; flies.pos[i * 3 + 2] = z + Math.cos(t * sp * 0.8 + ph) * 0.5; }
  flies.pts.geometry.attributes.position.needsUpdate = true;
  draw();
  frames++; const pn = performance.now(); if (!fpsT) fpsT = pn; if (pn - fpsT > 1000) { if (onFps) onFps(Math.round(frames * 1000 / (pn - fpsT))); frames = 0; fpsT = pn; }
}
// Image fixe du bandeau : tout est amené à son état final (ciel, croissance), puis une seule image.
function stillFrame() {
  const slot = Math.floor(Date.now() / 1800000);
  if (!stillDirty && slot === stillSlot) return;
  const a = ANGLES[forcedAngle ?? ((slot % ANGLES.length) + ANGLES.length) % ANGLES.length], w = angleWorld(a);
  camera.position.copy(w.pos); camera.lookAt(w.t); camera.fov = a.fov || 40; camera.updateProjectionMatrix();
  if (camera.position.y < heightAt(camera.position.x, camera.position.z) + 0.9) camera.position.y = heightAt(camera.position.x, camera.position.z) + 0.9;
  const t = LIVE_BAND && bandT0 ? 2.5 + (performance.now() - bandT0) / 1000 : 2.5; pop = null; // bandeau vivant : le vent ne saute pas
  for (let i = 0; i < 14; i++) { updateAmbience(1, t); updateGrowth(1, t); }
  for (let i = 0; i < 45; i++) updateErnest(1 / 30, t, true); // Ernest posé dans sa pose, sans clignement
  windU.value = t; updateFx(nowS(), t); renderer.shadowMap.needsUpdate = true; refreshEnv(true);
  draw();
  stillDirty = false; stillSlot = slot; if (!LIVE_BAND) bandT0 = 0;
}
// Une image animée du bandeau : la caméra reste celle de l'image fixe, le temps repart de celui de l'image fixe.
let bandT0 = 0, bandFrames = 0;
function bandAnimFrame() {
  const dt = Math.min(0.05, clock.getDelta()); if (!bandT0) bandT0 = performance.now();
  const t = 2.5 + (performance.now() - bandT0) / 1000;
  if ((bandFrames++ & 7) === 0) renderer.shadowMap.needsUpdate = true;
  pop = null;
  updateAmbience(dt, t); updateGrowth(dt, t); updateErnest(dt, t, false); windU.value = t; updateFx(nowS(), t);
  draw();
}
// ---------- Ordinateur : halo lumineux autour des lumières (bloom) et ombres plus douces ----------
// Réservé à l'ordinateur (pointeur fin, pas de mobile) : sur téléphone, la batterie passe avant. Chargé à la demande.
const DESK = typeof window !== 'undefined' && window.matchMedia && matchMedia('(pointer: fine) and (min-width: 900px)').matches && !/iPhone|iPad|Android/i.test(navigator.userAgent);
let composer = null, bloom = null;
const LIVE_BAND = DESK && !matchMedia('(prefers-reduced-motion: reduce)').matches; let bandTick = 0;
const draw = () => (composer ? composer.render() : renderer.render(scene, camera));
async function setupPost() {
  try {
    const base = '../vendor/jsm/postprocessing/';
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all(['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass'].map((f) => import(`${base}${f}.js`)));
    const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
    const c = new EffectComposer(renderer, new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType, samples: 4 }));
    c.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(sz.x, sz.y), 0.4, 0.55, 0.8); c.addPass(bloom);
    c.addPass(new OutputPass());
    composer = c; resize();
  } catch { composer = null; bloom = null; }
}
function resize() {
  if (!renderer) return; const c = renderer.domElement, w = c.clientWidth || c.parentElement.clientWidth, h = c.clientHeight || c.parentElement.clientHeight;
  if (!w || !h) return; renderer.setSize(w, h, false); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); } camera.aspect = w / h; camera.updateProjectionMatrix(); vignette.material.uniforms.uAsp.value = w / h; poke();
}

// ---------- API ----------
export function webglOk() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { return false; } }
// Monte la serre sur un canvas. opts : { mode: 'band' | 'full', onFps }
export function mount(canvas, opts = {}) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.type = THREE.PCFShadowMap; // + radius : bords d'ombre fondus
  if (DESK) { renderer.shadowMap.type = THREE.VSMShadowMap; sun.shadow.radius = 5; sun.shadow.blurSamples = 12; setupPost(); } // ordinateur : pénombre large et douce
  renderer.toneMapping = THREE.CustomToneMapping; // ACES + saturation et contraste (voir « Étalonnage » en tête)
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.enablePan = true; controls.screenSpacePanning = false; controls.panSpeed = 0.7; controls.minDistance = 2.2; controls.maxDistance = 48; // la vue d'ensemble en portrait est à 47
  controls.maxPolarAngle = Math.PI * 0.49; controls.minPolarAngle = 0.25; controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.8;
  onFps = opts.onFps || null; bindLook(canvas); bindPick(canvas);
  setMode(opts.mode || 'band');
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; if (visible) clock.getDelta(); });
  if ('IntersectionObserver' in window) new IntersectionObserver((e) => { visible = e[0].isIntersecting && document.visibilityState === 'visible'; if (visible) clock.getDelta(); }).observe(canvas);
  resize(); running = true; requestAnimationFrame(frame);
  return api;
}
export function setMode(m) {
  if (m !== 'full' && walk.on) setWalk(false);
  mode = m;
  if (!renderer) return;
  controls.enabled = m === 'full';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // bandeau net aussi : surtout une image fixe, le surcoût est faible
  if (ext.grass) ext.grass.im.count = m === 'full' ? ext.grass.n : Math.round(ext.grass.n * 0.3); // moins de brins dans le bandeau
  poke();
  if (m === 'full') { camera.fov = 55; resize(); const [p, t] = overview(); camera.position.copy(p); controls.target.copy(t); } // vue d'ensemble ; deux doigts pour glisser vers une serre
  else camera.fov = 40; // l'angle du bandeau fixe son propre fov (ANGLES)
  camera.updateProjectionMatrix(); controls.update(); resize();
}
export const api = {
  mount, setMode, resize, webglOk, modelFromState,
  update(S, today) { applyModel(modelFromState(S, today)); },
  setModel: applyModel,
  setTime(k) { amb.fixed = k; poke(); },
  focus,
  // Ernest : état du moment (attend, arrose, assis, dort, salue, lanterne) et promenade
  setErnest(st) { if (st && st !== ernestState) { ernestState = st; poke(); } },
  walk(on, view) { setWalk(on, view); }, walkTo, get walking() { return walk.on; }, get walkView() { return walk.view; },
  walkInput(x, z) { walk.ix = x; walk.iz = z; },
  // monde interactif : toucher (plantes, bonsaïs, panneaux, chaumière, Ernest, graines), arroser, graines dorées
  onPick(fn) { pickFn = fn; }, onNear(fn) { nearFn = fn; near = undefined; }, onFind(fn) { findFn = fn; },
  waterPlant, setFinds, findSpots: () => FIND_SPOTS.length, ernestScreen, get place() { return walk.place; },
  onPlace(fn) { walk.onPlace = fn; walk.place = undefined; },
  ernest,
  onFps(fn) { onFps = fn; frames = 0; fpsT = 0; },
  water() { const last = [...live.values()].pop(); if (last) pop = { obj: last.obj, t: clock.elapsedTime }; poke(); },
  // Effets ponctuels ; en bandeau, chacun ouvre une fenêtre d'animation d'environ 2,5 s puis l'image fixe est refaite.
  setLantern(on) { setLantern(!!on); },
  plantSeeds(n) { plantSeeds(n); },
  dropLeaf() { dropLeaf(); },
  restoreLeaf() { restoreLeaf(); },
  stop() { running = false; }, start() { if (!running && renderer) { running = true; clock.getDelta(); requestAnimationFrame(frame); } },
  // démonstration : fixe l'angle du bandeau (0 à 5, null pour revenir à la rotation par demi-heure)
  setAngle(i) { forcedAngle = i === null || i === undefined ? null : ((Number(i) % ANGLES.length) + ANGLES.length) % ANGLES.length; poke(); },
  houses: HOUSE_IDS,
  // essai : le chemin calculé vers un lieu, et sa plus petite distance aux murs et panneaux (hors départ et arrivée)
  routeCheck(id, fx, fz) { const from = V(fx ?? ERNEST.x, 0, fz ?? ERNEST.z), to = HB[id] ? toWorld(HB[id], 0, 0, -0.6) : COT_DOOR.clone(), pts = [from, ...route(from, to)]; let min = 9;
    for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1], L = a.distanceTo(b), n = Math.ceil(L / 0.1); for (let i = 1; i < n; i++) { const d = (i / n) * L; if ((k === 0 && d < 0.5) || (k === pts.length - 2 && L - d < 0.5)) continue; const x = a.x + ((b.x - a.x) * i) / n, z = a.z + ((b.z - a.z) * i) / n; for (const [p, q] of WALLS) { closestOnSeg(x, z, p, q, _c); min = Math.min(min, Math.hypot(x - _c[0], z - _c[1])); } } }
    return { n: pts.length, min: Math.round(min * 100) / 100 }; },
  get camera() { return camera; }, get controls() { return controls; }, get scene() { return scene; }, get renderer() { return renderer; },
};
export default api;
