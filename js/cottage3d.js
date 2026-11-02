// La maison d'Ernest : une maison de gnome de conte irlandais, tout en code.
// Murs chaulés ronds et un peu de travers, gros toit de chaume arrondi avec un « sourcil » au-dessus de la
// porte ronde rouge, fenêtres rondes enfoncées, cheminée de pierres qui penche, lierre, mousse, digitales,
// trèfles, amanites, tas de bois, banc et lanterne. Les éléments répétés sont des InstancedMesh (≈ 30 meshes).
// buildCottage(THREE, { rng, M }) -> { group, smokeOrigin, update(t, night), light, glowPoints: [{ p, s }] } ; origine au sol, porte vers +z.

export function buildCottage(THREE, { rng = Math.random, M = {} } = {}) {
  const group = new THREE.Group();
  group.name = 'cottage';
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const Z = V(0, 0, 1), Y = V(0, 1, 0);
  const C = (h) => new THREE.Color(h);
  const R = (a, b) => a + (b - a) * rng();
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const vary = (c, amt = 0.08) => { const o = C(c); const h = {}; o.getHSL(h); o.setHSL(h.h + (rng() - 0.5) * amt * 0.4, clamp01(h.s + (rng() - 0.5) * amt), clamp01(h.l + (rng() - 0.5) * amt)); return o; };
  const std = (o) => new THREE.MeshStandardMaterial(o);
  // textures procédurales (canvas) : fibres de paille, grain de bois, piqûres de pierre
  const canTex = (w, h, draw, rx = 1, ry = 1) => { if (typeof document === 'undefined') return null; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); return t; };
  const strawTex = (rx, ry) => canTex(256, 256, (x, w, h) => { x.fillStyle = '#b8b8b8'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const v = 120 + Math.floor(rng() * 135), px = rng() * w, py = rng() * h, L = 20 + rng() * 70; x.strokeStyle = `rgb(${v},${v},${v})`; x.lineWidth = 0.6 + rng() * 1.6; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + (rng() - 0.5) * 6, py + L / 2, px + (rng() - 0.5) * 8, py + L); x.stroke(); }
    x.fillStyle = 'rgba(40,30,20,0.35)'; for (let i = 0; i < 40; i++) x.fillRect(rng() * w, rng() * h, 1.2, 10 + rng() * 30); }, rx, ry);
  const grainTex = (rx, ry) => canTex(128, 256, (x, w, h) => { x.fillStyle = '#a0a0a0'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const v = 90 + Math.floor(rng() * 110), px = rng() * w; x.strokeStyle = `rgb(${v},${v},${v})`; x.lineWidth = 0.5 + rng() * 2; x.beginPath(); x.moveTo(px, 0); for (let y = 0; y <= h; y += 16) x.lineTo(px + Math.sin(y * 0.05 + i) * 3 * rng(), y); x.stroke(); }
    for (let i = 0; i < 6; i++) { x.strokeStyle = 'rgba(50,50,50,.6)'; x.beginPath(); x.ellipse(rng() * w, rng() * h, 3 + rng() * 4, 8 + rng() * 10, 0, 0, 6.29); x.stroke(); } }, rx, ry);
  const pitTex = (rx, ry) => canTex(128, 128, (x, w, h) => { x.fillStyle = '#909090'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) { const v = 60 + Math.floor(rng() * 160); x.fillStyle = `rgba(${v},${v},${v},.6)`; x.beginPath(); x.arc(rng() * w, rng() * h, 0.6 + rng() * 2.6, 0, 6.29); x.fill(); } }, rx, ry);
  const withTex = (m, bump, bs, map) => { if (bump) { m.bumpMap = bump; m.bumpScale = bs; } if (map) m.map = map; m.needsUpdate = true; return m; };

  // ---------- Matériaux ----------
  const MAT = {
    wash: std({ color: 0xffffff, vertexColors: true, roughness: 0.97 }),
    thatch: withTex(std({ color: 0xffffff, vertexColors: true, roughness: 1 }), strawTex(18, 4), 10, strawTex(18, 4)),
    straw: withTex(std({ color: 0xffffff, roughness: 1 }), strawTex(1, 1), 6, strawTex(1, 1)),
    stone: withTex(std({ color: 0xffffff, roughness: 0.95 }), pitTex(2, 2), 7, canTex(128, 128, (x, w, h) => { x.fillStyle = '#e8e4da'; x.fillRect(0, 0, w, h); for (let i = 0; i < 600; i++) { const v = 120 + Math.floor(rng() * 135); x.fillStyle = `rgba(${v},${v},${v - 6},.6)`; x.beginPath(); x.arc(rng() * w, rng() * h, 0.5 + rng() * 2.2, 0, 6.29); x.fill(); } for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(${170 + rng() * 40},${185 + rng() * 40},${100 + rng() * 40},.5)`; x.beginPath(); x.arc(rng() * w, rng() * h, 3 + rng() * 10, 0, 6.29); x.fill(); } }, 2, 2)),
    paint: withTex(std({ color: 0xa3301f, roughness: 0.62 }), grainTex(3, 1), 5, grainTex(3, 1)),
    trim: std({ color: 0x2f5b3f, roughness: 0.7 }),
    wood: withTex(std({ color: 0xffffff, roughness: 0.88 }), grainTex(1, 1), 6, grainTex(1, 1)),
    woodDark: withTex((M.woodDark ? M.woodDark.clone() : std({ color: 0x5a3a1a, roughness: 0.9 })), grainTex(1, 1), 6, grainTex(1, 1)),
    bark: withTex((M.bark ? M.bark.clone() : std({ color: 0x5b3f26, roughness: 0.95 })), grainTex(2, 1), 8, grainTex(2, 1)),
    endgrain: std({ color: 0xc8a26a, roughness: 0.9 }),
    iron: std({ color: 0x26241f, roughness: 0.5, metalness: 0.75 }),
    leaf: std({ color: 0xffffff, roughness: 0.75, side: THREE.DoubleSide }),
    petal: std({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, flatShading: true }),
    dots: std({ color: 0xffffff, roughness: 0.7 }),
    glass: std({ color: 0x2c3e4c, roughness: 0.1, metalness: 0.5, emissive: 0xffa24a, emissiveIntensity: 0.08 }),
    glow: std({ color: 0xffe0a0, emissive: 0xffa040, emissiveIntensity: 0.3 }),
    pot: M.terra || std({ color: 0xb4652a, roughness: 0.9 }),
  };

  // ---------- Instanciation ----------
  const bins = new Map();
  const bin = (key, geo, mat, { cast = true, receive = true } = {}) => bins.set(key, { geo, mat, cast, receive, mats: [], cols: [] });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = V();
  const put = (key, pos, quat, s, color) => {
    const b = bins.get(key);
    sc.set(...(typeof s === 'number' ? [s, s, s] : s));
    b.mats.push(m4.compose(pos, quat, sc).clone());
    b.cols.push(color ? C(color) : C(0xffffff));
  };
  const qFace = (n, twist = 0) => new THREE.Quaternion().setFromUnitVectors(Z, n.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(Z, twist));
  const qEuler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  const qBasis = (xA, yA, zA) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, zA));

  const gStone = (() => { const g = new THREE.IcosahedronGeometry(0.5, 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.12 * Math.sin(x * 9.1 + y * 4.3) * Math.cos(z * 7.7 - x * 3.1) - 0.08 * Math.max(0, Math.abs(y) * 2 - 0.6); p.setXYZ(i, x * k, y * k, z * k); } g.computeVertexNormals(); return g; })(); // galet arrondi, bosselé
  const gBlob = new THREE.IcosahedronGeometry(0.5, 1);
  const gBox = new THREE.BoxGeometry(1, 1, 1);
  const gLeaf = new THREE.CircleGeometry(0.5, 5);
  const gLog = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
  bin('stone', gStone, MAT.stone);
  bin('tuft', gBlob, MAT.straw, { cast: false });
  bin('moss', gBlob, MAT.leaf, { cast: false });
  bin('dark', gBox, MAT.woodDark);
  bin('woodB', gBox, MAT.wood);
  bin('iron', gBox, MAT.iron, { cast: false });
  bin('glass', new THREE.CircleGeometry(0.5, 14), MAT.glass, { cast: false });
  bin('frame', new THREE.TorusGeometry(0.5, 0.11, 6, 16), MAT.trim);
  bin('logs', gLog, [MAT.bark, MAT.endgrain, MAT.endgrain]);
  bin('leaf', gLeaf, MAT.leaf, { cast: false });
  bin('bell', new THREE.ConeGeometry(0.5, 1, 6, 1, true), MAT.petal, { cast: false });
  bin('stem', new THREE.CylinderGeometry(0.5, 0.5, 1, 4), MAT.leaf, { cast: false });
  bin('dots', gBlob, MAT.dots, { cast: false });
  bin('blade', new THREE.ConeGeometry(0.5, 1, 3), MAT.leaf, { cast: false });
  bin('cap', new THREE.SphereGeometry(0.5, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), MAT.dots);

  // ---------- Murs chaulés, ronds, un peu de travers ----------
  const XS = 1.06; // ovale : plus large que profond
  const wProf = [[1.21, -0.05], [1.26, 0.18], [1.285, 0.45], [1.295, 0.75], [1.285, 1.05], [1.26, 1.35], [1.21, 1.62], [1.13, 1.86], [1.0, 2.05], [0.75, 2.2], [0.35, 2.27], [0.0, 2.28]];
  const ph = Array.from({ length: 8 }, () => rng() * Math.PI * 2);
  const wn = (p, y) => 0.026 * Math.sin(2 * p + ph[0] + y * 1.3) + 0.018 * Math.sin(3 * p + ph[1] - y * 2.1) + 0.011 * Math.sin(5 * p + ph[2] + y * 3.7) + 0.006 * Math.sin(9 * p + ph[3] + y * 5.3);
  const damp = (p, y) => 1 - 0.9 * Math.exp(-p * p * 9) * (1 - sstep(1.3, 1.7, y));
  const lean = (y) => 0.075 * y * y / 4; // la maison penche un peu vers +x
  const wR = (y) => { for (let i = 1; i < wProf.length; i++) { const [r1, y1] = wProf[i]; if (y <= y1 || i === wProf.length - 1) { const [r0, y0] = wProf[i - 1]; return r0 + (r1 - r0) * clamp01((y - y0) / (y1 - y0)); } } return 0; };
  const wallPt = (p, y, off = 0) => { const r = wR(y) * (1 + wn(p, y) * damp(p, y)) + off; return V(Math.sin(p) * r * XS + lean(y), y, Math.cos(p) * r); };
  const wallN = (p) => V(Math.sin(p) / XS, 0, Math.cos(p)).normalize();
  {
    // profil densifié pour que le relief des pierres sous la chaux se voie
    const prof = []; for (let i = 0; i < wProf.length - 1; i++) { const [r0, y0] = wProf[i], [r1, y1] = wProf[i + 1]; for (let k = 0; k < 4; k++) { const f = k / 4; prof.push(new THREE.Vector2(r0 + (r1 - r0) * f, y0 + (y1 - y0) * f)); } } prof.push(new THREE.Vector2(...wProf[wProf.length - 1]));
    const g = new THREE.LatheGeometry(prof, 84);
    // pierres noyées dans la chaux : bosses en rangs irréguliers (cellules), plus fortes en bas
    const cell = (p, y) => { const row = Math.floor(y / 0.2), yy = y / 0.2 - row, off = (row * 0.37) % 1, u = p * 6.2 / Math.PI + off, col = Math.floor(u), uu = u - col; const h = Math.sin(row * 12.9 + col * 78.2) * 0.5 + 0.5; return Math.sin(Math.PI * uu) ** 0.6 * Math.sin(Math.PI * yy) ** 0.6 * (0.55 + 0.45 * h); };
    const pos = g.attributes.position, cols = [];
    const white = C('#f1ead9'), warm = C('#e6d9bd'), dirt = C('#8f8366'), green = C('#6f7d4c'), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), r0 = Math.hypot(x, z), p = Math.atan2(x, z);
      const lump = r0 > 0.6 ? (cell(p, y) * 0.045 + 0.008 * Math.sin(p * 37 + y * 23) * Math.sin(p * 17 - y * 41)) * (1 - sstep(1.75, 2.05, y)) * (1 - 0.8 * Math.exp(-p * p * 14) * (1 - sstep(1.3, 1.7, y))) : 0;
      const r = r0 * (1 + wn(p, y) * damp(p, y)) + lump;
      pos.setXYZ(i, Math.sin(p) * r * XS + lean(y), y, Math.cos(p) * r);
      c.copy(white).lerp(warm, clamp01(0.5 + 0.5 * Math.sin(4 * p + ph[4] + y * 2.3)) * 0.7);
      c.lerp(dirt, (1 - sstep(0.0, 0.5, y)) * 0.75);
      c.multiplyScalar(0.78 + 0.22 * clamp01(lump / 0.04)); // joints plus sombres, pierres plus claires
      c.lerp(green, (1 - sstep(0.0, 0.35, y)) * clamp01(-Math.cos(p) + 0.3) * 0.5);
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    // grain de la chaux et petites fissures (bump procédural)
    if (typeof document !== 'undefined') { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) { const v = 100 + Math.floor(rng() * 70); x.fillStyle = `rgba(${v},${v},${v},0.5)`; const r = 1 + rng() * 3.5; x.beginPath(); x.arc(rng() * 256, rng() * 256, r, 0, 6.29); x.fill(); }
      x.strokeStyle = 'rgba(40,40,40,0.55)'; x.lineWidth = 1; for (let i = 0; i < 9; i++) { let px = rng() * 256, py = rng() * 256; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (rng() - 0.5) * 22; py += rng() * 14; x.lineTo(px, py); } x.stroke(); }
      const tx = new THREE.CanvasTexture(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(6, 2); MAT.wash.bumpMap = tx; MAT.wash.bumpScale = 7;
      // salissures : coulures sous l'avant-toit, taches d'humidité, chaux écaillée
      MAT.wash.map = canTex(256, 256, (x, w, h) => { x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
        for (let i = 0; i < 40; i++) { const px = rng() * w, L = 30 + rng() * 120; const gr = x.createLinearGradient(0, 0, 0, L); gr.addColorStop(0, 'rgba(120,105,80,.35)'); gr.addColorStop(1, 'rgba(120,105,80,0)'); x.fillStyle = gr; x.fillRect(px, 0, 1.5 + rng() * 5, L); }
        for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(${150 + rng() * 40},${140 + rng() * 40},${110 + rng() * 30},${0.12 + rng() * 0.2})`; x.beginPath(); x.ellipse(rng() * w, rng() * h, 8 + rng() * 26, 6 + rng() * 18, rng() * 3, 0, 6.29); x.fill(); }
        for (let i = 0; i < 12; i++) { x.fillStyle = 'rgba(140,130,115,.55)'; x.beginPath(); const cx = rng() * w, cy = h * 0.3 + rng() * h * 0.7; for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28, rr = 3 + rng() * 9; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7); } x.fill(); }
        for (let i = 0; i < 1500; i++) { const v = 200 + Math.floor(rng() * 55); x.fillStyle = `rgba(${v},${v - 4},${v - 12},.35)`; x.fillRect(rng() * w, rng() * h, 1.5, 1.5); } }, 6, 2);
      MAT.wash.needsUpdate = true; }
    const walls = new THREE.Mesh(g, MAT.wash); walls.castShadow = walls.receiveShadow = true; group.add(walls);
  }

  // ---------- Toit de chaume, rond et épais, avec un sourcil au-dessus de la porte ----------
  const roofCurve = new THREE.CatmullRomCurve3([
    V(0.98, 2.08), V(1.3, 1.64), V(1.47, 1.53), V(1.6, 1.62), V(1.63, 1.86), V(1.57, 2.12), V(1.43, 2.5), V(1.18, 2.95), V(0.84, 3.3), V(0.43, 3.53), V(0.02, 3.62),
  ]);
  const NP = 64, NS = 40;
  const rn = (p, s) => 0.045 * Math.sin(3 * p + ph[5] + s * 4) + 0.03 * Math.sin(7 * p + ph[6] - s * 6) + 0.015 * Math.sin(13 * p + ph[7]);
  const ridgeS = (p) => 0.7 - 0.045 * Math.abs(Math.sin(p * 7));
  const courseF = (p, s) => { const k = s * 7 + 0.22 * Math.sin(3 * p + ph[4]) + 0.06 * Math.sin(8 * p + ph[0]); return k - Math.floor(k); };
  const course = (p, s) => { if (s < 0.27) return 0; const band = s > ridgeS(p) ? 0.07 * (1 - sstep(0.86, 1, s)) : 0; return band || 0.05 * (1 - courseF(p, s)) * (1 - sstep(0.62, 0.7, s)); };
  const brow = (p, s) => 0.36 * Math.exp(-p * p / 0.13) * (1 - sstep(0.15, 0.55, s));
  const roofLean = (y) => lean(Math.min(y, 2.1)) + 0.09 * Math.max(0, y - 2.1); // le chapeau penche un peu plus
  const roofPt = (p, s, off = 0) => {
    const b = roofCurve.getPoint(Math.min(1, Math.max(0, s)));
    const r = b.x * (1 + rn(p, s)) + course(p, s) + off * (1 - s * 0.3);
    const y = b.y + brow(p, s) + 0.035 * Math.sin(6 * p + ph[2]) * (1 - sstep(0.1, 0.4, s)) + off * 0.4;
    return V(Math.sin(p) * r * XS + roofLean(y), y, Math.cos(p) * r);
  };
  const roofFrame = (p, s) => {
    const a = roofPt(p, s + 0.01), b = roofPt(p, s - 0.01), c = roofPt(p + 0.01, s), d = roofPt(p - 0.01, s);
    const down = b.clone().sub(a).normalize(), tang = c.clone().sub(d).normalize();
    const n = tang.clone().cross(a.clone().sub(b)).normalize();
    return { n, down, tang };
  };
  {
    const g = new THREE.LatheGeometry(roofCurve.getPoints(NP - 1).map((p) => new THREE.Vector2(p.x, p.y)), NS);
    const pos = g.attributes.position, cols = [];
    const straw = C('#c99d4e'), old = C('#9a7638'), dark = C('#5c4422'), moss = C('#66733a'), fresh = C('#dcb764'), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const j = i % NP, s = j / (NP - 1), x = pos.getX(i), z = pos.getZ(i), p = Math.atan2(x, z);
      const v = roofPt(p, s); pos.setXYZ(i, v.x, v.y, v.z);
      const n1 = Math.sin(5 * p + ph[1] + s * 9), n2 = Math.sin(11 * p + ph[3] - s * 13);
      c.copy(straw).lerp(fresh, clamp01(n2) * 0.5).lerp(old, clamp01(n1) * 0.55);
      c.lerp(dark, s < 0.12 ? 0.75 : (1 - sstep(0.12, 0.3, s)) * 0.35);
      if (s > 0.27 && s < ridgeS(p)) c.lerp(dark, sstep(0.7, 1, courseF(p, s)) * 0.6);
      if (s >= ridgeS(p)) c.lerp(fresh, 0.45);
      c.lerp(moss, clamp01(n1 * n2 * 1.6) * (1 - sstep(0.3, 0.75, s)) * clamp01(0.4 - Math.cos(p)));
      cols.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    const roof = new THREE.Mesh(g, MAT.thatch); roof.castShadow = roof.receiveShadow = true; group.add(roof);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 10), (() => { const m = MAT.straw.clone(); m.color.set(0xb48b3e); return m; })());
    knot.scale.set(1, 0.7, 1); knot.position.set(roofLean(3.66), 3.66, 0); knot.castShadow = true; group.add(knot);
  }
  // touffes de chaume : la frange de l'avant-toit et le relief du toit
  const strawCols = ['#c69a4b', '#d6b061', '#a98340', '#b88d44', '#e0c070'];
  const tuft = (p, s, len, wid, off) => {
    const { n, down } = roofFrame(p, s);
    const xA = n.clone().cross(down).normalize(), yA = down.clone().cross(xA).normalize();
    put('tuft', roofPt(p, s, off), qBasis(xA, yA, down), [wid, Math.min(0.06 + rng() * 0.03, wid * 0.6), len], strawCols[(rng() * strawCols.length) | 0]);
  };
  for (let i = 0; i < 120; i++) { const p = (i / 120) * Math.PI * 2 + R(-0.02, 0.02); tuft(p, R(0.19, 0.25), R(0.3, 0.44), R(0.09, 0.14), 0.025); }
  for (let i = 0; i < 260; i++) { const p = rng() * Math.PI * 2, s = R(0.3, 0.68); tuft(p, s, R(0.22, 0.34), R(0.04, 0.07), 0.008); }
  // liens de noisetier croisés sur le faîtage (motif des chaumes irlandais)
  const stick = (a, b, th = 0.018) => { const d = b.clone().sub(a), len = d.length(); put('woodB', a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), [th, len, th], '#a8845a'); };
  const lig = (p, s) => roofPt(p, s, 0.006);
  for (let i = 0; i < 28; i++) { const p0 = (i / 28) * Math.PI * 2, p1 = ((i + 1) / 28) * Math.PI * 2, pm = (p0 + p1) / 2;
    stick(lig(p0, 0.74), lig(pm, 0.82)); stick(lig(pm, 0.82), lig(p1, 0.74));
    stick(lig(p0, 0.735), lig(p1, 0.735), 0.022); stick(lig(p0, 0.825), lig(p1, 0.825), 0.022); }
  for (let i = 0; i < 16; i++) { const p = R(1.6, 4.6), s = R(0.26, 0.55), { n } = roofFrame(p, s); put('moss', roofPt(p, s, 0.01), qFace(n, rng() * 6), [R(0.25, 0.4), R(0.18, 0.3), 0.04], vary('#7d8a45', 0.08)); }

  // ---------- Cheminée de pierres qui penche ----------
  let smokeOrigin;
  {
    const pc = 2.5, n = wallN(pc), t = V(n.z, 0, -n.x), base = wallPt(pc, 0.3, 0.12);
    const layers = 20, top = 3.92;
    const at = (y) => base.clone().addScaledVector(n, 0.018 * y * y).addScaledVector(t, 0.05 * y).setY(y);
    const sCols = ['#8e877a', '#7d776b', '#9a9283', '#6f6a5f', '#a39b88'];
    for (let k = 0; k < layers; k++) {
      const y = 0.1 + (k / (layers - 1)) * (top - 0.1), c = at(y), w = 0.62 - 0.2 * (k / layers);
      put('stone', c, qEuler(0, rng() * 0.6, 0), [w, 0.26, w], '#6e695e');
      for (let s = 0; s < 4; s++) {
        const a = s * Math.PI / 2 + k * 0.8 + R(-0.3, 0.3);
        const off = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(w * 0.36);
        put('stone', c.clone().add(off).setY(y + R(-0.03, 0.03)), qEuler(R(-0.3, 0.3), a, R(-0.3, 0.3)), [w * R(0.5, 0.7), R(0.17, 0.24), w * R(0.45, 0.6)], sCols[(rng() * 5) | 0]);
      }
    }
    const ct = at(top + 0.1);
    put('stone', ct, qEuler(0.05, 0.4, -0.06), [0.6, 0.1, 0.6], '#7a7468');
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.26, 16), MAT.pot); pot.position.copy(ct).add(V(0.02, 0.17, 0)); pot.rotation.z = -0.08; pot.castShadow = true; group.add(pot);
    smokeOrigin = pot.position.clone().add(V(0, 0.14, 0));
  }

  // ---------- Pierres : soubassement, pierres apparentes, arc de la porte, marche ----------
  const stoneCols = ['#8c8676', '#9b9483', '#777164', '#a8a08c', '#6b665b', '#8f8a74'];
  const sc6 = () => stoneCols[(rng() * stoneCols.length) | 0];
  for (let i = 0; i < 46; i++) {
    const p = (i / 46) * Math.PI * 2 + R(-0.04, 0.04); if (Math.abs(((p + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.32) continue;
    put('stone', wallPt(p, 0.06, 0.03), qFace(wallN(p), R(-0.4, 0.4)), [R(0.24, 0.34), R(0.16, 0.24), R(0.16, 0.22)], sc6());
  }
  for (let k = 0; k < 4; k++) { // plaques où la chaux est tombée
    const p0 = R(-2.6, 2.6), y0 = R(0.5, 1.5); if (Math.abs(p0) < 0.6) continue;
    for (let i = 0; i < 5; i++) { const p = p0 + R(-0.12, 0.12), y = y0 + R(-0.12, 0.12); put('stone', wallPt(p, y, 0.0), qFace(wallN(p), R(-0.5, 0.5)), [R(0.12, 0.18), R(0.08, 0.12), 0.06], sc6()); }
  }
  const DC = 0.64, DR = 0.42, DZ = wR(0.6) + 0.035; // centre et rayon de la porte ronde
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI, key = i === 6;
    const p = V(Math.cos(a) * (DR + 0.085), DC + Math.sin(a) * (DR + 0.085), DZ + 0.05);
    put('stone', p, qEuler(0, 0, a + Math.PI / 2), key ? [0.2, 0.2, 0.14] : [R(0.15, 0.19), R(0.13, 0.16), 0.12], sc6());
  }
  for (const sx of [-1, 1]) for (const y of [0.14, 0.36, 0.57]) put('stone', V(sx * (DR + 0.09), y, DZ + 0.04), qEuler(0, 0, R(-0.2, 0.2)), [0.17, R(0.18, 0.22), 0.13], sc6());
  put('stone', V(0, 0.05, DZ + 0.27), qEuler(0, 0.05, 0), [1.0, 0.12, 0.42], '#8a8474');

  // ---------- Porte ronde peinte en rouge, pentures de fer ----------
  {
    const sh = new THREE.Shape();
    const yb = 0.1;
    sh.moveTo(-DR, yb); sh.lineTo(DR, yb); sh.lineTo(DR, DC); sh.absarc(0, DC, DR, 0, Math.PI, false); sh.lineTo(-DR, yb);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 20 });
    const door = new THREE.Mesh(g, MAT.paint); door.position.z = DZ - 0.06; door.castShadow = door.receiveShadow = true; group.add(door);
    const fz = DZ + 0.04;
    for (const x of [-0.21, 0, 0.21]) { const h = DC + Math.sqrt(DR * DR - x * x) - yb - 0.06; put('dark', V(x, yb + h / 2 + 0.01, fz), q.identity().clone(), [0.016, h, 0.012]); }
    for (const y of [0.32, 0.86]) { const hw = y < DC ? DR : Math.sqrt(DR * DR - (y - DC) ** 2); put('iron', V(-hw * 0.18, y, fz + 0.012), q.identity().clone(), [hw * 1.55, 0.045, 0.014]); put('iron', V(hw * 0.55, y, fz + 0.016), qEuler(0, 0, Math.PI / 4), [0.06, 0.06, 0.016]); }
    put('dots', V(0.27, 0.6, fz + 0.03), q.identity().clone(), [0.06, 0.06, 0.05], '#2a2722');
    // judas rond dans la porte
    put('glass', V(0, 0.95, fz + 0.006), q.identity().clone(), 0.17);
    put('frame', V(0, 0.95, fz + 0.012), q.identity().clone(), [0.18, 0.18, 0.18], '#2b2824');
    put('iron', V(0, 0.95, fz + 0.016), q.identity().clone(), [0.012, 0.16, 0.01]); put('iron', V(0, 0.95, fz + 0.016), q.identity().clone(), [0.16, 0.012, 0.01]);
  }

  // ---------- Fenêtres rondes enfoncées, jardinières ----------
  const flowerCols = ['#e8473a', '#f2c84b', '#f4efe6', '#7a5cc8', '#e77fb0'];
  const glowPoints = []; // centres des halos (fenêtres, lanterne), en coordonnées locales, un peu devant le mur
  for (const [p, y, box] of [[0.8, 1.05, true], [-0.92, 1.0, true], [1.95, 1.05, false], [-2.05, 1.12, false]]) {
    const n = wallN(p), w = wallPt(p, y), qq = qFace(n);
    put('glass', w.clone().addScaledVector(n, 0.05), qq, 0.36);
    glowPoints.push({ p: w.clone().addScaledVector(n, 0.32), s: 1.1 });
    put('frame', w.clone().addScaledVector(n, 0.06), qq, [0.4, 0.4, 0.5]);
    put('dark', w.clone().addScaledVector(n, 0.065), qq, [0.025, 0.36, 0.02]);
    put('dark', w.clone().addScaledVector(n, 0.065), qq, [0.36, 0.025, 0.02]);
    put('stone', wallPt(p, y - 0.25, 0.07), qFace(n), [0.42, 0.07, 0.16], '#8d8778');
    if (box) {
      const bp = wallPt(p, y - 0.34, 0.13);
      put('woodB', bp, qq, [0.5, 0.13, 0.15], '#7a5230');
      const t = V(n.z, 0, -n.x);
      for (let i = 0; i < 12; i++) { const f = bp.clone().addScaledVector(t, R(-0.21, 0.21)).addScaledVector(n, R(-0.04, 0.05)).add(V(0, R(0.08, 0.15), 0)); put('dots', f, qEuler(rng(), rng(), rng()), R(0.05, 0.075), flowerCols[(rng() * 5) | 0]); }
      for (let i = 0; i < 9; i++) { const f = bp.clone().addScaledVector(t, R(-0.22, 0.22)).addScaledVector(n, R(0, 0.08)).add(V(0, 0.07, 0)); put('leaf', f, qEuler(R(-1.2, -0.3), rng() * 6, 0), R(0.07, 0.1), vary('#4f7f34', 0.1)); }
    }
  }

  // ---------- Lierre qui grimpe sur le côté gauche ----------
  for (let v = 0; v < 6; v++) {
    let p = R(-2.5, -1.25), y = 0.05; const top = R(1.2, 2.0);
    while (y < top) {
      p += R(-0.05, 0.05); y += R(0.04, 0.07);
      for (let k = 0; k < 2; k++) {
        const pp = p + R(-0.05, 0.05), n = wallN(pp);
        const qq = qFace(n.clone().add(V(R(-0.4, 0.4), R(0.2, 0.7), R(-0.4, 0.4))), rng() * 6);
        put('leaf', wallPt(pp, y + R(-0.03, 0.03), R(0.015, 0.05)), qq, R(0.07, 0.11), vary(rng() < 0.3 ? '#4d7a2c' : '#2f5a26', 0.1));
      }
    }
  }

  // ---------- Banc, tas de bois, billot ----------
  {
    const p = -0.62, n = wallN(p), t = V(n.z, 0, -n.x), c = wallPt(p, 0.33, 0.24);
    const qb = qBasis(t, Y, n);
    put('woodB', c, qb, [0.78, 0.06, 0.24], '#8a5d33');
    put('woodB', c.clone().addScaledVector(n, -0.11).add(V(0, 0.2, 0)), qb, [0.74, 0.12, 0.04], '#7a5230');
    for (const s of [-0.3, 0.3]) put('logs', c.clone().addScaledVector(t, s).setY(0.15), q.identity().clone(), [0.13, 0.3, 0.13]);
  }
  {
    const p = 1.42, n = wallN(p), t = V(n.z, 0, -n.x), base = wallPt(p, 0, 0.2);
    const qL = new THREE.Quaternion().setFromUnitVectors(Y, n.clone().negate().add(t.clone().multiplyScalar(0)).normalize());
    const qT = new THREE.Quaternion().setFromUnitVectors(Y, t);
    const rows = [5, 4, 3, 2], r = 0.075;
    rows.forEach((cnt, k) => { for (let i = 0; i < cnt; i++) { const off = (i - (cnt - 1) / 2) * r * 2.05; put('logs', base.clone().addScaledVector(t, off).setY(r + k * r * 1.75), qL.clone().multiply(qEuler(0, rng() * 3, 0)), [r * 2 * R(0.85, 1.05), R(0.34, 0.42), r * 2 * R(0.85, 1.05)]); } });
    void qT;
    const blk = base.clone().addScaledVector(n, 0.1).addScaledVector(t, -0.62);
    put('logs', blk.clone().setY(0.14), qEuler(0, 0.5, 0), [0.34, 0.28, 0.34]);
    put('logs', blk.clone().addScaledVector(t, -0.22).add(V(0, 0.06, 0)), qEuler(Math.PI / 2, 0.8, 0), [0.12, 0.34, 0.12]);
  }

  // ---------- Amanites tue-mouches ----------
  for (const [p, d, s] of [[-1.6, 0.3, 1], [-1.75, 0.45, 0.7], [2.2, 0.32, 0.85], [2.32, 0.5, 0.6]]) {
    const b = wallPt(p, 0, d), h = 0.14 * s, cr = 0.15 * s;
    put('stem', b.clone().setY(h / 2), q.identity().clone(), [0.05 * s, h, 0.05 * s], '#efe6d2');
    const cp = b.clone().setY(h - 0.01); put('cap', cp, qEuler(R(-0.15, 0.15), 0, R(-0.15, 0.15)), [cr * 2, cr * 1.2, cr * 2], '#c42b1c');
    for (let i = 0; i < 6; i++) { const a = rng() * 6.28, rr = R(0.2, 0.75) * cr; put('dots', cp.clone().add(V(Math.cos(a) * rr, Math.sqrt(Math.max(0, 1 - (rr / cr) ** 2)) * cr * 0.6 + 0.005, Math.sin(a) * rr)), q.identity().clone(), 0.025 * s, '#fbf6ea'); }
  }

  // ---------- Digitales au pied des murs ----------
  const fgCols = ['#b2479c', '#c95aa8', '#d985c0', '#a23d8d', '#efdcec'];
  const foxglove = (b, h) => {
    const tilt = V(R(-0.06, 0.06), 1, R(-0.06, 0.06)).normalize();
    put('stem', b.clone().addScaledVector(tilt, h / 2), new THREE.Quaternion().setFromUnitVectors(Y, tilt), [0.02, h, 0.02], '#4b6e31');
    const nb = 9 + ((rng() * 4) | 0), col = fgCols[(rng() * fgCols.length) | 0];
    for (let i = 0; i < nb; i++) {
      const f = i / nb, y = h * (0.42 + f * 0.55), a = i * 2.4, sz = 0.11 * (1 - f * 0.55);
      const c = b.clone().addScaledVector(tilt, y).add(V(Math.cos(a) * sz * 0.5, 0, Math.sin(a) * sz * 0.5));
      put('bell', c, qEuler(Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7).multiply(qEuler(Math.PI, 0, 0)), [sz * 0.55, sz, sz * 0.55], vary(col, 0.06));
    }
    for (let i = 0; i < 6; i++) { const a = rng() * 6.28; put('leaf', b.clone().add(V(Math.cos(a) * 0.08, 0.04, Math.sin(a) * 0.08)), qEuler(-Math.PI / 2 + R(0.2, 0.6), a, 0).multiply(qEuler(0, 0, 0)), [0.12, 0.26, 0.12], vary('#3f6a2c', 0.1)); }
  };
  for (const [p, d] of [[-1.12, 0.22], [-1.24, 0.38], [-1.02, 0.42], [0.98, 0.24], [1.08, 0.4], [2.75, 0.2], [-2.85, 0.2], [3.3, 0.18]]) foxglove(wallPt(p, 0, d), R(0.55, 0.85));

  // ---------- Trèfles et herbes ----------
  const clover = (c) => { const a0 = rng() * 6.28, col = vary(rng() < 0.5 ? '#4f8f36' : '#3f7d2e', 0.08); for (let k = 0; k < 3; k++) { const a = a0 + k * 2.094; put('leaf', c.clone().add(V(Math.cos(a) * 0.028, 0, Math.sin(a) * 0.028)), qEuler(-Math.PI / 2 + R(-0.25, 0.25), 0, a), [0.065, 0.065, 0.065], col); } };
  for (let i = 0; i < 46; i++) { const p = R(-1.0, 1.0) + (rng() < 0.3 ? Math.PI : 0), d = R(0.12, 0.55), b = wallPt(p, 0, d); if (Math.abs(b.x) < 0.55 && b.z > 1.1) continue; clover(b.setY(R(0.03, 0.09))); }
  for (let i = 0; i < 90; i++) { const p = rng() * Math.PI * 2, b = wallPt(p, 0, R(0.02, 0.4)); if (Math.abs(b.x) < 0.6 && b.z > 1.0) continue; const h = R(0.12, 0.3); put('blade', b.setY(h / 2), qEuler(R(-0.35, 0.35), rng() * 6, R(-0.35, 0.35)), [0.03, h, 0.03], vary('#557a33', 0.14)); }
  for (let i = 0; i < 16; i++) { const p = rng() * Math.PI * 2; put('moss', wallPt(p, 0.15, 0.08), qFace(wallN(p).add(V(0, 1.2, 0)), rng() * 6), [R(0.15, 0.25), R(0.12, 0.2), 0.07], vary('#5d7a33', 0.12)); }

  // ---------- Lanterne suspendue à droite de la porte ----------
  const lantern = new THREE.Group();
  const lightNode = new THREE.PointLight(0xffa860, 0, 7, 1.6);
  {
    const lp = 0.52, n = wallN(lp), anchor = wallPt(lp, 1.5, 0.3);
    put('iron', wallPt(lp, 1.5, 0.15), qBasis(V(n.z, 0, -n.x), Y, n), [0.03, 0.03, 0.32]);
    put('iron', wallPt(lp, 1.42, 0.02), qFace(n), [0.06, 0.18, 0.02]);
    lantern.position.copy(anchor);
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.14, 6), MAT.glow); glow.position.y = -0.17; lantern.add(glow);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.08, 6), MAT.iron); cap.position.y = -0.065; lantern.add(cap);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.03, 6), MAT.iron); foot.position.y = -0.255; lantern.add(foot);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.006, 4, 8), MAT.iron); hook.position.y = -0.01; lantern.add(hook);
    lightNode.position.set(0, -0.17, 0.12); lantern.add(lightNode);
    glowPoints.push({ p: anchor.clone().add(V(0, -0.17, 0)).addScaledVector(n, 0.08), s: 0.85 });
    group.add(lantern);
  }

  // ---------- Construction des InstancedMesh ----------
  let meshCount = 0;
  for (const [, b] of bins) {
    if (!b.mats.length) continue;
    const im = new THREE.InstancedMesh(b.geo, b.mat, b.mats.length);
    b.mats.forEach((m, i) => { im.setMatrixAt(i, m); im.setColorAt(i, b.cols[i]); });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.castShadow = b.cast; im.receiveShadow = b.receive;
    im.computeBoundingSphere();
    group.add(im);
  }
  group.traverse((o) => { if (o.isMesh) meshCount++; });
  group.userData.meshCount = meshCount;

  const update = (t, night = 0) => {
    const fl = 0.88 + 0.07 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.7 + 1.3) + 0.03 * Math.sin(t * 23.1);
    MAT.glass.emissiveIntensity = 0.06 + night * 3.4 * (0.94 + 0.06 * fl);
    MAT.glow.emissiveIntensity = 0.25 + night * 3.2 * fl;
    lightNode.intensity = night * 3 * fl;
    lantern.rotation.z = Math.sin(t * 1.1) * 0.05; lantern.rotation.x = Math.sin(t * 0.83 + 1) * 0.03;
  };
  update(0, 0);
  return { group, smokeOrigin, update, light: lightNode, glowPoints };
}
