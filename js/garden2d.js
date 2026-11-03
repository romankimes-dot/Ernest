// Les serres en 2D (canvas) : trois serres côte à côte, comme en 3D (Travail, Bien-être, Vie perso), plantes
// procédurales par graine, croissance par jours actifs, cycle jour/nuit sur l'heure réelle, lumière réglée par
// l'humeur. Repli quand la 3D est coupée.
import { growth, catId, floraOf } from './model.js';

export const HOUSES2D = [
  { id: 'travail', name: 'Travail', cats: ['travail'], accent: '#5f7fa6', signBg: '#26395a' }, // mêmes accents qu'en 3D
  { id: 'bienetre', name: 'Bien-être', cats: ['bienetre'], accent: '#8fa58a', signBg: '#34502f' },
  { id: 'perso', name: 'Vie perso', cats: ['perso'], accent: '#c9786a', signBg: '#5e2430' },
];
const houseOf = (cat) => catId(cat);
// aspect 2D d'une plante : d'après son végétal (le même mélange par serre qu'en 3D)
const LOOK = { ficus: 'boulot', broadleaf: 'boulot', lavender: 'revision', fern: 'esprit', mossy: 'esprit', succulent: 'corps', cactus: 'corps', thyme: 'cuisine', basil: 'cuisine', rosemary: 'cuisine', wildflowers: 'perso', flowering: 'perso', geranium: 'geranium', violet: 'revision', tallgrass: 'perso' };
const lookOf = (p) => LOOK[floraOf(p)[0]] || 'perso';
const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// ---- Générateurs : (ctx, x, y, taille 0..1, rng, t) ----
function fougere(ctx, x, y, g, r, t, col) {
  const n = 4 + Math.round(g * 5);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.32 + Math.sin(t / 1300 + i) * 0.02;
    const L = (26 + r() * 22) * (0.3 + 0.7 * g);
    ctx.strokeStyle = col.dark; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, y);
    const ex = x + Math.cos(a) * L, ey = y + Math.sin(a) * L; ctx.quadraticCurveTo(x + Math.cos(a) * L * .5, y + Math.sin(a) * L * .7, ex, ey); ctx.stroke();
    const seg = Math.round(L / 5);
    for (let s = 2; s < seg; s++) {
      const p = s / seg, px = x + (ex - x) * p, py = y + (ey - y) * p, w = (1 - p) * 7 * g + 1.5;
      ctx.fillStyle = col.leaf; ctx.beginPath(); ctx.ellipse(px, py, w, 1.6, a + .9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(px, py, w, 1.6, a - .9, 0, Math.PI * 2); ctx.fill();
    }
  }
}
function succulente(ctx, x, y, g, r, t, col) {
  const layers = 2 + Math.round(g * 3), base = 6 + g * 9;
  for (let l = layers; l >= 0; l--) {
    const k = 5 + l, rad = base * (0.35 + 0.65 * l / layers);
    for (let i = 0; i < k; i++) {
      const a = (i / k) * Math.PI * 2 + l * .4 + r() * .1;
      ctx.fillStyle = l % 2 ? col.leaf : col.dark;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * rad * .5, y - 3 + Math.sin(a) * rad * .25, rad * .55, rad * .22, a, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (g > .85) { ctx.fillStyle = col.flower; ctx.beginPath(); ctx.arc(x, y - base - 6, 3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = col.dark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, y - base - 4); ctx.stroke(); }
}
function herbacee(ctx, x, y, g, r, t, col) {
  const n = 2 + Math.round(g * 4);
  for (let i = 0; i < n; i++) {
    const H = (22 + r() * 30) * (0.25 + 0.75 * g), dx = (r() - .5) * 14, sway = Math.sin(t / 1100 + i + x) * 2 * g;
    ctx.strokeStyle = col.dark; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x + dx * .3, y); ctx.quadraticCurveTo(x + dx, y - H * .6, x + dx + sway, y - H); ctx.stroke();
    ctx.fillStyle = col.leaf; ctx.beginPath(); ctx.ellipse(x + dx * .6 + 4, y - H * .45, 6 * g + 2, 2.2, -.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + dx * .6 - 4, y - H * .3, 6 * g + 2, 2.2, .6, 0, Math.PI * 2); ctx.fill();
    if (g > .6) { ctx.fillStyle = col.flower; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; ctx.beginPath(); ctx.arc(x + dx + sway + Math.cos(a) * 3, y - H + Math.sin(a) * 3, 2.2, 0, Math.PI * 2); ctx.fill(); } ctx.fillStyle = '#f2b23d'; ctx.beginPath(); ctx.arc(x + dx + sway, y - H, 1.6, 0, Math.PI * 2); ctx.fill(); }
  }
}
function aromatique(ctx, x, y, g, r, t, col) {
  ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.moveTo(x - 9, y - 10); ctx.lineTo(x + 9, y - 10); ctx.lineTo(x + 7, y); ctx.lineTo(x - 7, y); ctx.fill();
  const n = 3 + Math.round(g * 6);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (r() - .5) * 1.6, L = (12 + r() * 16) * (0.3 + 0.7 * g);
    ctx.strokeStyle = col.dark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + Math.cos(a) * L, y - 10 + Math.sin(a) * L); ctx.stroke();
    for (let s = 1; s <= 3; s++) { const p = s / 3; ctx.fillStyle = s % 2 ? col.leaf : col.dark; ctx.beginPath(); ctx.arc(x + Math.cos(a) * L * p, y - 10 + Math.sin(a) * L * p, 2.6 * g + 1, 0, Math.PI * 2); ctx.fill(); }
  }
}
function mousse(ctx, x, y, g, r, t, col) {
  const n = 5 + Math.round(g * 8);
  for (let i = 0; i < n; i++) { ctx.fillStyle = i % 3 ? col.leaf : col.dark; ctx.beginPath(); ctx.arc(x + (r() - .5) * 26, y - r() * 4, 2 + r() * 3 * (0.4 + 0.6 * g), 0, Math.PI * 2); ctx.fill(); }
}
function bonsai(ctx, x, y, g, r, t, col, branches = 0) {
  ctx.fillStyle = '#5a3a1a'; ctx.fillRect(x - 14, y - 6, 28, 7);
  const H = 18 + g * 16;
  ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.quadraticCurveTo(x - 6, y - H * .5, x + 3, y - H); ctx.stroke();
  const n = Math.min(8, 1 + branches);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i % 2 ? .9 : -.9) + (r() - .5) * .4, py = y - H * (0.4 + 0.6 * (i + 1) / (n + 1)), L = 8 + r() * 8;
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x + (py < y - H * .5 ? 2 : -2), py); ctx.lineTo(x + Math.cos(a) * L, py + Math.sin(a) * L); ctx.stroke();
    ctx.fillStyle = col.leaf; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * L, py + Math.sin(a) * L - 2, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = col.leaf; ctx.beginPath(); ctx.ellipse(x + 3, y - H - 3, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
}
// Révision : lavande ; Boulot : grandes feuilles ; Corps : succulentes ; Esprit : fougères ; Cuisine : aromatiques ; Perso : fleurs des champs.
const GEN = { esprit: fougere, corps: succulente, revision: herbacee, cuisine: aromatique, boulot: fougere, perso: herbacee, geranium: herbacee };
const COLS = {
  revision: { leaf: '#7a9a7a', dark: '#4c6a55', flower: '#9d7cc8' }, corps: { leaf: '#8fc98f', dark: '#3f8a5c', flower: '#f2b23d' },
  esprit: { leaf: '#5fae6d', dark: '#2f6b48', flower: '#6fb3c9' }, cuisine: { leaf: '#9cc46a', dark: '#5c8a3a', flower: '#f2b23d' },
  boulot: { leaf: '#3f7a46', dark: '#2a5e44', flower: '#efe6d2' }, perso: { leaf: '#9cc46a', dark: '#6b7a66', flower: '#e86f8a' }, geranium: { leaf: '#5a9442', dark: '#3f6a35', flower: '#d8283a' },
};

export class Garden {
  constructor(canvas) { this.cv = canvas; this.ctx = canvas.getContext('2d'); this.state = null; this.today = null; this.light = 'ok'; this.running = false; this.pulse = 0; this.onTick = null; }
  update(state, today) { this.state = state; this.today = today; this.light = state._light || 'ok'; }
  start() { if (this.running) return; this.running = true; const loop = (t) => { if (!this.running) return; this.draw(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  stop() { this.running = false; }
  water() { this.pulse = performance.now(); }
  draw(t) {
    const cv = this.cv, ctx = this.ctx;
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== W * dpr || cv.height !== H * dpr) { cv.width = W * dpr; cv.height = H * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const day = Math.max(0, Math.min(1, h < 6 ? 0 : h < 8 ? (h - 6) / 2 : h < 18 ? 1 : h < 21 ? (21 - h) / 3 : 0));
    const mood = this.light === 'low' ? .55 : this.light === 'high' ? 1.1 : .85;
    // Ciel
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, lerp('#0a1a24', '#8fc3d9', day * mood)); g.addColorStop(.7, lerp('#0b1511', '#c9dcc0', day * mood * .8)); g.addColorStop(1, lerp('#1a2418', '#9bb48a', day * mood * .8));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const band = lerp('#0a1a24', '#8fc3d9', day * mood); if (band !== this._band && cv.parentElement) { this._band = band; cv.parentElement.style.background = band; }
    // Lune ou soleil
    if (day < .5) { ctx.fillStyle = `rgba(239,230,210,${.9 - day})`; ctx.beginPath(); ctx.arc(W * .82, H * .2, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = lerp('#0a1a24', '#8fc3d9', day * mood); ctx.beginPath(); ctx.arc(W * .82 + 6, H * .2 - 4, 11, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = `rgba(255,236,170,${(day - .5) * 1.6})`; ctx.beginPath(); ctx.arc(W * .82, H * .2, 14, 0, Math.PI * 2); ctx.fill(); }
    // Trois serres côte à côte, chacune avec son panneau
    const st = this.state, plants = st ? st.garden.plants : [], goals = st && Array.isArray(st.goals) ? st.goals : null;
    const pulse = this.pulse ? Math.max(0, 1 - (t - this.pulse) / 900) : 0, last = plants[plants.length - 1];
    const gap = 6, sw = (W - gap * 4) / 3, top = H * .14, eave = H * .36, floor = H * .78, table = H * .56;
    ctx.fillStyle = lerp('#1c2a1e', '#6f7f5a', day * .6); ctx.fillRect(0, floor, W, H - floor);
    HOUSES2D.forEach((hs, hi) => {
      const x0 = gap + hi * (sw + gap), x1 = x0 + sw, xm = (x0 + x1) / 2;
      // vitrage et armature
      ctx.fillStyle = `rgba(200,230,220,${.05 + day * .05})`; ctx.beginPath(); ctx.moveTo(x0, floor); ctx.lineTo(x0, eave); ctx.lineTo(xm, top); ctx.lineTo(x1, eave); ctx.lineTo(x1, floor); ctx.fill();
      ctx.strokeStyle = `rgba(239,230,210,${.25 + day * .2})`; ctx.lineWidth = 1.5; ctx.stroke();
      for (let i = 1; i < 4; i++) { const x = x0 + i * sw / 4, y = eave - (1 - Math.abs(x - xm) / (sw / 2)) * (eave - top); ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x, y); ctx.stroke(); }
      // lanterne la nuit
      if (day < .7) {
        const fl = (0.85 + Math.sin(t / 300 + hi) * 0.05) * (1 - day) * (this.light === 'low' ? .7 : 1), ly = top + (eave - top) * .55;
        const lc = rgbMix('#f2b23d', hs.accent, .3); // lueur teintée par l'accent de la serre
        const lg = ctx.createRadialGradient(xm, ly, 2, xm, ly, sw * .6); lg.addColorStop(0, `rgba(${lc},${.45 * fl})`); lg.addColorStop(1, `rgba(${lc},0)`);
        ctx.fillStyle = lg; ctx.fillRect(x0, top, sw, floor - top);
        ctx.strokeStyle = 'rgba(239,230,210,.4)'; ctx.beginPath(); ctx.moveTo(xm, top); ctx.lineTo(xm, ly - 4); ctx.stroke();
        ctx.fillStyle = '#f2b23d'; ctx.beginPath(); ctx.arc(xm, ly, 4, 0, Math.PI * 2); ctx.fill();
      }
      // table
      ctx.fillStyle = lerp('#8a5a2b', '#b07a3f', day * .5); ctx.fillRect(x0 + 4, table, sw - 8, 6); ctx.fillStyle = '#4a2f14'; ctx.fillRect(x0 + 6, table + 6, 3, floor - table - 6); ctx.fillRect(x1 - 9, table + 6, 3, floor - table - 6);
      ctx.fillStyle = hs.accent; ctx.fillRect(x0 + 3, table - 1, sw - 6, 3); ctx.fillRect(x0 + 3, table + 2, sw - 6, 4); // chemin de table de la couleur de la serre
      // plantes de la serre : les plus récentes sur la table, puis au sol ; bonsaïs des objectifs actifs au sol ; mousse au pied
      const mine = plants.filter((p) => houseOf(p.cat) === hs.id);
      const pl = mine.filter((p) => p.kind !== 'moss' && p.kind !== 'bonsai' && !p.dormant), moss = mine.filter((p) => p.kind === 'moss');
      const bons = mine.filter((p) => p.kind === 'bonsai' && (!goals || !p.goal || (goals.find((g) => g.id === p.goal) || {}).status === 'active')).sort((a, b) => (b.branches || 0) - (a.branches || 0)).slice(0, 2);
      const per = Math.max(2, Math.floor((sw - 16) / 15)), onTable = pl.slice(-per), nFloor = Math.max(0, per - bons.length * 2), onFloor = nFloor ? pl.slice(-per * 2, -per).slice(-nFloor) : [];
      const draw = (p, x, y, kind) => { const r = rnd(p.seed), gr = (0.35 + 0.65 * growth(p, st, this.today)) * (p === last && pulse ? 1 + pulse * .15 : 1), c = COLS[lookOf(p)] || COLS.perso;
        if (kind === 'moss') mousse(ctx, x, y, gr, r, t, c); else if (kind === 'bonsai') bonsai(ctx, x, y, gr, r, t, c, p.branches || 0); else (GEN[lookOf(p)] || herbacee)(ctx, x, y, gr * .8, r, t, c); };
      ctx.save(); ctx.beginPath(); ctx.rect(x0, top, sw, H - top); ctx.clip();
      for (let i = 0; i < Math.min(moss.length, 4); i++) draw(moss[moss.length - 1 - i], x0 + 10 + i * (sw - 20) / 4, floor, 'moss');
      onTable.forEach((p, i) => draw(p, x0 + 10 + (i + .5) * (sw - 20) / per, table - 1, 'plant'));
      onFloor.forEach((p, i) => draw(p, x0 + 10 + (i + .5) * (sw - 20) / Math.max(1, onFloor.length), floor, 'plant'));
      bons.forEach((p, i) => draw(p, xm + (i ? -1 : 1) * (bons.length > 1 ? sw * .2 : 0), floor, 'bonsai'));
      ctx.restore();
      if (pl.length > per * 2) { ctx.fillStyle = 'rgba(239,230,210,.6)'; ctx.font = '10px system-ui'; ctx.textAlign = 'right'; ctx.fillText(`+${pl.length - per * 2}`, x1 - 4, table - 4); }
      // panneau
      ctx.font = 'italic 600 12px Georgia, "Times New Roman", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(hs.name).width + 14, py = floor + (H - floor) * .5;
      ctx.fillStyle = '#4a2f14'; ctx.fillRect(xm - 1.5, py, 3, H - py); ctx.fillStyle = hs.signBg; ctx.fillRect(xm - tw / 2, py - 9, tw, 18); ctx.strokeStyle = hs.accent; ctx.lineWidth = 1.5; ctx.strokeRect(xm - tw / 2 + 1, py - 8, tw - 2, 16);
      ctx.fillStyle = '#f1e8d2'; ctx.fillText(hs.name, xm, py + 1); ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    });
    // Arrosage
    if (pulse) { ctx.fillStyle = `rgba(143,211,244,${pulse * .8})`; for (let i = 0; i < 8; i++) ctx.fillRect(W * .5 + (i - 4) * 9 + Math.sin(i) * 3, H * .4 + (1 - pulse) * H * .35 + i * 3, 2, 5); }
    // Lucioles la nuit, brume le matin
    if (day < .6) for (let i = 0; i < 9; i++) { const x = 30 + ((i * 137 + t * 0.015 * (1 + i % 3)) % (W - 60)), y = H * .3 + Math.sin(t / 700 + i) * 20 + (i * 23) % (H * .3); ctx.fillStyle = `rgba(242,178,61,${(0.25 + 0.4 * Math.abs(Math.sin(t / 400 + i))) * (1 - day)})`; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
    if (h >= 6 && h < 10) { const fg = ctx.createLinearGradient(0, floor - 30, 0, H); fg.addColorStop(0, 'rgba(239,230,210,0)'); fg.addColorStop(1, 'rgba(239,230,210,.25)'); ctx.fillStyle = fg; ctx.fillRect(0, floor - 30, W, H); }
  }
}

function lerp(a, b, t) {
  const pa = hex(a), pb = hex(b), k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * k)},${Math.round(pa[1] + (pb[1] - pa[1]) * k)},${Math.round(pa[2] + (pb[2] - pa[2]) * k)})`;
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbMix = (a, b, t) => { const pa = hex(a), pb = hex(b); return pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(','); };
