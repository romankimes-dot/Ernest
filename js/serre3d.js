// Page de démonstration : les trois serres 3D (js/garden3d.js) avec des données fictives à quatre stades.
import G, { HOUSE_OF, HOUSE_IDS, SLOTS_PER_HOUSE } from './garden3d.js';

const CATS = ['travail', 'bienetre', 'perso'];
// Même forme que modelFromState : { houses: { travail, bienetre, perso }, shrooms, mood, path, beds, flowers }.
const BONSAI = [{}, { travail: [[77, 1]] }, { travail: [[77, 3]], bienetre: [[91, 2]] }, { travail: [[77, 6], [78, 3]], bienetre: [[91, 5]], perso: [[55, 4]] }];
function fake(stage) {
  const n = [3, 30, 100, 250][stage];
  const all = Array.from({ length: Math.min(n, 3 * SLOTS_PER_HOUSE) }, (_, i) => ({ id: 'd' + i, cat: CATS[(i * 7 + (i >> 2)) % 3], seed: 1000 + i * 7919, g: stage === 0 ? 0.3 : Math.min(1, 0.4 + (n - i) / 40) }));
  const houses = {};
  for (const id of HOUSE_IDS) {
    const plants = all.filter((p) => HOUSE_OF[p.cat] === id).slice(-SLOTS_PER_HOUSE), hn = Math.round(n * plants.length / Math.max(1, all.length));
    houses[id] = { n: hn, plants, moss: [0, 70, 260, 600][stage] * (plants.length ? 1 : 0), vine: Math.min(1, hn / 80), hanging: [8, 25, 50].filter((k) => hn >= k).length,
      bonsai: (BONSAI[stage][id] || []).map(([seed, branches]) => ({ seed, branches })) };
  }
  return { houses, shrooms: stage === 3, path: [0, 0.12, 0.4, 1][stage], beds: [[-1, -1, -1, -1, -1, -1], [0, -1, -1, 0, -1, -1], [0.5, 0.3, 0.1, 0.6, -1, 0.2], [1, 0.9, 0.8, 1, 0.7, 0.9]][stage], flowers: [0.3, 0.45, 0.65, 0.9][stage], mood: Number(document.getElementById('mood').value) };
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
  setMode: (m) => G.setMode(m), setLantern: (on) => G.setLantern(on), plantSeeds: (n) => G.plantSeeds(n), dropLeaf: () => G.dropLeaf(), restoreLeaf: () => G.restoreLeaf(), setAngle: (i) => G.setAngle(i), fake, api: G };
