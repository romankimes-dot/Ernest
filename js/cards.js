// Le carnet d'Ernest : chargement des familles de cartes, tirage, journal des cartes lues.
import { pickCard } from './model.js';

export const FAMILLES = [
  { id: 'botanique', nom: 'Botanique' }, { id: 'profession', nom: 'La profession' }, { id: 'tips', nom: 'À preuve' },
  { id: 'blagues', nom: 'Blagues' }, { id: 'encouragements', nom: 'Mots' }, { id: 'feuilleton', nom: "L'histoire d'Ernest" },
];
let CARDS = [];
export async function loadCards() {
  const all = await Promise.all(FAMILLES.map(async (f) => {
    try { const a = await (await fetch(`./data/cartes/${f.id}.json`)).json(); return a.map((c) => ({ ...c, famille: f.id })); } catch { return []; }
  }));
  CARDS = all.flat();
  return CARDS.length;
}
export const allCards = () => CARDS;
export const cardById = (id) => CARDS.find((c) => c.id === id);

// Carte courte (à une coche, une fois sur deux), carte longue (journée pleine), rare (jalon), épisode (dimanche).
export function drawShort(state) {
  if (Math.random() < 0.5) return null;
  return remember(state, pickCard(CARDS, state.cards.seen, 'courante', ['botanique', 'blagues', 'encouragements']), 'coche');
}
export function drawLong(state, today) {
  if (state.cards.lastLong === today) return null;
  const c = pickCard(CARDS, state.cards.seen, 'longue', ['profession', 'tips']);
  if (c) state.cards.lastLong = today;
  return remember(state, c, 'journee');
}
export function drawRare(state, ctx) { return remember(state, pickCard(CARDS, state.cards.seen, 'rare') || pickCard(CARDS, state.cards.seen, 'longue', ['profession', 'tips']), ctx); }
export function drawEpisode(state) {
  const ep = (state.cards.feuilleton || 0) + 1;
  const c = CARDS.find((x) => x.famille === 'feuilleton' && x.ep === ep);
  if (!c) return null;
  state.cards.feuilleton = ep;
  return remember(state, c, 'dimanche');
}
function remember(state, c, ctx) {
  if (!c) return null;
  state.cards.seen[c.id] = new Date().toISOString();
  state.cards.log.unshift({ id: c.id, at: new Date().toISOString(), ctx });
  if (state.cards.log.length > 2000) state.cards.log.length = 2000;
  return c;
}
