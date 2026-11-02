// Ernest en 3D : le gobelin jardinier, modelé par code (three.js 0.160), fidèle au dessin SVG (js/ernest.js) :
// grosse tête ronde vert tendre, longues oreilles horizontales, chapeau pointu de feutre roux à large bord,
// tunique vert sapin. En plus : col de feuilles, ceinture à boucle de laiton et bourse à graines, bas rayés,
// bottines à bout recourbé, brin de thym au ruban du chapeau, pièce cousue, un croc. Squelette simple (bassin,
// jambes, buste, tête, bras en deux segments, doigts), poses mélangées en douceur et mouvement secondaire
// (pointe du chapeau et oreilles sur ressorts, clignements, respiration). Un seul export : createErnest().
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const col = (h) => new THREE.Color(h);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const rngOf = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------- Géométrie : balayage d'une section elliptique le long d'une courbe (oreilles, chapeau, nez, bottines) ----------
// center(u) : point de l'axe, radii(u) : [rayon selon N, rayon selon B], ref : vecteur jamais parallèle à l'axe.
function sweep({ n = 32, m = 20, center, radii, ref = V(1, 0, 0), capStart = true, capEnd = true, post }) {
  const pos = [], uv = [], idx = [], e = 1e-3, T = V(0, 0, 0), B = V(0, 0, 0), N = V(0, 0, 0);
  for (let i = 0; i <= n; i++) {
    const u = i / n, c = center(u);
    T.copy(center(Math.min(1, u + e))).sub(center(Math.max(0, u - e))).normalize();
    B.crossVectors(T, ref).normalize(); N.crossVectors(B, T).normalize();
    const [a, b] = radii(u);
    for (let j = 0; j < m; j++) {
      const th = (j / m) * Math.PI * 2, p = c.clone().addScaledVector(N, Math.cos(th) * a).addScaledVector(B, Math.sin(th) * b);
      if (post) post(p, u, th); pos.push(p.x, p.y, p.z); uv.push(j / m, u);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) { const a = i * m + j, b = i * m + ((j + 1) % m), c = a + m, d = b + m; idx.push(a, c, b, b, c, d); }
  const cap = (u, ring, flip) => { const c = center(u), k = pos.length / 3; pos.push(c.x, c.y, c.z); uv.push(0.5, u); for (let j = 0; j < m; j++) { const a = ring * m + j, b = ring * m + ((j + 1) % m); if (flip) idx.push(k, b, a); else idx.push(k, a, b); } };
  if (capStart) cap(0, 0, false);
  if (capEnd) cap(1, n, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.computeVertexNormals();
  // faces tournées vers l'extérieur quel que soit le sens du repère : sinon on inverse l'ordre des triangles
  const mid = Math.floor(n / 2) * m, nr = g.attributes.normal, c0 = center(Math.floor(n / 2) / n);
  if ((pos[mid * 3] - c0.x) * nr.getX(mid) + (pos[mid * 3 + 1] - c0.y) * nr.getY(mid) + (pos[mid * 3 + 2] - c0.z) * nr.getZ(mid) < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx); g.computeVertexNormals();
  }
  return g;
}
const lathe = (pts, seg = 48) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
// Feuille : un losange arrondi bombé et plié sur sa nervure.
function leafGeo(w, l, fold = 0.3, bend = 0.25) {
  const g = new THREE.PlaneGeometry(w, l, 6, 8), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + l / 2, t = clamp(y / l, 0, 1), half = Math.sin(Math.PI * Math.pow(t, 0.8)) * 0.5;
    const nx = x / (w / 2) * half; p.setXYZ(i, nx * w, y, Math.abs(nx) * w * fold - t * t * l * bend);
  }
  g.computeVertexNormals(); return g;
}

// ---------- Textures procédurales : feutre, tricot, rayures, cuir ----------
function canvasTex(w, h, draw, rx = 1, ry = 1, srgb = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeTextures() {
  const r = rngOf(42);
  const felt = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#808080'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { const v = 90 + r() * 90; x.strokeStyle = `rgba(${v},${v},${v},.35)`; x.lineWidth = 0.6 + r(); x.beginPath(); const px = r() * w, py = r() * h, a = r() * 6.28, L = 2 + r() * 7; x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a + 1) * L * 0.5, py + Math.sin(a + 1) * L * 0.5, px + Math.cos(a) * L, py + Math.sin(a) * L); x.stroke(); }
  }, 3, 3);
  const knit = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#404040'; x.fillRect(0, 0, w, h);
    const cw = 16, ch = 16;
    for (let j = 0; j < h / ch + 1; j++) for (let i = 0; i < w / cw; i++) {
      for (const s of [-1, 1]) { const g = x.createLinearGradient(0, j * ch, 0, j * ch + ch); g.addColorStop(0, '#c8c8c8'); g.addColorStop(1, '#707070'); x.fillStyle = g; x.beginPath(); x.ellipse(i * cw + cw / 2 + s * cw * 0.2, j * ch + ch * 0.55, cw * 0.2, ch * 0.62, -s * 0.5, 0, 6.29); x.fill(); }
    }
  }, 10, 6);
  const stripes = canvasTex(64, 64, (x, w, h) => {
    for (let j = 0; j < 4; j++) { x.fillStyle = j % 2 ? '#7a3b1c' : '#d9a441'; x.fillRect(0, (j * h) / 4, w, h / 4); }
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; x.fillRect(r() * w, r() * h, 1, 2); }
  }, 1, 3, true);
  const leather = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#909090'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 100 + r() * 70; x.fillStyle = `rgba(${v},${v},${v},.5)`; x.beginPath(); x.arc(r() * w, r() * h, 0.5 + r() * 2.2, 0, 6.29); x.fill(); }
    for (let i = 0; i < 40; i++) { x.strokeStyle = 'rgba(60,60,60,.4)'; x.lineWidth = 0.7; x.beginPath(); const px = r() * w, py = r() * h; x.moveTo(px, py); x.lineTo(px + (r() - 0.5) * 30, py + (r() - 0.5) * 10); x.stroke(); }
  }, 2, 2);
  return { felt, knit, stripes, leather };
}

// ---------- Matières ----------
function makeMaterials(TX) {
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.55, sheen: 0.25, sheenColor: col('#e8ffc0'), sheenRoughness: 0.6, clearcoat: 0.08, clearcoatRoughness: 0.6 });
  // Peau : un faux « subsurface » (lumière qui enroule le terminateur, teinte chaude dans la pénombre).
  skin.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      { float wrapK = 0.0; vec3 Lsum = vec3(0.0);
        #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) { float d = dot(normal, directionalLights[i].direction); float w = clamp((d + 0.45) / 1.45, 0.0, 1.0) - clamp(d, 0.0, 1.0); Lsum += directionalLights[i].color * max(w, 0.0); }
        #endif
        reflectedLight.directDiffuse += Lsum * diffuseColor.rgb * vec3(0.55, 0.32, 0.18) * 0.55; }`);
  };
  return {
    skin,
    skinDark: new THREE.MeshPhysicalMaterial({ color: 0x3f8a5c, roughness: 0.5, sheen: 0.4, sheenColor: col('#b8f0a0') }),
    earIn: new THREE.MeshPhysicalMaterial({ color: 0xc98a78, roughness: 0.6, sheen: 0.5, sheenColor: col('#ffd0c0') }),
    eye: new THREE.MeshPhysicalMaterial({ color: 0x0b1511, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.4 }),
    catch: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x1a0f0c, roughness: 0.7 }),
    tooth: new THREE.MeshPhysicalMaterial({ color: 0xfff6e0, roughness: 0.25, clearcoat: 0.6 }),
    brow: new THREE.MeshStandardMaterial({ color: 0x2c4a2a, roughness: 0.9 }),
    hat: new THREE.MeshPhysicalMaterial({ color: 0xc7772a, roughness: 0.92, bumpMap: TX.felt, bumpScale: 1.2, sheen: 1, sheenColor: col('#ffcf9a'), sheenRoughness: 0.55 }),
    brim: new THREE.MeshPhysicalMaterial({ color: 0xa85f1f, roughness: 0.92, bumpMap: TX.felt, bumpScale: 1.2, sheen: 1, sheenColor: col('#ffbf80'), sheenRoughness: 0.55, side: THREE.DoubleSide }),
    patch: new THREE.MeshPhysicalMaterial({ color: 0x7d4a22, roughness: 0.95, bumpMap: TX.felt, bumpScale: 1.5, sheen: 0.8, sheenColor: col('#e0a070') }),
    band: new THREE.MeshPhysicalMaterial({ color: 0x5a3216, roughness: 0.7, sheen: 0.5, sheenColor: col('#c08050') }),
    thread: new THREE.MeshStandardMaterial({ color: 0xe9d9a8, roughness: 0.8 }),
    tunic: new THREE.MeshPhysicalMaterial({ color: 0x357a52, roughness: 0.9, bumpMap: TX.knit, bumpScale: 0.9, sheen: 0.9, sheenColor: col('#8fd0a0'), sheenRoughness: 0.6, side: THREE.DoubleSide }),
    collar: new THREE.MeshPhysicalMaterial({ color: 0x4a9a62, roughness: 0.7, sheen: 0.6, sheenColor: col('#c0ffb0'), side: THREE.DoubleSide }),
    leather: new THREE.MeshPhysicalMaterial({ color: 0x5e3a1c, roughness: 0.62, bumpMap: TX.leather, bumpScale: 0.9, clearcoat: 0.35, clearcoatRoughness: 0.5 }),
    leatherLight: new THREE.MeshPhysicalMaterial({ color: 0x8a5a2b, roughness: 0.7, bumpMap: TX.leather, bumpScale: 0.9, clearcoat: 0.2 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xd4a548, roughness: 0.28, metalness: 1 }),
    stock: new THREE.MeshPhysicalMaterial({ map: TX.stripes, roughness: 0.95, bumpMap: TX.knit, bumpScale: 1.4, sheen: 0.7, sheenColor: col('#ffe0a0') }),
    sprig: new THREE.MeshStandardMaterial({ color: 0x5f8f4a, roughness: 0.7, side: THREE.DoubleSide }),
    flower: new THREE.MeshStandardMaterial({ color: 0xb79ad8, roughness: 0.6 }),
    zinc: new THREE.MeshStandardMaterial({ color: 0xa9b3b4, roughness: 0.32, metalness: 0.9 }),
    zincDark: new THREE.MeshStandardMaterial({ color: 0x6f7a7c, roughness: 0.4, metalness: 0.9 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2c2b28, roughness: 0.55, metalness: 0.8 }),
    flame: new THREE.MeshStandardMaterial({ color: 0xffd38a, emissive: 0xffa040, emissiveIntensity: 4 }),
    lgGlass: new THREE.MeshPhysicalMaterial({ color: 0xffe2a8, roughness: 0.15, transmission: 0, transparent: true, opacity: 0.55, emissive: 0xff9a3a, emissiveIntensity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  };
}

// ---------- Construction ----------
export function createErnest({ scale = 0.33, castShadow = true } = {}) {
  const TX = makeTextures(), M = makeMaterials(TX);
  const root = new THREE.Group(); root.name = 'ernest';
  const model = new THREE.Group(); model.scale.setScalar(scale); root.add(model);
  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = castShadow; m.receiveShadow = true; parent.add(m); return m; };
  const pivot = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  const body = pivot(model); // bassin : monte, descend, s'assoit
  const HIP = 0.44;

  // --- Jambes : bas rayés, bottines de cuir à bout recourbé, revers ---
  const bootGeo = sweep({
    n: 36, m: 22, ref: V(1, 0, 0),
    center: (u) => { const z = -0.1 + u * 0.36, curl = smooth(0.55, 1, u); return V(0, 0.085 - u * 0.02 + curl * curl * 0.15, z - curl * curl * 0.06); },
    radii: (u) => { const t = 1 - smooth(0.45, 1, u) * 0.86; return [0.105 * t + 0.008, 0.095 * t * (1 - u * 0.25) + 0.008]; },
    post: (p) => { if (p.y < 0.012) p.y = 0.012 + (p.y - 0.012) * 0.08; },
  });
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = pivot(body, s * 0.13, HIP, 0);
    add(leg, new THREE.CylinderGeometry(0.068, 0.058, 0.3, 20, 1, true), M.stock, 0, -0.17, 0);
    const boot = pivot(leg, 0, -HIP, 0.0);
    add(boot, bootGeo, M.leather);
    const cuff = add(boot, lathe([[0.075, 0.13], [0.1, 0.15], [0.112, 0.2], [0.104, 0.235], [0.07, 0.24]], 28), M.leatherLight); cuff.rotation.y = s * 0.3;
    add(boot, new THREE.TorusGeometry(0.105, 0.012, 8, 28), M.leather, 0, 0.2, 0).rotation.x = Math.PI / 2;
    legs.push(leg);
  }

  // --- Buste : tunique tricotée évasée, ourlet festonné en pointes de feuilles ---
  const torso = pivot(body, 0, HIP, 0);
  const tunicGeo = lathe([[0.2, 0.5], [0.27, 0.46], [0.3, 0.38], [0.31, 0.25], [0.325, 0.12], [0.35, 0.0], [0.385, -0.1], [0.4, -0.15], [0.39, -0.16]], 64);
  { const p = tunicGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); if (y < -0.08) { const a = Math.atan2(z, x), k = Math.pow(Math.abs(Math.cos(a * 4.5)), 3); p.setY(i, y - k * 0.07); } } tunicGeo.computeVertexNormals(); }
  add(torso, tunicGeo, M.tunic);
  add(torso, new THREE.CircleGeometry(0.2, 32), M.tunic, 0, 0.5, 0).rotation.x = -Math.PI / 2;
  // ceinture, boucle de laiton, bourse à graines
  const belt = add(torso, lathe([[0.326, 0.07], [0.338, 0.08], [0.34, 0.14], [0.33, 0.15]], 48), M.leather);
  const buckle = add(torso, new THREE.TorusGeometry(0.05, 0.012, 6, 4), M.brass, 0, 0.11, 0.345); buckle.rotation.z = Math.PI / 4; buckle.scale.set(1, 0.85, 1);
  add(torso, new THREE.BoxGeometry(0.008, 0.06, 0.01), M.brass, 0, 0.11, 0.35);
  const pouch = pivot(torso, -0.27, 0.06, 0.17); pouch.rotation.y = -0.6;
  add(pouch, new THREE.SphereGeometry(0.075, 20, 16), M.leatherLight).scale.set(1, 1.1, 0.7);
  add(pouch, new THREE.TorusGeometry(0.04, 0.008, 6, 16), M.leather, 0, 0.06, 0).rotation.x = Math.PI / 2;
  add(pouch, new THREE.SphereGeometry(0.04, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.leatherLight, 0, 0.065, 0).scale.set(1, 0.6, 0.8);
  add(pouch, new THREE.CapsuleGeometry(0.006, 0.05, 2, 6), M.thread, 0.015, 0.035, 0.04).rotation.z = 0.3;
  // col de feuilles
  const leafCollar = leafGeo(0.17, 0.2, 0.25, 0.3);
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + 0.2, lf = add(torso, leafCollar, M.collar); lf.position.set(Math.sin(a) * 0.16, 0.5, Math.cos(a) * 0.16); lf.rotation.set(0, a, 0, 'YXZ'); lf.rotateX(1.9); }
  // pièce cousue sur la tunique
  const tPatch = add(torso, new THREE.CylinderGeometry(0.06, 0.06, 0.01, 6), M.patch); tPatch.position.set(0.22, -0.02, 0.26); tPatch.rotation.set(Math.PI / 2 - 0.1, 0, 0.5); tPatch.lookAt(V(0.9, -0.02, 1).multiplyScalar(1).add(V(0, 0, 0)));
  tPatch.rotateX(Math.PI / 2);

  // --- Tête ---
  const neck = pivot(torso, 0, 0.53, 0);
  const head = pivot(neck, 0, 0.0, 0);
  const HC = V(0, 0.4, 0), HR = V(0.56, 0.5, 0.5);
  const headGeo = new THREE.SphereGeometry(1, 64, 48);
  {
    const p = headGeo.attributes.position, colors = [], base = col('#6fb768'), blush = col('#d9907a'), dark = col('#57a05e'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const jowl = 1 + 0.1 * smooth(0.2, -0.6, y) * (1 - smooth(-0.6, -1, y)); // joues pleines, mâchoire large
      x *= jowl; z *= 1 + 0.06 * smooth(0, -0.7, y) * smooth(0, 1, z);
      p.setXYZ(i, x * HR.x, y * HR.y, z * HR.z);
      c.copy(base);
      for (const s of [-1, 1]) { const d = Math.hypot(x - s * 0.55, y + 0.28, z - 0.82); c.lerp(blush, 0.55 * (1 - smooth(0.05, 0.42, d))); }
      c.lerp(dark, 0.35 * smooth(0.1, -0.9, y) + 0.2 * smooth(0, -1, z));
      colors.push(c.r, c.g, c.b);
    }
    headGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); headGeo.computeVertexNormals();
  }
  const headMesh = add(head, headGeo, M.skin, HC.x, HC.y, HC.z);
  const onHead = (x, y, push = 0) => { const yy = y / HR.y, xx = x / HR.x; const z = HR.z * Math.sqrt(Math.max(0, 1 - xx * xx - yy * yy)) * (1 + 0.06 * smooth(0, -0.7, yy)); return V(x, HC.y + y, z + push); };

  // yeux, paupières, reflets
  const eyes = [], lids = [];
  for (const s of [-1, 1]) {
    const p = onHead(s * 0.19, 0.0, -0.03);
    const eye = pivot(head, p.x, p.y, p.z); eye.rotation.y = s * 0.28;
    add(eye, new THREE.SphereGeometry(0.088, 32, 24), M.eye).scale.set(1, 1.08, 0.9);
    const c1 = add(eye, new THREE.SphereGeometry(0.019, 12, 8), M.catch, 0.028, 0.035, 0.074); c1.castShadow = false;
    const c2 = add(eye, new THREE.SphereGeometry(0.009, 8, 6), M.catch, -0.03, -0.03, 0.078); c2.castShadow = false;
    const lid = pivot(eye);
    add(lid, new THREE.SphereGeometry(0.097, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.skin).scale.set(1, 1.08, 0.95);
    add(lid, new THREE.TorusGeometry(0.096, 0.009, 6, 32, Math.PI), M.skinDark).rotation.set(0, 0, 0);
    eye.userData.catch = [c1, c2]; eyes.push(eye); lids.push(lid);
  }
  // sourcils broussailleux
  const brows = [];
  for (const s of [-1, 1]) {
    const p = onHead(s * 0.2, 0.14, 0.0); const b = pivot(head, p.x, p.y, p.z); b.rotation.y = s * 0.3;
    const r = rngOf(s > 0 ? 7 : 8);
    for (let i = 0; i < 5; i++) { const t = add(b, new THREE.CapsuleGeometry(0.014, 0.05, 3, 6), M.brow, s * (i - 2) * 0.022, (2 - Math.abs(i - 2)) * 0.006, 0); t.rotation.z = Math.PI / 2 + s * (0.25 - i * 0.12) + (r() - 0.5) * 0.3; t.rotation.y = (r() - 0.5) * 0.4; }
    brows.push(b);
  }
  // nez en goutte un peu crochu
  const noseGeo = sweep({ n: 20, m: 16, ref: V(1, 0, 0), center: (u) => V(0, 0.03 - u * 0.1 - u * u * 0.025, u * 0.11), radii: (u) => { const r = 0.03 + 0.036 * Math.sin(Math.PI * Math.pow(u, 0.7)) ; return [r * 0.95, r]; } });
  const nosePos = onHead(0, -0.02, -0.04); add(head, noseGeo, M.skinDark, nosePos.x, nosePos.y, nosePos.z);
  // bouche : un sourire tracé sur la peau, une lèvre pleine, un croc
  const mouth = pivot(head);
  const mouthCurve = (w, k) => new THREE.CatmullRomCurve3([-1, -0.5, 0, 0.5, 1].map((t) => onHead(t * w, -0.215 - (1 - t * t) * k, 0.006)));
  let mouthMesh = add(mouth, new THREE.TubeGeometry(mouthCurve(0.11, 0.035), 24, 0.013, 8, false), M.mouth);
  const fang = add(mouth, new THREE.ConeGeometry(0.016, 0.045, 10), M.tooth); { const p = onHead(0.055, -0.255, 0.004); fang.position.copy(p); fang.rotation.set(Math.PI + 0.2, 0, 0.15); }
  const setSmile = (k) => { mouth.remove(mouthMesh); mouthMesh.geometry.dispose(); mouthMesh = add(mouth, new THREE.TubeGeometry(mouthCurve(0.1 + k * 0.03, 0.025 + k * 0.035), 24, 0.013, 8, false), M.mouth); };

  // oreilles : longues, horizontales, en feuille, légèrement tombantes, intérieur rosé
  const ears = [];
  const earGeo = sweep({ n: 34, m: 22, ref: V(0, 1, 0), center: (u) => V(u * 0.72, -u * u * 0.1 + Math.sin(u * Math.PI) * 0.035, -u * u * 0.1), radii: (u) => { const r = Math.pow(Math.sin(Math.PI * (0.3 + 0.7 * u)), 0.9) * Math.pow(1 - u, 0.25); return [0.16 * r + 0.006, 0.045 * r + 0.01]; } });
  // section : N = axe vertical inversé ; on veut l'oreille large en hauteur, fine en épaisseur : on aplatit en z après coup
  earGeo.scale(1, 1, 1);
  const earInGeo = sweep({ n: 28, m: 16, ref: V(0, 1, 0), center: (u) => { const x = 0.04 + u * 0.56, w = x / 0.72; return V(x, -w * w * 0.1 + Math.sin(w * Math.PI) * 0.035, -w * w * 0.1 + 0.032); }, radii: (u) => { const r = Math.pow(Math.sin(Math.PI * (0.3 + 0.7 * u)), 0.9) * Math.pow(1 - u, 0.3); return [0.105 * r + 0.003, 0.016 * r + 0.004]; } });
  for (const s of [-1, 1]) {
    const e = pivot(head, s * 0.47, HC.y + 0.03, -0.03); e.scale.x = s;
    const tilt = pivot(e); tilt.rotation.set(0, 0.25, 0.08);
    const flop = pivot(tilt);
    const outer = add(flop, earGeo, M.skin);
    const inner = add(flop, earInGeo, M.earIn);
    if (s < 0) for (const m of [outer, inner]) m.material = m.material; // même matière, le miroir suffit
    ears.push({ e, tilt, flop });
  }
  // la miroir (scale.x = -1) inverse les faces : double face pour la peau des oreilles
  // (on garde la matière partagée ; l'inversion est compensée par THREE automatiquement via determinant)

  // --- Chapeau pointu : bord large ondulé, cône de feutre, pointe molle sur ressort, ruban, brin de thym, pièce cousue ---
  const hatP = pivot(head, 0, HC.y + 0.25, -0.035); hatP.rotation.set(-0.1, 0, 0.06);
  const brimGeo = lathe([[0.42, 0.01], [0.56, 0.0], [0.7, -0.035], [0.8, -0.075], [0.815, -0.085], [0.805, -0.097], [0.7, -0.058], [0.56, -0.028], [0.42, -0.02]], 96);
  { const p = brimGeo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x); const k = smooth(0.45, 0.77, r); p.setY(i, p.getY(i) + k * (0.04 * Math.sin(a * 3 + 0.7) + 0.025 * Math.sin(a * 5 + 2.1)) + k * 0.05 * Math.cos(a - 1.57)); } brimGeo.computeVertexNormals(); }
  add(hatP, brimGeo, M.brim);
  const HAT_H = 0.98, SPLIT = 0.45;
  const hatR = (u) => 0.53 * Math.pow(1 - u, 1.05) * (1 + 0.06 * Math.sin(u * 9)) + 0.006;
  const hatC = (u) => V(Math.sin(u * 4) * 0.012, u * HAT_H, -Math.pow(u, 2.2) * 0.12);
  add(hatP, sweep({ n: 30, m: 40, ref: V(1, 0, 0), center: (u) => hatC(u * SPLIT), radii: (u) => { const r = hatR(u * SPLIT); return [r, r * 1.02]; }, capStart: true, capEnd: false }), M.hat);
  const tipBase = hatC(SPLIT), tipP = pivot(hatP, tipBase.x, tipBase.y - 0.01, tipBase.z);
  const tipBend = pivot(tipP); tipBend.rotation.x = -0.3; tipBend.rotation.z = 0.12;
  add(tipBend, sweep({ n: 44, m: 40, ref: V(1, 0, 0), center: (u) => { const w = SPLIT - 0.06 + u * (1 - SPLIT + 0.06), c = hatC(w).sub(tipBase); c.y += 0.01; c.z -= u * u * 0.3; c.y -= u * u * u * 0.14; return c; }, radii: (u) => { const r = hatR(SPLIT - 0.06 + u * (1 - SPLIT + 0.06)) * (1 + 0.035 * (1 - smooth(0, 0.25, u))); return [r, r * 1.02]; }, capStart: true }), M.hat);
  // petit pompon de laine au bout
  // (non : une pointe nue est plus fidèle au dessin ; on garde la pointe)
  add(hatP, lathe([[0.515, 0.0], [0.535, 0.01], [0.52, 0.085], [0.5, 0.095], [0.48, 0.07]], 64), M.band, 0, 0.0, 0);
  // brin de thym glissé dans le ruban, avec deux fleurettes
  const sprig = pivot(hatP, 0.42, 0.05, 0.25); sprig.rotation.set(0.2, 0.9, -0.5);
  { const r = rngOf(3); add(sprig, new THREE.CylinderGeometry(0.006, 0.008, 0.32, 6), M.band, 0, 0.14, 0);
    const lg = leafGeo(0.028, 0.06, 0.4, 0.1);
    for (let i = 0; i < 14; i++) { const y = 0.03 + i * 0.019, lf = add(sprig, lg, M.sprig, 0, y, 0); lf.rotation.set(0, i * 2.4, 0.9 + r() * 0.3, 'YXZ'); lf.castShadow = false; }
    for (let i = 0; i < 4; i++) { const f = add(sprig, new THREE.IcosahedronGeometry(0.014, 1), M.flower, (r() - 0.5) * 0.03, 0.27 + i * 0.015, (r() - 0.5) * 0.03); f.castShadow = false; } }
  // pièce cousue sur le cône, points de couture
  { const pp = pivot(hatP, 0, 0.2, 0); pp.rotation.y = -0.9; const rb = hatR(0.14 / HAT_H) + 0.01, rt = hatR(0.26 / HAT_H) + 0.01;
    const pg = new THREE.CylinderGeometry(rt, rb, 0.12, 24, 1, true, -0.38, 0.76); add(pp, pg, M.patch).material.side = THREE.DoubleSide;
    for (let i = 0; i < 9; i++) { const t = -0.36 + (i / 8) * 0.72; for (const yy of [-0.05, 0.05]) { const rr = (yy < 0 ? rb : rt) + 0.006; const st = add(pp, new THREE.CapsuleGeometry(0.004, 0.014, 2, 4), M.thread, Math.sin(t) * rr, yy, Math.cos(t) * rr); st.rotation.set(0.3, t, Math.PI / 2); st.castShadow = false; } } }

  // --- Bras : manche courte tricotée à revers, avant-bras nu, main à trois doigts et pouce ---
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = pivot(torso, s * 0.27, 0.4, 0);
    add(sh, lathe([[0.0, 0.04], [0.07, 0.035], [0.09, -0.02], [0.105, -0.12], [0.112, -0.17], [0.0, -0.17]], 24), M.tunic);
    add(sh, new THREE.TorusGeometry(0.105, 0.022, 8, 24), M.collar, 0, -0.17, 0).rotation.x = Math.PI / 2;
    add(sh, new THREE.CapsuleGeometry(0.064, 0.1, 4, 14), M.skin, 0, -0.17, 0).geometry.computeVertexNormals();
    const el = pivot(sh, 0, -0.25, 0);
    add(el, new THREE.CapsuleGeometry(0.058, 0.15, 4, 14), M.skin, 0, -0.09, 0);
    const wr = pivot(el, 0, -0.21, 0);
    const hand = pivot(wr);
    add(hand, new THREE.SphereGeometry(0.075, 20, 16), M.skin, 0, -0.045, 0).scale.set(0.75, 1, 1);
    const fingers = [];
    for (let i = 0; i < 3; i++) { const f = pivot(hand, 0, -0.085, (i - 1) * 0.036); f.rotation.x = (i - 1) * 0.12; add(f, new THREE.CapsuleGeometry(0.022, 0.055, 3, 8), M.skin, 0, -0.038, 0); fingers.push(f); }
    const th = pivot(hand, s * 0.03, -0.04, 0.05); th.rotation.set(0.6, 0, s * 0.4); add(th, new THREE.CapsuleGeometry(0.019, 0.035, 3, 8), M.skin, 0, -0.03, 0);
    const grip = pivot(hand, 0, -0.1, 0);
    arms.push({ sh, el, wr, hand, fingers, th, grip, s });
  }
  // Pour toutes les vertex colors manquantes (bras, paupières) : la peau attend un attribut color.
  model.traverse((o) => { if (o.isMesh && o.material === M.skin && !o.geometry.attributes.color) { const n = o.geometry.attributes.position.count, c = new Float32Array(n * 3), b = col('#6cbb74'); for (let i = 0; i < n; i++) { c[i * 3] = b.r; c[i * 3 + 1] = b.g; c[i * 3 + 2] = b.b; } o.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3)); } });

  // --- Accessoires : lanterne de laiton, arrosoir de zinc ---
  const lantern = new THREE.Group();
  {
    const g = pivot(lantern, 0, 0, 0);
    add(g, new THREE.TorusGeometry(0.06, 0.008, 8, 24, Math.PI), M.iron, 0, -0.06, 0);
    add(g, new THREE.ConeGeometry(0.11, 0.08, 6), M.brass, 0, -0.12, 0);
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 6), M.brass, 0, -0.07, 0);
    add(g, new THREE.CylinderGeometry(0.085, 0.085, 0.17, 6, 1, true), M.lgGlass, 0, -0.245, 0).castShadow = false;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(g, new THREE.BoxGeometry(0.012, 0.18, 0.012), M.brass, Math.cos(a) * 0.088, -0.245, Math.sin(a) * 0.088).rotation.y = -a; }
    add(g, new THREE.CylinderGeometry(0.1, 0.105, 0.03, 6), M.brass, 0, -0.34, 0);
    add(g, new THREE.CylinderGeometry(0.014, 0.014, 0.05, 8), M.thread, 0, -0.3, 0);
    const fl = add(g, new THREE.SphereGeometry(0.022, 12, 10), M.flame, 0, -0.255, 0); fl.scale.set(1, 1.8, 1); fl.castShadow = false;
    const light = new THREE.PointLight(0xffa850, 0, 3.2, 1.6); light.position.set(0, -0.25, 0); light.castShadow = true; light.shadow.mapSize.set(512, 512); light.shadow.bias = -0.002; light.shadow.radius = 4; g.add(light);
    lantern.userData = { light, flame: fl, swing: g };
  }
  const can = new THREE.Group();
  {
    const g = pivot(can);
    const bodyG = add(g, new THREE.CylinderGeometry(0.13, 0.15, 0.26, 32), M.zinc, 0, -0.2, 0.0);
    for (const y of [-0.1, -0.3]) add(g, new THREE.TorusGeometry(0.142 + (y < -0.2 ? 0.006 : -0.004), 0.008, 6, 32), M.zincDark, 0, y, 0).rotation.x = Math.PI / 2;
    add(g, new THREE.TorusGeometry(0.11, 0.014, 8, 24, Math.PI), M.zincDark, 0, -0.06, -0.02).rotation.y = Math.PI / 2;
    const spout = sweep({ n: 16, m: 12, ref: V(1, 0, 0), center: (u) => V(0, -0.27 + u * 0.24, 0.12 + u * 0.3), radii: (u) => [0.03 - u * 0.012, 0.03 - u * 0.012] });
    add(g, spout, M.zinc);
    const rose = add(g, new THREE.CylinderGeometry(0.045, 0.02, 0.05, 20), M.zincDark, 0, -0.02, 0.43); rose.rotation.x = 1.0;
    add(g, new THREE.CircleGeometry(0.043, 20), M.iron, 0, -0.005, 0.455).rotation.x = -0.57;
    void bodyG; can.userData = { tip: V(0, 0.0, 0.47) };
  }
  lantern.scale.setScalar(1.15); can.scale.setScalar(1.35);

  // ---------- Animation : poses, marche, mouvement secondaire ----------
  const POSES = {
    attend: { sh: [[0.05, 0, -0.22], [0.05, 0, 0.22]], el: [-0.25, -0.25], torso: [0.02, 0, 0], head: [0, 0, 0], lid: 0.12, brow: 0, smile: 0.4, sit: 0, curl: 0.3, prop: null },
    salue: { sh: [[0.05, 0, -0.2], [0.9, 0, 2.2]], el: [-0.2, 1.15], torso: [-0.04, 0, 0.05], head: [-0.1, 0, -0.12], lid: 0, brow: 1, smile: 1, sit: 0, curl: 0, prop: null },
    arrose: { sh: [[-0.2, 0, -0.35], [-1.15, 0.2, 0.3]], el: [-0.9, -0.15], torso: [0.1, 0.1, 0], head: [0.25, 0.2, 0], lid: 0.0, brow: 0.6, smile: 0.7, sit: 0, curl: 1, prop: 'can' },
    lanterne: { sh: [[0.05, 0, -0.22], [-0.85, 0, 0.18]], el: [-0.25, -0.7], torso: [0, 0.05, 0], head: [0.05, 0.25, 0.05], lid: 0.15, brow: 0.2, smile: 0.5, sit: 0, curl: 1, prop: 'lantern' },
    guide: { sh: [[0.05, 0, -0.22], [-1.25, 0, 0.12]], el: [-0.25, -0.35], torso: [0, 0, 0], head: [0, 0, 0], lid: 0.1, brow: 0.2, smile: 0.5, sit: 0, curl: 1, prop: 'lantern' },
    dort: { sh: [[-0.25, 0, -0.12], [-0.25, 0, 0.12]], el: [-1.25, -1.25], torso: [-0.18, 0, 0], head: [0.42, 0, 0.18], lid: 1, brow: -0.3, smile: 0, sit: 1, curl: 0.6, prop: null },
  };
  const S = { sh: [[0, 0, 0], [0, 0, 0]], el: [0, 0], torso: [0, 0, 0], head: [0, 0, 0], lid: 0, brow: 0, smile: 0.4, sit: 0, curl: 0 };
  let pose = 'attend', propOn = null, walk = 0, walkTarget = 0, phase = 0, t = 0, smileShown = -1, nextBlink = 1.5, blinkT = -1, lookT = 0, lookY = 0, lookX = 0;
  const lerpTo = (a, b, k) => a + (b - a) * k;
  const springs = { hat: { x: 0, z: 0, vx: 0, vz: 0 }, ears: [{ y: 0, v: 0 }, { y: 0, v: 0 }] };
  const prevHead = new THREE.Vector3(), headW = new THREE.Vector3(), headV = new THREE.Vector3(), prevV = new THREE.Vector3(), acc = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), invQ = new THREE.Quaternion();
  const water = (() => {
    const n = 90, geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3).fill(-99), vel = new Float32Array(n * 3), life = new Float32Array(n);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(220,245,255,1)'); gr.addColorStop(0.5, 'rgba(150,210,240,.6)'); gr.addColorStop(1, 'rgba(150,210,240,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.03, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); pts.frustumCulled = false;
    return { pts, pos, vel, life, n, i: 0, acc: 0 };
  })();
  const zzz = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.font = 'italic 52px Georgia, serif'; x.fillStyle = '#efe6d2'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('z', 32, 34);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const list = [0, 1, 2].map(() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; return sp; });
    return list;
  })();
  let sceneRef = null;

  function setProp(p) {
    if (p === propOn) return;
    const grip = arms[1].grip;
    if (propOn === 'lantern') grip.remove(lantern); if (propOn === 'can') grip.remove(can);
    if (p === 'lantern') grip.add(lantern); if (p === 'can') grip.add(can);
    propOn = p;
  }
  function setPose(name) { if (POSES[name]) pose = name; }
  function setWalk(speed) { walkTarget = clamp(speed, 0, 1.6); }
  function attach(scene) { sceneRef = scene; scene.add(water.pts); for (const z of zzz) scene.add(z); }

  function update(dt, opts = {}) {
    dt = Math.min(dt, 0.05); t += dt;
    const P = POSES[pose], k = 1 - Math.exp(-dt * 7);
    walk = lerpTo(walk, walkTarget, 1 - Math.exp(-dt * 5));
    const w = walk > 0.02 ? Math.min(1, walk) : 0;
    // la marche impose ses bras, sauf le bras qui tient un objet
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) S.sh[i][j] = lerpTo(S.sh[i][j], P.sh[i][j], k);
    for (let i = 0; i < 2; i++) S.el[i] = lerpTo(S.el[i], P.el[i], k);
    for (let j = 0; j < 3; j++) { S.torso[j] = lerpTo(S.torso[j], P.torso[j], k); S.head[j] = lerpTo(S.head[j], P.head[j], k); }
    S.lid = lerpTo(S.lid, P.lid, k); S.brow = lerpTo(S.brow, P.brow, k); S.smile = lerpTo(S.smile, P.smile, k); S.sit = lerpTo(S.sit, P.sit * (1 - w), 1 - Math.exp(-dt * 3)); S.curl = lerpTo(S.curl, P.curl, k);
    const wantProp = P.prop || (opts.lantern ? 'lantern' : null); setProp(wantProp);

    // marche : pas courts et sautillants de gobelin
    phase += dt * (5.2 + walk * 3.4) * (w > 0 ? 1 : 0);
    const sw = Math.sin(phase), cw = Math.cos(phase), bob = Math.abs(cw);
    const breathe = Math.sin(t * 2.1) * 0.012;
    body.position.y = -S.sit * 0.36 + w * (bob * 0.05 - 0.015);
    body.position.z = 0; body.rotation.z = w * sw * 0.05;
    for (let i = 0; i < 2; i++) { const s = i ? 1 : -1; legs[i].rotation.x = -S.sit * 1.5 + w * s * sw * 0.75; legs[i].rotation.z = s * (S.sit * 0.18); }
    torso.rotation.set(S.torso[0] + w * 0.12 - S.sit * 0.05, S.torso[1] + w * sw * 0.12, S.torso[2] - w * sw * 0.04);
    torso.scale.set(1 + breathe * 0.5, 1 + breathe, 1 + breathe * 0.5);
    // regard qui se promène quand il attend
    lookT -= dt; if (lookT < 0) { lookT = 1.5 + Math.random() * 3; lookY = pose === 'attend' ? (Math.random() - 0.5) * 0.9 : 0; lookX = pose === 'attend' ? (Math.random() - 0.5) * 0.25 : 0; }
    const hy = (head.userData.ly = lerpTo(head.userData.ly || 0, lookY * (1 - w), 1 - Math.exp(-dt * 3)));
    const hx = (head.userData.lx = lerpTo(head.userData.lx || 0, lookX * (1 - w), 1 - Math.exp(-dt * 3)));
    neck.rotation.set(S.head[0] + hx - w * 0.1 + w * bob * 0.04 + (pose === 'dort' ? Math.sin(t * 0.9) * 0.05 : 0), S.head[1] + hy - w * sw * 0.1, S.head[2] + w * sw * 0.03 + Math.sin(t * 0.7) * 0.02);
    // bras
    for (let i = 0; i < 2; i++) {
      const a = arms[i], s = a.s, holds = i === 1 && propOn;
      const swing = holds ? (pose === 'guide' ? 0.05 : 0.15) : 1;
      a.sh.rotation.set(S.sh[i][0] + w * -s * sw * 0.7 * swing, S.sh[i][1], S.sh[i][2] + w * s * 0.08);
      a.el.rotation.set(S.el[i] - w * 0.35 * swing, 0, 0);
      if (pose === 'salue' && i === 1) { a.el.rotation.z = Math.sin(t * 8) * 0.45 * smooth(1.2, 2.1, S.sh[1][2]); a.wr.rotation.z = Math.sin(t * 9 - 0.8) * 0.25; } else { a.wr.rotation.z = 0; }
      a.wr.rotation.x = holds ? 0.0 : -0.1;
      for (const f of a.fingers) f.rotation.z = -s * 0; for (const f of a.fingers) f.rotation.x = 0;
      for (let j = 0; j < a.fingers.length; j++) { const f = a.fingers[j]; f.rotation.set((j - 1) * 0.12, 0, -s * S.curl * 1.2 * (i === 1 && holds ? 1 : 0.4)); }
    }
    // la lanterne et l'arrosoir pendent droit (gravité), avec un petit balancement
    root.updateMatrixWorld(true);
    if (propOn === 'lantern') {
      arms[1].grip.getWorldQuaternion(tmpQ); invQ.copy(tmpQ).invert();
      const yaw = new THREE.Quaternion().setFromEuler(new THREE.Euler(w * sw * 0.18 + Math.sin(t * 1.7) * 0.04, root.rotation.y, Math.sin(t * 1.3) * 0.05 + w * cw * 0.1));
      lantern.quaternion.copy(invQ).multiply(yaw);
      const L = lantern.userData; const fl = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.3) * 0.08 + (Math.random() - 0.5) * 0.05;
      L.light.intensity = (opts.lanternK ?? 1) * 1.6 * fl; L.flame.scale.set(1, 1.8 * fl, 1); M.flame.emissiveIntensity = 4 * fl;
    } else lantern.userData.light.intensity = 0;
    if (propOn === 'can') {
      arms[1].grip.getWorldQuaternion(tmpQ); invQ.copy(tmpQ).invert();
      const pour = pose === 'arrose' ? 0.55 + Math.sin(t * 1.4) * 0.12 : 0;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pour, root.rotation.y + 0.1, 0, 'YXZ'));
      can.quaternion.copy(invQ).multiply(q); can.position.set(0, 0.05, -0.02);
    }
    // eau : gouttes depuis la pomme de l'arrosoir
    if (propOn === 'can' && pose === 'arrose') {
      water.acc += dt * 160; const tip = can.localToWorld(can.userData.tip.clone().add(V(0, 0, 0))), dir = can.localToWorld(V(0, -0.3, 0.9)).sub(can.localToWorld(V(0, 0, 0))).normalize();
      while (water.acc > 1) { water.acc -= 1; const i = water.i++ % water.n; water.pos[i * 3] = tip.x + (Math.random() - 0.5) * 0.02; water.pos[i * 3 + 1] = tip.y; water.pos[i * 3 + 2] = tip.z + (Math.random() - 0.5) * 0.02; const sp = 0.5 + Math.random() * 0.25; water.vel[i * 3] = dir.x * sp + (Math.random() - 0.5) * 0.15; water.vel[i * 3 + 1] = dir.y * sp; water.vel[i * 3 + 2] = dir.z * sp + (Math.random() - 0.5) * 0.15; water.life[i] = 1; }
    }
    for (let i = 0; i < water.n; i++) { if (water.life[i] <= 0) continue; water.vel[i * 3 + 1] -= 9.8 * dt * 0.6; for (let j = 0; j < 3; j++) water.pos[i * 3 + j] += water.vel[i * 3 + j] * dt; water.life[i] -= dt * 1.2; if (water.pos[i * 3 + 1] < (opts.groundY ?? 0) + 0.01 || water.life[i] <= 0) { water.life[i] = 0; water.pos[i * 3 + 1] = -99; } }
    water.pts.geometry.attributes.position.needsUpdate = true;
    // zzz
    zzz.forEach((z, i) => { const on = pose === 'dort' && S.sit > 0.6; const ph = ((t * 0.35 + i / 3) % 1); z.visible = on; if (!on) return; const p = head.localToWorld(V(0.25 + ph * 0.3, 1.0 + ph * 0.6, 0.2)); z.position.copy(p); z.scale.setScalar(0.06 + ph * 0.09); z.material.opacity = Math.sin(ph * Math.PI) * 0.9; });

    // clignements (et paupières de la pose)
    nextBlink -= dt; if (nextBlink < 0) { blinkT = 0; nextBlink = 2 + Math.random() * 4; if (Math.random() < 0.2) nextBlink = 0.25; }
    let blink = 0; if (blinkT >= 0) { blinkT += dt; blink = Math.sin(clamp(blinkT / 0.16, 0, 1) * Math.PI); if (blinkT > 0.16) blinkT = -1; }
    const lidK = Math.max(S.lid, blink);
    for (const l of lids) l.rotation.x = lerpTo(-1.25, 1.62, lidK);
    for (const e of eyes) for (const c of e.userData.catch) c.visible = lidK < 0.55;
    brows.forEach((b, i) => { b.position.y = HC.y + 0.14 + S.brow * 0.025; b.rotation.z = (i ? -1 : 1) * S.brow * 0.12; });
    const sm = Math.round(S.smile * 10) / 10; if (sm !== smileShown) { smileShown = sm; setSmile(sm); }

    // mouvement secondaire : la pointe du chapeau et les oreilles suivent l'accélération de la tête
    head.getWorldPosition(headW);
    if (prevHead.lengthSq() === 0) prevHead.copy(headW);
    headV.copy(headW).sub(prevHead).divideScalar(Math.max(dt, 1e-3)); acc.copy(headV).sub(prevV).divideScalar(Math.max(dt, 1e-3)); prevV.copy(headV); prevHead.copy(headW);
    acc.clampLength(0, 12);
    const local = acc.clone().applyQuaternion(root.getWorldQuaternion(new THREE.Quaternion()).invert());
    const hs = springs.hat; const K = 70, C = 7;
    hs.vx += (-K * hs.x - C * hs.vx + local.z * 0.9) * dt; hs.vz += (-K * hs.z - C * hs.vz - local.x * 0.9) * dt; hs.x += hs.vx * dt; hs.z += hs.vz * dt;
    tipP.rotation.set(clamp(hs.x, -0.5, 0.5) + Math.sin(t * 1.1) * 0.015, 0, clamp(hs.z, -0.5, 0.5));
    springs.ears.forEach((e, i) => { e.v += (-90 * e.y - 6 * e.v - local.y * 1.2) * dt; e.y += e.v * dt; });
    // petit frémissement d'oreille de temps en temps
    const twitch = (i) => { const p = (t * 0.23 + i * 0.37) % 1; return p < 0.04 ? Math.sin(p / 0.04 * Math.PI * 3) * 0.18 : 0; };
    ears.forEach((e, i) => { e.flop.rotation.set(0, 0, clamp(springs.ears[i].y, -0.4, 0.4) - (pose === 'dort' ? 0.25 : 0) + twitch(i) + (pose === 'salue' ? 0.15 : 0)); });
  }

  // Facultatif : en vue à la première personne, cacher la tête (garder le bord du chapeau).
  function firstPerson(on) { headMesh.visible = !on; eyes.forEach((e) => (e.visible = !on)); brows.forEach((b) => (b.visible = !on)); ears.forEach((e) => (e.e.visible = !on)); mouth.visible = !on; head.children.forEach((c) => { if (c.isMesh) c.visible = !on; }); tipP.visible = !on; }
  const eyeWorld = (out = new THREE.Vector3()) => head.localToWorld(out.set(0, HC.y + 0.02, 0.38));

  return { root, update, setPose, setWalk, attach, firstPerson, eyeWorld, get pose() { return pose; }, parts: { head, hatP, lantern, can, model }, height: 2.45 * scale };
}
