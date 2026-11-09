// Fonctions pures : dates, semaines, estimations, comptes, choix des répliques et des cartes.
// Aucune dépendance au DOM ni au stockage ; testées dans tests/model.test.js.
import { speciesById, growthOf } from './flore.js';

// Trois catégories, une par serre. Les anciennes (révision, corps…) sont converties à la lecture.
export const CATS = [
  { id: 'travail', nom: 'Travail', couleur: '#f2b23d' },
  { id: 'bienetre', nom: 'Bien-être', couleur: '#5fae6d' },
  { id: 'perso', nom: 'Vie perso', couleur: '#8fb3d9' },
];
export const OLD_CATS = { revision: 'travail', boulot: 'travail', corps: 'bienetre', esprit: 'bienetre', cuisine: 'bienetre', perso: 'perso' };
export const catId = (c) => (CATS.some((x) => x.id === c) ? c : OLD_CATS[c] || 'perso');
export const catOf = (id) => CATS.find((c) => c.id === catId(id));
// Végétaux de chaque serre : un mélange cohérent, choisi par la graine de la plante (le même partout : 3D, 2D, Ernest).
export const FLORA = {
  travail: [['ficus', 'le ficus'], ['broadleaf', 'le caoutchouc'], ['lavender', 'la lavande'], ['lavender', 'la lavande'], ['fern', 'la fougère']],
  bienetre: [['succulent', 'la plante grasse'], ['cactus', 'le cactus'], ['thyme', 'le thym'], ['basil', 'le basilic'], ['rosemary', 'le romarin'], ['mossy', 'la mousse']],
  perso: [['wildflowers', 'les fleurs des champs'], ['wildflowers', 'les fleurs des champs'], ['geranium', 'le géranium'], ['violet', 'la violette'], ['geranium', 'le géranium']],
};
// Plantes nouvelles (js/flore.js) : leur espèce donne le dessin et le nom.
export const floraOf = (p) => { if (p && p.v === 2 && p.sp) { const s = speciesById(p.sp); if (s) return [s.look, s.art]; } const l = FLORA[catId(p.cat)]; const h = Math.imul((p.seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0; return l[h % l.length]; };
// Convertit un état ancien (six catégories) vers les trois serres. Sans effet sur un état déjà converti.
export function migrateCats(state) {
  const fix = (o) => { if (o && o.cat !== undefined && o.cat !== null && !CATS.some((x) => x.id === o.cat)) o.cat = catId(o.cat); };
  const each = (a) => { if (Array.isArray(a)) a.forEach(fix); };
  if (state.days && typeof state.days === 'object') for (const d of Object.values(state.days)) each(d && d.things);
  for (const k of ['list', 'goals', 'series']) each(state[k]);
  each((state.garden || {}).plants);
  const m = (state.settings || {}).minimums;
  if (m && Object.keys(m).some((k) => !CATS.some((x) => x.id === k))) { const n = {}; for (const [k, v] of Object.entries(m)) { const c = catId(k); n[c] = Math.max(n[c] || 0, Number(v) || 0); } state.settings.minimums = n; }
  return state;
}

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
  const fromList = new Set(things.map((t) => t.fromList).filter(Boolean)); // une entrée de liste cochée via sa chose ne compte qu'une fois
  const list = state.list.filter((l) => l.done && l.doneAt && l.doneAt.slice(0, 10) === k && !fromList.has(l.id));
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
    for (const l of d.list) { const c = l.cat ? catId(l.cat) : 'perso'; out[c] = (out[c] || 0) + 1; } // la Liste (courses, colis…) : Vie perso par défaut
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
    ? [[`${L} : partir tôt, convocation, pièce d'identité, eau, montre`, 'travail', 'matin'], ['Midi au calme, manger léger, ne pas refaire les sujets', 'bienetre', 'midi'], ['Soirée libre, sans bilan', 'perso', 'soir']]
    : [['Vérifier convocation, trajet et horaires', 'perso', 'matin'], ['Relecture légère, rien de nouveau', 'travail', 'aprem'], [`Écrans posés, coucher à ${bed}`, 'bienetre', 'soir']];
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
  for (const g of goals) { const m = (g.milestones || []).find((x) => !x.done); if (m) out.push({ kind: 'goal', title: m.text, cat: catId(g.cat || 'travail'), why: g.title }); }
  for (const m of minsOn ? minimums(state, days) : []) {
    if (m.done < m.min) out.push({ kind: 'min', title: catOf(m.cat).nom, cat: m.cat, why: `${m.done} / ${m.min} cette semaine` });
  }
  for (const h of organize(state, tomorrow, { max: 4 }).filter((x) => x.kind === 'habit')) if (!out.some((o) => norm(o.title) === norm(h.title))) out.push({ kind: 'habit', title: h.title, cat: h.cat, why: 'ton habitude' });
  if (!minsOn) out.push({ kind: 'walk', title: 'Marche de 20 minutes', cat: 'bienetre', why: 'facultatif, pour souffler' });
  return out.slice(0, 7);
}

// Une petite chose pour l'équilibre des serres, proposée au rituel du soir : dans la catégorie Bien-être ou Vie perso
// la moins fournie des 7 derniers jours. D'abord ce que tu as déjà fait toi-même dans cette catégorie (3 semaines),
// puis une entrée de la Liste (pour Vie perso), puis des idées courtes. → [{ title, cat, est, slot, why }]
const SMALL = {
  bienetre: [['Marche de 20 minutes', 20, 'midi'], ['Étirements, 10 minutes', 10, 'soir'], ['10 minutes dehors, sans téléphone', 10, 'aprem'], ['Cuisiner un vrai repas', 40, 'soir'], ['Respirer 5 minutes, au calme', 5, 'aprem'], ['Séance de sport courte', 30, 'matin'], ['Écrans posés une heure avant le coucher', 0, 'soir']],
  perso: [['Appeler quelqu’un qui compte', 15, 'soir'], ['Ranger un coin, 15 minutes', 15, 'aprem'], ['Lire 20 pages pour le plaisir', 20, 'soir'], ['Envoyer un message à un ami', 5, 'midi'], ['Préparer ses affaires pour le lendemain', 10, 'soir'], ['Une sortie, même courte', 45, 'aprem']],
};
export function smallProposals(state, tomorrow) {
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(tomorrow, -1 - i)), c = catCounts(state, last7);
  const be = c.bienetre || 0, pe = c.perso || 0;
  const order = be < pe ? ['bienetre', 'perso'] : pe < be ? ['perso', 'bienetre'] : (Number(tomorrow.slice(-2)) % 2 ? ['bienetre', 'perso'] : ['perso', 'bienetre']);
  const taken = new Set([addDays(tomorrow, -1), tomorrow].flatMap((k) => dayOf(state, k).things.map((t) => norm(t.title))));
  const out = [], seen = new Set();
  const add = (o) => { const k = norm(o.title); if (!o.title || taken.has(k) || seen.has(k)) return; seen.add(k); out.push(o); };
  for (const cat of order) {
    const why = `${catOf(cat).nom} : ${c[cat] || 0} cette semaine`;
    const mine = {};
    for (const k of Array.from({ length: 21 }, (_, i) => addDays(tomorrow, -1 - i))) for (const t of dayOf(state, k).things) if (t.done && catId(t.cat) === cat && !t.src) mine[t.title] = (mine[t.title] || 0) + 1;
    Object.entries(mine).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([title]) => add({ title, cat, est: estimate(state, cat, 20), slot: null, why: `${why} · tu l’as déjà fait` }));
    if (cat === 'perso') sortList(state.list).filter((l) => !l.done && !l.due && (!l.cat || catId(l.cat) === 'perso')).slice(0, 2).forEach((l) => add({ title: l.text, cat, est: 15, slot: null, why: `${why} · dans ta Liste`, fromList: l.id }));
    const pool = SMALL[cat], off = Number(tomorrow.replace(/-/g, '')) % pool.length;
    for (let i = 0; i < pool.length; i++) { const [title, est, slot] = pool[(i + off) % pool.length]; add({ title, cat, est, slot, why }); }
  }
  return out;
}

// ---------- Cases du jour (serres Bien-être et Vie perso) ----------
// Rien à poser d'avance : une grille de gestes, cochés quand ils sont faits. Une case cochée est une chose faite du jour
// marquée tick (elle compte partout comme les autres), mais elle ne fait pas partie des choses posées.
export const isTick = (t) => !!(t && t.tick);
export const planned = (d) => d.things.filter((t) => !t.tick);
export const TICKS = {
  bienetre: ['Marche', 'Sport', 'Étirements', 'Cuisiner un vrai repas', 'Dehors, sans téléphone', 'Respirer au calme', 'Bien dormi', 'Écrans posés tôt', 'Méditation', 'Bu assez d’eau'],
  perso: ['Appeler quelqu’un', 'Message à un ami', 'Lire pour le plaisir', 'Ranger un coin', 'Une sortie', 'Ménage', 'Lessive', 'Courses', 'Papiers', 'Préparer demain'],
};
export const tickPrefs = (state) => {
  const t = (state.ticks = state.ticks && typeof state.ticks === 'object' ? state.ticks : {});
  for (const k of ['custom', 'hidden']) { t[k] = t[k] && typeof t[k] === 'object' ? t[k] : {}; for (const h of ['bienetre', 'perso']) if (!Array.isArray(t[k][h])) t[k][h] = []; }
  return t;
};
// → [{ title, on, id }] : cochées aujourd'hui, puis les plus faites des 30 derniers jours, puis les tiennes, puis celles d'Ernest.
export function tickGrid(state, house, today, max = 12) {
  const p = tickPrefs(state), hidden = new Set(p.hidden[house].map(norm)), out = [], seen = new Set();
  const add = (title, on = null) => { const k = norm(title); if (!title || seen.has(k) || (hidden.has(k) && !on)) return; seen.add(k); out.push({ title, on: on ? on.id : null }); };
  for (const t of dayOf(state, today).things) if (t.tick && catId(t.cat) === house) add(t.title, t);
  const n = {}; for (let i = 1; i <= 30; i++) for (const t of dayOf(state, addDays(today, -i)).things) if (t.done && !t.src && catId(t.cat) === house) n[t.title] = (n[t.title] || 0) + 1;
  Object.entries(n).filter(([, k]) => k > 1).sort((a, b) => b[1] - a[1]).forEach(([title]) => add(title));
  p.custom[house].forEach((title) => add(title));
  TICKS[house].forEach((title) => add(title));
  return out.slice(0, Math.max(max, out.filter((x) => x.on).length));
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
    if (w.three && !env.three) return false; // « Trois » seulement si la journée comptait trois choses
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
  const out = text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null && vars[k] !== '' ? vars[k] : m));
  const el = out.replace(/\b([Dd])e le\b/g, '$1u').replace(/\b([Dd])e les\b/g, '$1es').replace(/(^|[\s«(])([Àà]) le\b/g, (m, p, x) => p + (x === 'À' ? 'Au' : 'au')).replace(/(^|[\s«(])([Àà]) les\b/g, (m, p, x) => p + (x === 'À' ? 'Aux' : 'aux')); // « de le thym » → « du thym »
  return el.replace(/(^|[.!?…]\s+)([a-zà-ÿ])/g, (m, a, c) => a + c.toUpperCase()); // majuscule en début de phrase (« Coché. Le cactus »)
}

// Cartes : une carte jamais vue de la rareté voulue, familles pondérées ; null si tout est vu.
export function pickCard(cards, seen, rarete, families) {
  const pool = cards.filter((c) => c.rarete === rarete && (!families || families.includes(c.famille)) && !seen[c.id]);
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Plantes : une par chose faite (kind 'plant'), une mousse par entrée de liste (kind 'moss').
export function growth(plant, state, today) {
  if (plant && plant.v === 2) return growthOf(plant);
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

// Moments de la journée et heure à laquelle chacun se termine.
const SLOT_END = { matin: 12, midi: 14, aprem: 18, soir: 24 };
export const slotAt = (hour) => (hour < 12 ? 'matin' : hour < 14 ? 'midi' : hour < 18 ? 'aprem' : 'soir');
// Choses posées par un pont (slotAuto) et pas encore faites : un moment passé glisse vers le moment en cours.
// Un moment choisi à la main n'a pas slotAuto : jamais déplacé. Retourne le nombre de choses déplacées.
export function reslot(state, day, hour) {
  const d = state.days[day]; if (!d) return 0;
  const now = slotAt(hour); let n = 0;
  for (const t of d.things) if (t.slotAuto && !t.done && t.slot && SLOT_END[t.slot] <= hour) { t.slot = now; n++; }
  return n;
}

// ---------- Ernest organisateur : ce qu'il observe sur les 3 dernières semaines ----------
// Renvoie au plus `max` propositions { id, kind, text, act, ... } pour le jour k. Rien n'est imposé : chaque ligne se prend ou se laisse.
const norm = (s) => String(s || '').trim().toLowerCase();
const slotOfHour = (h) => (h < 12 ? 'matin' : h < 14 ? 'midi' : h < 18 ? 'aprem' : 'soir');
const SLOT_FR = { matin: 'le matin', midi: 'à midi', aprem: "l'après-midi", soir: 'le soir' };
const DOW_FR = ['le dimanche', 'le lundi', 'le mardi', 'le mercredi', 'le jeudi', 'le vendredi', 'le samedi'];
export function observe(state, k, days = 21) {
  const seen = new Map(); // titre -> { title, cat, n, dows, slots, mins }
  for (let i = 1; i <= days; i++) {
    const dk = addDays(k, -i);
    for (const t of dayOf(state, dk).things) {
      if (!t.done || t.prep) continue;
      const key = norm(t.title); let o = seen.get(key);
      if (!o) { o = { title: t.title, cat: t.cat, n: 0, dows: {}, slots: {}, mins: [], last: dk, series: !!t.seriesId }; seen.set(key, o); }
      o.n++; o.dows[dow(dk)] = (o.dows[dow(dk)] || 0) + 1;
      const h = t.doneAt && t.doneAt.length > 13 ? new Date(t.doneAt).getHours() : null; // heure locale (doneAt est en UTC)
      const sl = t.slot || (h !== null && !Number.isNaN(h) ? slotOfHour(h) : null); if (sl) o.slots[sl] = (o.slots[sl] || 0) + 1;
      const m = t.spent ? Math.round(t.spent / 60000) : t.real || 0; if (m >= 5) o.mins.push(m);
      if (t.seriesId) o.series = true;
    }
  }
  return [...seen.values()];
}
const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1])[0] || null;
export function organize(state, k, { max = 3, dismissed = {} } = {}) {
  const out = [], obs = observe(state, k), d = dayOf(state, k), here = new Set(d.things.map((t) => norm(t.title)));
  const inSeries = new Set((state.series || []).filter((s) => s.active).map((s) => norm(s.title)));
  const wd = dow(k);
  // 1. habitude du jour de la semaine : fait au moins 2 fois ce jour-là, pas encore posé aujourd'hui
  for (const o of obs) {
    if (here.has(norm(o.title)) || inSeries.has(norm(o.title))) continue;
    if ((o.dows[wd] || 0) >= 2) { const sl = top(o.slots); out.push({ id: `hab:${norm(o.title)}:${k}`, kind: 'habit', title: o.title, cat: o.cat, slot: sl ? sl[0] : null, text: `Tu fais souvent « ${o.title} » ${DOW_FR[wd]}${sl ? `, plutôt ${SLOT_FR[sl[0]]}` : ''}. Je le pose ?`, yes: 'Le poser' }); }
  }
  // 2. répétition sans série : 3 fois ou plus en 2 semaines
  for (const o of obs) {
    if (o.series || inSeries.has(norm(o.title)) || o.n < 3) continue;
    const ds = Object.keys(o.dows).map(Number).sort();
    out.push({ id: `ser:${norm(o.title)}`, kind: 'series', title: o.title, cat: o.cat, slot: (top(o.slots) || [null])[0], days: ds, text: `« ${o.title} » revient souvent (${o.n} fois en 3 semaines). On en fait une série ?`, yes: 'Créer la série' });
  }
  // 3. moment habituel : une chose du jour sans moment, alors que sa catégorie a un moment net
  const catSlots = {}; for (const o of obs) for (const [s, n] of Object.entries(o.slots)) { catSlots[o.cat] = catSlots[o.cat] || {}; catSlots[o.cat][s] = (catSlots[o.cat][s] || 0) + n; }
  for (const t of d.things) {
    if (t.done || t.slot || !catSlots[t.cat]) continue; const tot = Object.values(catSlots[t.cat]).reduce((a, b) => a + b, 0), best = top(catSlots[t.cat]);
    if (tot >= 3 && best[1] / tot >= 0.6) out.push({ id: `slot:${t.id}`, kind: 'slot', thing: t.id, slot: best[0], text: `« ${t.title} » : ${catOf(t.cat).nom.toLowerCase()}, tu la fais surtout ${SLOT_FR[best[0]]}. Je la range là ?`, yes: 'Ranger' });
  }
  // 4. charge : plus de 5 choses à faire
  const open = d.things.filter((t) => !t.done && !t.prep);
  if (open.length > 5) out.push({ id: `load:${k}`, kind: 'load', keep: 3, text: `${open.length} choses aujourd'hui, c'est beaucoup. On garde les 3 premières et je décale le reste à demain ?`, yes: 'Alléger' });
  // 5. durée réelle : une chose du jour qui prend nettement plus que prévu d'habitude
  for (const t of open) { const o = obs.find((x) => norm(x.title) === norm(t.title)); if (!o || o.mins.length < 2) continue; const avg = Math.round(o.mins.reduce((a, b) => a + b, 0) / o.mins.length); if (avg >= 30) out.push({ id: `dur:${t.id}`, kind: 'info', text: `« ${t.title} » te prend en moyenne ${avg >= 60 ? `${Math.floor(avg / 60)} h ${String(avg % 60).padStart(2, '0')}` : `${avg} min`}. Prévois de la place.`, yes: 'Noté' }); }
  // 6. équilibre (minimums actifs) : une catégorie avec minimum, rien depuis 6 jours
  const minsOn = !state.settings.minimumsFrom || k >= state.settings.minimumsFrom;
  if (minsOn) for (const [cat, min] of Object.entries(state.settings.minimums || {})) {
    if (!min) continue; let last = null; for (let i = 0; i < 6 && !last; i++) if (doneOn(state, addDays(k, -i)).things.some((t) => t.cat === cat)) last = i;
    if (last === null && !d.things.some((t) => t.cat === cat)) { const o = obs.filter((x) => x.cat === cat).sort((a, b) => b.n - a.n)[0]; out.push({ id: `bal:${cat}:${k}`, kind: 'habit', title: o ? o.title : (cat === 'bienetre' ? 'Marche de 20 minutes' : 'Vingt minutes pour toi'), cat, slot: o ? (top(o.slots) || [null])[0] : null, text: `Rien en ${catOf(cat).nom} depuis six jours. ${o ? `« ${o.title} », comme d'habitude ?` : 'Une petite chose ?'}`, yes: 'Le poser' }); }
  }
  // un refus vaut pour le titre entier pendant 14 jours (habitude, série…), et l'allègement passe en premier
  const tOff = (x) => x.title && dismissed['t:' + norm(x.title)] && dismissed['t:' + norm(x.title)] >= addDays(k, -14);
  return out.filter((x) => !dismissed[x.id] && !tOff(x)).sort((a, b) => (b.kind === 'load') - (a.kind === 'load')).slice(0, max);
}

// ---------- Le soleil (le même pour le village, les serres et la cabane) ----------
// Durée du jour et midi solaire par mois (heure légale, France) ; le soir arrive vers 17 h en novembre.
export const DAYLEN = [8.4, 9.9, 11.8, 13.6, 15.2, 16.1, 15.7, 14.3, 12.5, 10.7, 9.1, 8.2];
export const NOON = [12.9, 13.1, 13.2, 13.9, 13.8, 13.9, 14.1, 14.0, 13.8, 13.6, 12.7, 12.8];
export function sunTimes(month) { const L = DAYLEN[month], n = NOON[month]; return { rise: n - L / 2, set: n + L / 2 }; }
// Heure (décimale) → [ambiance de départ, ambiance d'arrivée, fondu 0..1], avec aube et crépuscule.
export function phaseAt(h, month) {
  const { rise, set } = sunTimes(month);
  if (h < rise - 1.2 || h >= set + 1.6) return ['night', 'night', 0];
  if (h < rise) return ['night', 'dusk', (h - rise + 1.2) / 1.2];
  if (h < rise + 1.2) return ['dusk', 'day', (h - rise) / 1.2];
  if (h < set - 1.2) return ['day', 'day', 0];
  if (h < set) return ['day', 'dusk', (h - set + 1.2) / 1.2];
  return ['dusk', 'night', (h - set) / 1.6];
}
export const phaseName = (h, month) => { const [a, b, t] = phaseAt(h, month); return t < 0.5 ? a : b; };
