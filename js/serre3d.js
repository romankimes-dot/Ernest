// Page de démonstration : la serre 3D (js/garden3d.js) avec des données fictives à quatre stades.
import G from './garden3d.js';

const CATS = ['revision', 'corps', 'esprit', 'cuisine', 'boulot', 'perso'];
function fake(stage) {
  const n = [3, 30, 100, 250][stage];
  const plants = Array.from({ length: Math.min(n, 54) }, (_, i) => ({ id: 'd' + i, cat: CATS[(i * 7 + (i >> 2)) % 6], seed: 1000 + i * 7919, g: stage === 0 ? 0.3 : Math.min(1, 0.4 + (n - i) / 40) }));
  return { plants, moss: [0, 220, 700, 1400][stage], vine: Math.min(1, n / 160), hanging: [20, 45, 80, 120].filter((k) => n >= k).length, bonsai: stage ? { seed: 77, branches: [0, 1, 3, 6][stage] } : null, shrooms: stage === 3, path: [0, 0.12, 0.4, 1][stage], beds: [[-1, -1, -1, -1, -1, -1], [0, -1, -1, 0, -1, -1], [0.5, 0.3, 0.1, 0.6, -1, 0.2], [1, 0.9, 0.8, 1, 0.7, 0.9]][stage], flowers: [0.3, 0.45, 0.65, 0.9][stage], serre2: stage === 3, mood: Number(document.getElementById('mood').value) };
}
let stage = 2;
const fps = document.getElementById('fps');
const canvas = document.createElement('canvas'); document.body.prepend(canvas);
G.mount(canvas, { mode: 'full', onFps: (v) => { fps.textContent = `${v} i/s`; } });
const apply = () => G.setModel(fake(stage));
document.querySelectorAll('#stages button').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('#stages button').forEach((x) => x.classList.toggle('on', x === b)); stage = Number(b.dataset.s); apply(); }));
document.querySelectorAll('#time button').forEach((b) => b.addEventListener('click', () => { document.querySelectorAll('#time button').forEach((x) => x.classList.toggle('on', x === b)); G.setTime(b.dataset.t); }));
document.getElementById('mood').addEventListener('input', apply);
{ const h = new Date().getHours(); const k = h >= 8 && h < 18 ? 'day' : h >= 18 && h < 21 ? 'dusk' : 'night'; document.querySelectorAll('#time button').forEach((x) => x.classList.toggle('on', x.dataset.t === k)); G.setTime(k); }
apply();
document.getElementById('loading').remove();
window.__serre = { applyStage: (s) => { stage = s; apply(); }, applyTime: (k) => G.setTime(k), get camera() { return G.camera; }, get controls() { return G.controls; },
  setMode: (m) => G.setMode(m), setLantern: (on) => G.setLantern(on), plantSeeds: (n) => G.plantSeeds(n), dropLeaf: () => G.dropLeaf(), restoreLeaf: () => G.restoreLeaf(), api: G };
