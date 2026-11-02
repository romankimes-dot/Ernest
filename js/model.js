// Fonctions pures : dates, semaines, estimations, comptes, choix des répliques et des cartes.
// Aucune dépendance au DOM ni au stockage ; testées dans tests/model.test.js.

export const CATS = [
  { id: 'revision', nom: 'Révision', couleur: '#f2b23d' },
  { id: 'corps', nom: 'Corps', couleur: '#5fae6d' },
  { id: 'esprit', nom: 'Esprit', couleur: '#6fb3c9' },
  { id: 'cuisine', nom: 'Cuisine', couleur: '#c7772a' },
  { id: 'boulot', nom: 'Boulot', couleur: '#efe6d2' },
  { id: 'perso', nom: 'Perso', couleur: '#a9b5a3' },
];
export const catOf = (id) => CATS.find((c) => c.id === id) || CATS[5];

const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (k, n) => { const d = parseDay(k); d.setDate(d.getDate() + n); return dayKey(d); };
export const diffDays = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);
export const dow = (k) => parseDay(k).getDay(); // 0 = dimanche

// Semaine ISO : clé "2026-W45" et ses 7 jours (lundi → dimanche).
export function isoWeek(k) {
  const d = parseDay(k);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${pad(w)}`;
}
export function weekDays(k) {
  const d = dow(k); const monday = addDays(k, d === 0 ? -6 : 1 - d);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// Jour : accès sûr.
export const dayOf = (state, k) => state.days[k] || { things: [], journal: '', mood: null, planned: false };
export function ensureDay(state, k) {
  if (!state.days[k]) state.days[k] = { things: [], journal: '', mood: null, planned: false };
  return state.days[k];
}

// Choses faites un jour (3 du jour + entrées de liste cochées ce jour).
export function doneOn(state, k) {
  const things = dayOf(state, k).things.filter((t) => t.done);
  const list = state.list.filter((l) => l.done && l.doneAt && l.doneAt.slice(0, 10) === k);
  return { things, list, n: things.length + list.length };
}
export const isActive = (state, k) => doneOn(state, k).n > 0;
export const activeDays = (state, days) => days.filter((k) => isActive(state, k)).length;
export const totalDone = (state) => Object.keys(state.days).reduce((a, k) => a + doneOn(state, k).n, 0);

// Comptes par catégorie sur une liste de jours : { cat: n }.
export function catCounts(state, days) {
  const out = {};
  for (const k of days) {
    const d = doneOn(state, k);
    for (const t of d.things) out[t.cat] = (out[t.cat] || 0) + 1;
    for (const l of d.list) if (l.cat) out[l.cat] = (out[l.cat] || 0) + 1;
  }
  return out;
}

// Estimation d'une catégorie : médiane des 10 dernières durées réelles, sinon défaut.
export function estimate(state, cat, dflt = 30) {
  const reals = [];
  for (const k of Object.keys(state.days).sort().reverse()) {
    for (const t of state.days[k].things) if (t.cat === cat && t.done && t.real > 0) reals.push(t.real);
    if (reals.length >= 10) break;
  }
  if (!reals.length) return dflt;
  const s = reals.slice(0, 10).sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)] / 5) * 5 || 5;
}

// Humeur moyenne des n derniers jours renseignés : 'low' | 'ok' | 'high' | null.
export function moodAvg(state, today, n = 3) {
  const vals = [];
  for (let i = 0; i < 7 && vals.length < n; i++) {
    const m = dayOf(state, addDays(today, -i)).mood;
    if (m !== null && m !== undefined) vals.push(m);
  }
  if (!vals.length) return null;
  const a = vals.reduce((x, y) => x + y, 0) / vals.length;
  return a < 1.5 ? 'low' : a > 2.6 ? 'high' : 'ok';
}
export const moodLabel = (m) => ['épuisé', 'bof', 'ça va', 'bien', 'lumineux'][m] || '';

export const jMinus = (exam, today) => (exam ? diffDays(today, exam.slice(0, 10)) : null);

// Minimums doux de la semaine : [{ cat, done, min }]
export function minimums(state, days) {
  const c = catCounts(state, days);
  return Object.entries(state.settings.minimums || {}).filter(([, v]) => v > 0).map(([cat, min]) => ({ cat, min, done: c[cat] || 0 }));
}

// Tri de la liste large : non faites d'abord, datées (plus proche en premier), puis par ancienneté.
export function sortList(list) {
  return [...list].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
    if (!!a.due !== !!b.due) return a.due ? -1 : 1;
    return (a.at || '') < (b.at || '') ? -1 : 1;
  });
}

// Prochaine échéance affichée : l'examen tant qu'il n'est pas passé, puis l'objectif daté le plus proche.
export function nextDeadline(state, today) {
  const ex = state.settings.exam && state.settings.exam.slice(0, 10);
  if (ex && ex >= today) return { date: ex, label: state.settings.examLabel || 'Examen' };
  const g = (state.goals || []).filter((x) => x.status === 'active' && x.due && x.due >= today).sort((a, b) => (a.due < b.due ? -1 : 1))[0];
  return g ? { date: g.due, label: g.title } : null;
}
// Veille et jour J de l'examen : des choses posées d'avance (une seule fois par jour).
export function examPrep(state, k) {
  const ex = state.settings.exam && state.settings.exam.slice(0, 10);
  if (!ex || (k !== ex && k !== addDays(ex, -1))) return false;
  const key = 'prep-' + k; state.milestones = state.milestones || {};
  if (state.milestones[key]) return false;
  const bed = (state.settings.bedtime || '22:30').replace(':', ' h '), L = state.settings.examLabel || "l'examen";
  const items = k === ex
    ? [[`${L} : partir tôt, convocation, pièce d'identité, eau, montre`, 'revision', 'matin'], ['Midi au calme, manger léger, ne pas refaire les sujets', 'corps', 'midi'], ['Soirée libre, sans bilan', 'perso', 'soir']]
    : [['Vérifier convocation, trajet et horaires', 'perso', 'matin'], ['Relecture légère, rien de nouveau', 'revision', 'aprem'], [`Écrans posés, coucher à ${bed}`, 'corps', 'soir']];
  const d = ensureDay(state, k);
  for (const [title, cat, slot] of items) if (!d.things.some((t) => t.title === title)) d.things.push({ id: uid(), title, cat, slot, est: 0, done: false, real: 0, prep: true });
  state.milestones[key] = true; return true;
}
// Suggestions pour « les 3 de demain » : liste datée pour demain ou passée, minimums non atteints, idées marquées.
export function suggestions(state, tomorrow) {
  const out = [];
  const placed = new Set();
  for (const k of [addDays(tomorrow, -1), tomorrow]) for (const t of dayOf(state, k).things) if (t.fromList && !t.done) placed.add(t.fromList);
  for (const l of sortList(state.list)) {
    if (l.done || placed.has(l.id)) continue;
    if (l.due && l.due <= tomorrow) out.push({ kind: 'list', id: l.id, title: l.text, cat: l.cat || 'perso', why: l.due < tomorrow ? 'date passée' : 'pour demain' });
  }
  const days = weekDays(tomorrow);
  const minsOn = !state.settings.minimumsFrom || tomorrow >= state.settings.minimumsFrom;
  // l'étape suivante de chaque objectif actif, l'échéance la plus proche d'abord
  const ex = state.settings.exam && state.settings.exam.slice(0, 10), beforeExam = !!ex && tomorrow <= ex; // avant l'examen : seulement les objectifs qui tombent avant lui
  const goals = (state.goals || []).filter((g) => g.status === 'active' && (!beforeExam || (g.due && g.due <= ex))).sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1);
  for (const g of goals) { const m = (g.milestones || []).find((x) => !x.done); if (m) out.push({ kind: 'goal', title: m.text, cat: g.cat || 'revision', why: g.title }); }
  for (const m of minsOn ? minimums(state, days) : []) {
    if (m.done < m.min) out.push({ kind: 'min', title: catOf(m.cat).nom, cat: m.cat, why: `${m.done} / ${m.min} cette semaine` });
  }
  if (!minsOn) out.push({ kind: 'walk', title: 'Marche de 20 minutes', cat: 'corps', why: 'facultatif, pour souffler' });
  return out.slice(0, 7);
}

// ---------- Ernest : choix d'une réplique ----------
// ctx : contexte ; env : { j, dow, mood, doneYesterday, hasIdea, firstWeek, month, n } ; said : { id: tStamp }
export function chooseLine(lines, ctx, env, said = {}) {
  const ok = lines.filter((l, i) => {
    if (l.ctx !== ctx) return false;
    const w = l.when || {};
    if (w.jmin !== undefined && (env.j === null || env.j < w.jmin)) return false;
    if (w.jmax !== undefined && (env.j === null || env.j > w.jmax)) return false;
    if (w.dow && !w.dow.includes(env.dow)) return false;
    if (w.mood && w.mood !== env.mood) return false;
    if (w.doneYesterday !== undefined && !!env.doneYesterday !== w.doneYesterday) return false;
    if (w.hasIdea && !env.hasIdea) return false;
    if (w.firstWeek && !env.firstWeek) return false;
    if (w.month && !w.month.includes(env.month)) return false;
    if (w.minN !== undefined && (env.n || 0) < w.minN) return false;
    if (l.seq !== undefined && l.seq !== env.seq) return false;
    l._i = i; return true;
  });
  if (!ok.length) return null;
  // Les moins récemment dites d'abord ; parmi elles, celles qui ont une condition (plus pertinentes) sont préférées.
  ok.sort((a, b) => ((said[a._i] || 0) - (said[b._i] || 0)) || ((b.when ? 1 : 0) - (a.when ? 1 : 0)));
  const pool = ok.slice(0, Math.max(1, Math.min(5, Math.ceil(ok.length / 3))));
  return pool[Math.floor(Math.random() * pool.length)];
}

export function fillLine(text, vars) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null && vars[k] !== '' ? vars[k] : m));
}

// Cartes : une carte jamais vue de la rareté voulue, familles pondérées ; null si tout est vu.
export function pickCard(cards, seen, rarete, families) {
  const pool = cards.filter((c) => c.rarete === rarete && (!families || families.includes(c.famille)) && !seen[c.id]);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Plantes : une par chose faite (kind 'plant'), une mousse par entrée de liste (kind 'moss').
export function growth(plant, state, today) {
  // Nombre de jours actifs depuis la plantation (jour inclus), plafonné à 7 : 0..1
  let n = 0;
  for (let i = 0; i <= 60; i++) {
    const k = addDays(plant.day, i);
    if (k > today) break;
    if (isActive(state, k)) n++;
    if (n >= 7) break;
  }
  return Math.min(1, n / 7);
}

// ---------- Séries : des choses qui reviennent certains jours ----------
// serie : { id, title, cat, est, slot, days: [0..6] (0 = dimanche), start, active }
export const DOW_SHORT = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
export function seriesDue(serie, k) { return !!serie.active && (!serie.start || k >= serie.start) && serie.days.includes(dow(k)); }
export function daysLabel(days) {
  const d = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (d.length === 7) return 'Chaque jour';
  if (d.length === 5 && [1, 2, 3, 4, 5].every((x) => d.includes(x))) return 'Du lundi au vendredi';
  if (d.length === 2 && d.includes(0) && d.includes(6)) return 'Le week-end';
  return d.map((x) => DOW_SHORT[x]).join(', ');
}
// Place les séries du jour k, une seule fois par jour : une occurrence supprimée ou déplacée ne revient pas.
export function materialize(state, k) {
  state.seriesMade = state.seriesMade || {}; let n = 0;
  for (const se of state.series || []) {
    const key = `${se.id}|${k}`;
    if (!seriesDue(se, k) || state.seriesMade[key]) continue;
    state.seriesMade[key] = 1;
    ensureDay(state, k).things.push({ id: uid(), title: se.title, cat: se.cat, est: se.est || null, slot: se.slot || null, done: false, real: 0, seriesId: se.id });
    n++;
  }
  return n;
}

// Temps mesuré (minutes) par catégorie sur des jours : choses faites (durée réelle) + temps en cours ou en pause.
export function timeByCat(state, days, now = Date.now()) {
  const out = {};
  for (const k of days) for (const t of dayOf(state, k).things) {
    const ms = t.done ? (t.real || 0) * 60000 : (t.spent || 0) + (t.startedAt ? now - t.startedAt : 0);
    if (ms > 0) out[t.cat] = (out[t.cat] || 0) + Math.round(ms / 60000);
  }
  return out;
}
export const fmtMin = (m) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`);
