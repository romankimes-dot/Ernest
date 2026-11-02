// Persistance locale (localStorage), sauvegardes de secours, export/import JSON.
// Rien n'est jamais écrasé sans copie : texte illisible conservé, sauvegarde automatique (au plus une toutes
// les 3 h), état précédent gardé avant un import ou un effacement. Repris de Dec-Deonto.
const KEY = 'ernest.state.v1';
const BACKUP_KEY = 'ernest.state.backup';
const BACKUP_T_KEY = 'ernest.state.backup.t';
const PREV_KEY = 'ernest.state.prev';
const CORRUPT_KEY = 'ernest.state.corrupt';
const BACKUP_EVERY_MS = 3 * 60 * 60 * 1000;

export const defaultState = () => ({
  version: 1,
  settings: {
    ritualHour: 18, bedtime: '22:30', minimums: { corps: 4, esprit: 3 },
    exam: '2026-11-10', examLabel: 'Épreuve 1', prenom: 'Roman', garden3d: true, trackTime: true, minimumsFrom: '2026-11-11',
  },
  days: {},     // 'YYYY-MM-DD' -> { things: [...], journal, mood, planned }
  list: [],     // { id, text, cat?, due?, done, at, doneAt }
  ideas: [],    // { id, text, at, status: 'inbox' | 'kept' | 'done' }
  goals: [],    // { id, title, cat, due?, horizon, milestones: [{ text, done }], status, reviews: { week: 'avance'|'stable'|'revoir' } }
  series: [],   // { id, title, cat, est, slot, days: [0..6], start, active }
  seriesMade: {}, // 'serieId|YYYY-MM-DD' -> 1 (déjà placée ce jour-là)
  weeks: {},    // 'YYYY-Www' -> { reviewedAt, note }
  garden: { plants: [], objects: [] }, // plants : { id, cat, day, seed, kind }
  cards: { seen: {}, feuilleton: 0, lastLong: null, log: [] }, // log : [{ id, at, ctx }]
  ernest: { lastOpen: null, said: {}, firstSeq: 0, lastGreetDay: null, lastGreetCtx: null },
  bridges: {},  // src -> { last, days: { day: [titles] } }
  milestones: {}, // id -> date
  lastExportAt: 0,
});

const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const del = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function hydrate(s) {
  const d = defaultState();
  return {
    ...d, ...s,
    settings: { ...d.settings, ...(isObj(s.settings) ? s.settings : {}), minimums: { ...d.settings.minimums, ...((s.settings || {}).minimums || {}) } },
    days: isObj(s.days) ? s.days : {},
    list: Array.isArray(s.list) ? s.list : [], series: Array.isArray(s.series) ? s.series : [], seriesMade: isObj(s.seriesMade) ? s.seriesMade : {}, ideas: Array.isArray(s.ideas) ? s.ideas : [], goals: Array.isArray(s.goals) ? s.goals : [],
    weeks: isObj(s.weeks) ? s.weeks : {},
    garden: { plants: [], objects: [], ...(isObj(s.garden) ? s.garden : {}) },
    cards: { ...d.cards, ...(isObj(s.cards) ? s.cards : {}) },
    ernest: { ...d.ernest, ...(isObj(s.ernest) ? s.ernest : {}) },
    bridges: isObj(s.bridges) ? s.bridges : {}, milestones: isObj(s.milestones) ? s.milestones : {},
  };
}

function parseState(raw) {
  try { const s = JSON.parse(raw); return isObj(s) && isObj(s.days) ? s : null; } catch { return null; }
}

export const notices = [];

export function load() {
  const raw = get(KEY);
  if (raw) {
    const s = parseState(raw);
    if (s) return hydrate(s);
    set(CORRUPT_KEY, raw);
    notices.push({ type: 'corrupt' });
  }
  const bak = parseState(get(BACKUP_KEY) || '');
  if (bak) { notices.push({ type: 'restored', at: Number(get(BACKUP_T_KEY)) || 0 }); return hydrate(bak); }
  return defaultState();
}

export function save(state) {
  try {
    const now = Date.now();
    const prevRaw = get(KEY);
    if (prevRaw && now - (Number(get(BACKUP_T_KEY)) || 0) > BACKUP_EVERY_MS && parseState(prevRaw)) {
      set(BACKUP_KEY, prevRaw); set(BACKUP_T_KEY, String(now));
    }
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}

export function snapshotPrev(state) { return set(PREV_KEY, JSON.stringify({ t: Date.now(), state })); }
export function restorePrev() {
  try { const p = JSON.parse(get(PREV_KEY)); return p && isObj(p.state) && isObj(p.state.days) ? hydrate(p.state) : null; } catch { return null; }
}
export function reset(state) {
  if (state) snapshotPrev(state);
  del(KEY); del(BACKUP_KEY); del(BACKUP_T_KEY);
  return defaultState();
}

export function exportJSON(state) { return JSON.stringify({ app: 'ernest', exportedAt: new Date().toISOString(), state }, null, 1); }
export function importJSON(text) {
  try {
    const o = JSON.parse(text);
    const s = o && isObj(o.state) ? o.state : o;
    return isObj(s) && isObj(s.days) ? hydrate(s) : null;
  } catch { return null; }
}
