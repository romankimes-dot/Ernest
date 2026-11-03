// Page de la maquette : curseur de progression, heure, catalogue (js/botaniste3d.js).
import { mount, setProgress, setTime, stats, events, SPECIES, DECORS, STAGES, stageOf } from './botaniste3d.js';

const $ = (id) => document.getElementById(id);
const canvas = document.createElement('canvas'); document.body.prepend(canvas);
const G = mount(canvas, { progress: 0.5, onFps: (v) => { $('fps').textContent = `${v} i/s`; } });
$('loading').remove();

const WHEN = [[0, 'Vide'], [0.04, 'Premiers jours'], [0.15, 'Un mois'], [0.3, 'Trois mois'], [0.5, 'Six mois'], [0.72, 'Neuf mois'], [0.92, 'Un an'], [1, 'Accomplie']];
const whenOf = (p) => WHEN.filter(([k]) => p >= k).pop()[1];
let P = 0.5, raf = 0;
function show() {
  const s = stats(P); $('when').textContent = whenOf(P);
  $('stat').textContent = `${s.species} espèce${s.species > 1 ? "s" : ""} sur ${SPECIES.length} · ${s.ground} en pleine terre · ${s.decors} décor${s.decors > 1 ? "s" : ""}`;
}
$('p').addEventListener('input', (e) => {
  const p = Number(e.target.value) / 1000, ev = events(P, p); P = p;
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; setProgress(P); show(); });
  for (const t of ev.slice(-3)) toast(t);
});
function toast(t) { const d = document.createElement('div'); d.textContent = t; $('toast').append(d); setTimeout(() => d.remove(), 3800); while ($('toast').children.length > 3) $('toast').firstChild.remove(); }

const pick = (k) => { document.querySelectorAll('#time button').forEach((x) => x.classList.toggle('on', x.dataset.t === k)); setTime(k); };
document.querySelectorAll('#time button').forEach((b) => b.addEventListener('click', () => pick(b.dataset.t)));
{ const h = new Date().getHours(); pick(h >= 8 && h < 18 ? 'day' : h >= 18 && h < 21 ? 'dusk' : 'night'); }

// Silhouettes du catalogue, une par type d'emplacement.
const SIL = {
  'Massif': '<path d="M20 62c4-18 12-26 20-30M40 62c0-16 2-28 0-40M60 62c-2-16-10-24-18-28M30 62c2-10 6-16 10-18M50 62c-1-10-4-15-9-18"/><circle cx="40" cy="22" r="3"/><circle cx="22" cy="34" r="2.5"/><circle cx="58" cy="32" r="2.5"/>',
  'Rocaille': '<path d="M40 60C38 44 30 30 22 22M40 60c2-16 10-30 18-38M40 60c0-18 0-30 0-44M40 60C34 50 24 44 14 42M40 60c6-10 16-16 26-18"/><path d="M14 62h52"/>',
  'Géante': '<path d="M40 64V30"/><path d="M40 34c-14-12-26-8-30 4 10 2 20 0 30-4zM40 30c10-14 24-14 30-4-10 4-20 6-30 4zM40 42c-12 0-20 6-22 14 10 0 18-4 22-14zM40 40c12-2 22 4 24 12-10 2-18-2-24-12z"/>',
  'Liane': '<path d="M22 64C22 40 30 20 58 12"/><path d="M26 50c-8-2-12 2-12 8 6 0 10-2 12-8zM30 38c8-4 14-2 16 4-6 2-12 2-16-4zM38 26c-6-6-12-6-14 0 6 2 10 2 14 0zM48 18c6-6 12-6 14-2-4 4-10 4-14 2z"/>',
  'Tombante': '<path d="M24 14h32l-4 12H28z"/><path d="M30 26c-2 12-4 24-2 36M40 26c0 12 0 24 2 34M50 26c2 10 4 20 2 30"/><circle cx="28" cy="44" r="2.5"/><circle cx="42" cy="52" r="2.5"/><circle cx="52" cy="40" r="2.5"/>',
};
function book() {
  const s = stats(P);
  const cards = SPECIES.map((sp) => {
    const open = P >= sp.u, w = s.best[sp.id] || 0, st = stageOf(w);
    return `<div class="card${open ? '' : ' locked'}"><svg viewBox="0 0 80 70" fill="${open ? 'none' : '#6b604c'}" stroke="${open ? '#4f7a35' : '#6b604c'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${SIL[sp.type]}</svg>
      <div class="t">${sp.type}</div><div class="n">${sp.nom}</div><div class="l">${sp.latin}</div>
      ${open ? `<div class="dots">${STAGES.map((_, i) => `<i class="${i <= st ? 'on' : ''}"></i>`).join('')}</div><div class="s">${st < 0 ? 'Pas encore semée' : STAGES[st][0]}${w ? ` · ${w} arrosage${w > 1 ? 's' : ''}` : ''}</div>` : `<div class="s">Se débloque : ${sp.debloque}</div>`}
      ${sp.rare ? `<div class="rare">${sp.rare}</div>` : ''}</div>`;
  }).join('');
  const decos = DECORS.map((d) => `<div class="deco">${d.nom}<span>${P >= d.u ? 'Dans la serre' : `${d.prix} graines`}</span></div>`).join('');
  $('book').innerHTML = `<button class="close" id="close">Fermer</button><h2>Le livre d'Ernest</h2><p class="sub">Collection Bien-être · ${s.species} espèces sur ${SPECIES.length}</p>
    <h3>Catalogue</h3><div class="grid">${cards}</div><h3>Décors à troquer</h3>${decos}`;
  $('close').onclick = () => $('sheet').classList.remove('on');
}
$('open').onclick = () => { book(); $('sheet').classList.add('on'); };
$('sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') $('sheet').classList.remove('on'); });
show();
window.__bot = { set: (p) => { P = p; $('p').value = p * 1000; setProgress(p); show(); }, setTime: pick, G };
