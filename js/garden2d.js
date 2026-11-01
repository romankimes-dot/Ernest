// La serre en 2D (canvas) : rangs par catégorie, plantes procédurales par graine, croissance par jours actifs,
// cycle jour/nuit sur l'heure réelle, lumière réglée par l'humeur. Repli et base de la version 3D.
import { CATS, growth } from './model.js';

const ROWS = { revision: 0, corps: 1, esprit: 2, cuisine: 3, boulot: 4, perso: 5 };
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
const GEN = { esprit: fougere, corps: succulente, revision: herbacee, cuisine: aromatique, boulot: herbacee, perso: aromatique };
const COLS = {
  revision: { leaf: '#7aa35e', dark: '#4c7a45', flower: '#e9c6e0' }, corps: { leaf: '#8fc98f', dark: '#3f8a5c', flower: '#f2b23d' },
  esprit: { leaf: '#5fae6d', dark: '#2f6b48', flower: '#6fb3c9' }, cuisine: { leaf: '#9cc46a', dark: '#5c8a3a', flower: '#f2b23d' },
  boulot: { leaf: '#b8c48a', dark: '#6c7a4a', flower: '#efe6d2' }, perso: { leaf: '#a9b5a3', dark: '#6b7a66', flower: '#f0a0a0' },
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
    // Lune ou soleil
    if (day < .5) { ctx.fillStyle = `rgba(239,230,210,${.9 - day})`; ctx.beginPath(); ctx.arc(W * .82, H * .2, 12, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = lerp('#0a1a24', '#8fc3d9', day * mood); ctx.beginPath(); ctx.arc(W * .82 + 6, H * .2 - 4, 11, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = `rgba(255,236,170,${(day - .5) * 1.6})`; ctx.beginPath(); ctx.arc(W * .82, H * .2, 14, 0, Math.PI * 2); ctx.fill(); }
    // Armature
    ctx.strokeStyle = `rgba(239,230,210,${.12 + day * .15})`; ctx.lineWidth = 1.5;
    const top = H * .12, floor = H * .74;
    ctx.beginPath(); ctx.moveTo(10, floor); ctx.lineTo(10, H * .35); ctx.lineTo(W / 2, top); ctx.lineTo(W - 10, H * .35); ctx.lineTo(W - 10, floor); ctx.stroke();
    for (let i = 1; i < 6; i++) { const x = 10 + i * (W - 20) / 6; const y = x < W / 2 ? H * .35 - (x - 10) / (W / 2 - 10) * (H * .35 - top) : H * .35 - (W - 10 - x) / (W / 2 - 10) * (H * .35 - top); ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x, y); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(10, H * .5); ctx.lineTo(W - 10, H * .5); ctx.stroke();
    // Lanterne la nuit
    if (day < .7) {
      const fl = (0.85 + Math.sin(t / 300) * 0.05) * (1 - day) * (this.light === 'low' ? .7 : 1);
      const lg = ctx.createRadialGradient(W / 2, H * .3, 2, W / 2, H * .3, W * .45); lg.addColorStop(0, `rgba(242,178,61,${.5 * fl})`); lg.addColorStop(1, 'rgba(242,178,61,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(239,230,210,.4)'; ctx.beginPath(); ctx.moveTo(W / 2, top); ctx.lineTo(W / 2, H * .28); ctx.stroke();
      ctx.fillStyle = '#f2b23d'; ctx.beginPath(); ctx.arc(W / 2, H * .3, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Sol, bacs : 2 étagères × 3 rangs
    ctx.fillStyle = lerp('#1c2a1e', '#6f7f5a', day * .6); ctx.fillRect(0, floor, W, H - floor);
    const rows = [H * .52, floor + 2];
    for (const ry of rows) { ctx.fillStyle = lerp('#8a5a2b', '#b07a3f', day * .5); ctx.fillRect(16, ry - 2, W - 32, 9); ctx.fillStyle = '#4a2f14'; ctx.fillRect(16, ry + 7, W - 32, 4); }
    // Plantes
    const st = this.state; if (!st) return;
    const plants = st.garden.plants;
    const byRow = {}; for (const p of plants) (byRow[ROWS[p.cat] ?? 5] = byRow[ROWS[p.cat] ?? 5] || []).push(p);
    const pulse = this.pulse ? Math.max(0, 1 - (t - this.pulse) / 900) : 0;
    for (let row = 0; row < 6; row++) {
      const list = byRow[row] || []; if (!list.length) continue;
      const usable = row < 3 ? W - 48 : W - 140, ry = rows[row < 3 ? 0 : 1] - 2, x0 = 24 + (row % 3) * usable / 3, span = usable / 3 - 8;
      const n = Math.min(list.length, 14);
      for (let i = 0; i < n; i++) {
        const p = list[list.length - n + i], r = rnd(p.seed), x = x0 + 6 + (i + .5) * span / n + (r() - .5) * 6;
        const gr = (0.35 + 0.65 * growth(p, st, this.today)) * (p === plants[plants.length - 1] && pulse ? 1 + pulse * .15 : 1);
        const col = COLS[p.cat] || COLS.perso;
        if (p.kind === 'moss') mousse(this.ctx, x, ry, gr, r, t, col);
        else if (p.kind === 'bonsai') bonsai(this.ctx, x, ry, gr, r, t, col, p.branches || 0);
        else (GEN[p.cat] || herbacee)(this.ctx, x, ry, gr, r, t, col);
      }
      if (list.length > n) { ctx.fillStyle = 'rgba(239,230,210,.5)'; ctx.font = '10px system-ui'; ctx.fillText(`+${list.length - n}`, x0 + span - 14, ry - 4); }
    }
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
export const CAT_ROWS = ROWS;
