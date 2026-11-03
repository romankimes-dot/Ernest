// La flore d'Ernest (docs/PROGRESSION.md) : arrosoirs, plantes qui grandissent, stades, graines, espèces à débloquer.
// Fonctions pures sur l'état ; aucune dépendance au DOM. Testées dans tests/flore.test.js.
//
// Terminer une chose donne un arrosoir plein (S.garden.cans) pour la serre de sa catégorie. On le verse sur la
// plante de son choix : chaque arrosoir versé est gardé dans la plante (waters), son nombre fait le stade.
// Graine 1, pousse 2, plante 5, grande 10, pleine terre 20. Chaque passage de stade : Ernest taille, une graine ;
// la pleine terre : trois graines. Les choses venues d'un pont nourrissent seules la plante de ce pont.
// Tout est rangé dans des tableaux à identifiants : la synchronisation réunit sans rien perdre.
import { catId, isActive, uid, diffDays } from './model.js';

const seedNum = () => Math.floor(Math.random() * 1e9);

export const STAGES = [['Graine', 1], ['Pousse', 2], ['Plante', 5], ['Grande', 10], ['Pleine terre', 20]];
export const GROUND = 20;
export const DORMANT_DAYS = 21;
export const stageOf = (n) => { let s = -1; STAGES.forEach(([, k], i) => { if (n >= k) s = i; }); return s; };
export const stageName = (n) => { const s = stageOf(n); return s < 0 ? 'Pas encore semée' : STAGES[s][0]; };

// Douze espèces par serre, dans l'ordre du déblocage. look : le dessin utilisé par les serres (garden3d, garden2d).
// [id, nom, avec l'article, latin, type, look]
const L = (id, nom, art, latin, type, look) => ({ id, nom, art, latin, type, look });
export const SPECIES = {
  bienetre: [
    L('thym', 'Thym', 'le thym', 'Thymus vulgaris', 'Massif', 'thyme'),
    L('basilic', 'Basilic', 'le basilic', 'Ocimum basilicum', 'Massif', 'basil'),
    L('romarin', 'Romarin', 'le romarin', 'Salvia rosmarinus', 'Massif', 'rosemary'),
    L('aloes', 'Aloès', "l'aloès", 'Aloe vera', 'Rocaille', 'succulent'),
    L('camomille', 'Camomille', 'la camomille', 'Matricaria chamomilla', 'Massif', 'wildflowers'),
    L('lierre', 'Lierre', 'le lierre', 'Hedera helix', 'Liane', 'mossy'),
    L('tradescantia', 'Misère', 'la misère', 'Tradescantia zebrina', 'Tombante', 'violet'),
    L('fougere', 'Fougère arborescente', 'la fougère arborescente', 'Dicksonia antarctica', 'Géante', 'fern'),
    L('capucine', 'Capucine', 'la capucine', 'Tropaeolum majus', 'Tombante', 'geranium'),
    L('jasmin', 'Jasmin étoilé', 'le jasmin étoilé', 'Trachelospermum jasminoides', 'Liane', 'flowering'),
    L('citronnier', 'Citronnier', 'le citronnier', 'Citrus limon', 'Géante', 'ficus'),
    L('monstera', 'Monstera', 'la monstera', 'Monstera deliciosa', 'Géante', 'broadleaf'),
  ],
  travail: [
    L('pensee', 'Pensée', 'la pensée', 'Viola × wittrockiana', 'Massif', 'violet'),
    L('lavande', 'Lavande', 'la lavande', 'Lavandula angustifolia', 'Massif', 'lavender'),
    L('iris', 'Iris', "l'iris", 'Iris germanica', 'Massif', 'flowering'),
    L('sansevieria', 'Sansevière', 'la sansevière', 'Dracaena trifasciata', 'Rocaille', 'succulent'),
    L('calathea', 'Calathéa', 'le calathéa', 'Goeppertia orbifolia', 'Massif', 'broadleaf'),
    L('philodendron', 'Philodendron', 'le philodendron', 'Philodendron hederaceum', 'Liane', 'broadleaf'),
    L('pothos', 'Pothos', 'le pothos', 'Epipremnum aureum', 'Tombante', 'mossy'),
    L('kentia', 'Palmier kentia', 'le palmier kentia', 'Howea forsteriana', 'Géante', 'fern'),
    L('orchidee', 'Orchidée', "l'orchidée", 'Phalaenopsis', 'Tombante', 'flowering'),
    L('glycine', 'Glycine', 'la glycine', 'Wisteria sinensis', 'Liane', 'lavender'),
    L('ficus', 'Figuier lyre', 'le figuier lyre', 'Ficus lyrata', 'Géante', 'ficus'),
    L('strelitzia', 'Oiseau de paradis', "l'oiseau de paradis", 'Strelitzia reginae', 'Géante', 'broadleaf'),
  ],
  perso: [
    L('marguerite', 'Marguerite', 'la marguerite', 'Leucanthemum vulgare', 'Massif', 'wildflowers'),
    L('coquelicot', 'Coquelicot', 'le coquelicot', 'Papaver rhoeas', 'Massif', 'wildflowers'),
    L('bleuet', 'Bleuet', 'le bleuet', 'Centaurea cyanus', 'Massif', 'violet'),
    L('graminees', 'Graminées', 'les graminées', 'Pennisetum alopecuroides', 'Prairie', 'tallgrass'),
    L('cosmos', 'Cosmos', 'le cosmos', 'Cosmos bipinnatus', 'Massif', 'flowering'),
    L('chevrefeuille', 'Chèvrefeuille', 'le chèvrefeuille', 'Lonicera periclymenum', 'Liane', 'flowering'),
    L('geranium', 'Géranium-lierre', 'le géranium-lierre', 'Pelargonium peltatum', 'Tombante', 'geranium'),
    L('hortensia', 'Hortensia', "l'hortensia", 'Hydrangea macrophylla', 'Géante', 'flowering'),
    L('fuchsia', 'Fuchsia', 'le fuchsia', 'Fuchsia magellanica', 'Tombante', 'geranium'),
    L('rosier', 'Rosier grimpant', 'le rosier grimpant', 'Rosa', 'Liane', 'flowering'),
    L('figuier', 'Figuier', 'le figuier', 'Ficus carica', 'Géante', 'ficus'),
    L('olivier', 'Olivier', "l'olivier", 'Olea europaea', 'Géante', 'ficus'),
  ],
};
// Conditions de déblocage, par rang dans la serre : départ, plantes en pleine terre (dans cette serre), ou graines.
export const UNLOCK = [{ start: 1 }, { start: 1 }, { ground: 1 }, { seeds: 5 }, { ground: 2 }, { seeds: 8 }, { ground: 3 }, { seeds: 12 }, { ground: 5 }, { seeds: 15 }, { ground: 7 }, { seeds: 25 }];
// Variantes rares : une chance sur dix à la pleine terre. [nom, allure] ; l'allure dit comment la dessiner
// (panache : feuilles crème, blanc, or, sombre, rose, bleu : fleurs ou feuillage, grand : plus grande).
export const RARE = {
  thym: ['à fleurs blanches', 'blanc'], basilic: ['pourpre', 'sombre'], romarin: ['rampant', 'grand'], aloes: ['tigré', 'panache'], camomille: ['double', 'grand'], lierre: ['panaché', 'panache'],
  tradescantia: ['argentée', 'panache'], fougere: ['dorée', 'or'], capucine: ['panachée', 'panache'], jasmin: ['rose', 'rose'], citronnier: ['panaché', 'panache'], monstera: ['panachée', 'panache'],
  pensee: ['noire', 'sombre'], lavande: ['blanche', 'blanc'], iris: ['bleu nuit', 'sombre'], sansevieria: ['dorée', 'or'], calathea: ['rayé', 'panache'], philodendron: ['doré', 'or'],
  pothos: ['neige', 'panache'], kentia: ['géant', 'grand'], orchidee: ['tigrée', 'rose'], glycine: ['blanche', 'blanc'], ficus: ['panaché', 'panache'], strelitzia: ['blanc', 'blanc'],
  marguerite: ['géante', 'grand'], coquelicot: ['double', 'rose'], bleuet: ['rose', 'rose'], graminees: ['pourpres', 'sombre'], cosmos: ['chocolat', 'sombre'], chevrefeuille: ['doré', 'or'],
  geranium: ['bicolore', 'blanc'], hortensia: ['bleu', 'bleu'], fuchsia: ['blanc', 'blanc'], rosier: ['ancien', 'grand'], figuier: ['panaché', 'panache'], olivier: ['centenaire', 'grand'],
};
export const RARE_CHANCE = 0.1;
export const rand = { f: Math.random }; // remplaçable dans les tests
export const rareName = (p) => { const s = speciesById(p.sp); return s && p.rare && RARE[p.sp] ? `${s.nom} ${RARE[p.sp][0]}` : s ? s.nom : ''; };
// La plante de chaque pont : elle reçoit seule ce que le pont coche.
export const BRIDGE_SPECIES = { deonto: 'ficus', revision: 'lavande', memoire: 'iris' };
const ALL = Object.entries(SPECIES).flatMap(([house, l]) => l.map((s, i) => ({ ...s, house, rank: i })));
export const speciesById = (id) => ALL.find((s) => s.id === id) || null;

// ---------- Lecture ----------
const G = (S) => S.garden;
export const isNew = (p) => p && p.kind === 'plant' && p.v === 2;
export const waterCount = (p) => (Array.isArray(p.waters) ? p.waters.length : 0);
export const lastWater = (p) => (Array.isArray(p.waters) && p.waters.length ? p.waters.map((w) => w.day).sort().pop() : p.day);
export const plantsOf = (S, house) => (G(S).plants || []).filter((p) => isNew(p) && catId(p.cat) === house);
export const cansOf = (S, house) => (G(S).cans || []).filter((c) => !house || catId(c.cat) === house).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
export const seedsOf = (S) => (G(S).seeds || []).reduce((a, x) => a + (Number(x.n) || 0), 0);
export const groundCount = (S, house) => plantsOf(S, house).filter((p) => waterCount(p) >= GROUND).length;
// Croissance affichée (0..1) d'une plante nouvelle : suit le stade, et continue un peu au-delà de la pleine terre.
export const growthOf = (p) => { const n = waterCount(p); if (n <= 0) return 0.08; if (n >= GROUND) return Math.min(1, 0.86 + (n - GROUND) * 0.007); return [0.16, 0.3, 0.52, 0.72][stageOf(n)] + 0.1 * Math.min(1, (n - STAGES[stageOf(n)][1]) / Math.max(1, (STAGES[stageOf(n) + 1] || [0, GROUND])[1] - STAGES[stageOf(n)][1])); };

// Espèces d'une serre et leur état : ouverte, à troquer (graines), ou en attente (plantes en pleine terre).
export function catalogue(S, house) {
  const mine = plantsOf(S, house), g = mine.filter((p) => waterCount(p) >= GROUND).length, seeds = seedsOf(S), un = G(S).unlocked || {};
  return SPECIES[house].map((s, i) => {
    const u = UNLOCK[i], open = !!(u.start || (u.ground && g >= u.ground) || un[s.id]);
    const cond = u.start ? 'Au départ' : u.ground ? `${u.ground} plante${u.ground > 1 ? 's' : ''} en pleine terre` : `${u.seeds} graines`;
    const best = mine.filter((p) => p.sp === s.id).reduce((a, p) => Math.max(a, waterCount(p)), 0);
    const rare = mine.some((p) => p.sp === s.id && p.rare);
    return { ...s, house, open, cond, price: u.seeds || 0, canTrade: !open && !!u.seeds && seeds >= u.seeds, best, rare, rareName: RARE[s.id] ? `${s.nom} ${RARE[s.id][0]}` : '' };
  });
}

// ---------- Écriture ----------
function ensure(S) { const g = G(S); if (!Array.isArray(g.cans)) g.cans = []; if (!Array.isArray(g.seeds)) g.seeds = []; if (!g.unlocked || typeof g.unlocked !== 'object') g.unlocked = {}; if (!Array.isArray(g.plants)) g.plants = []; return g; }
export function addSeeds(S, n, why, day) { if (!n) return; ensure(S).seeds.push({ id: uid(), n, why, day }); }

// Passe d'un nombre d'arrosages à un autre : stades franchis, graines gagnées, espèces débloquées par la pleine terre.
function grew(S, p, before, openBefore, day) {
  const ev = [], house = catId(p.cat), s0 = stageOf(before), s1 = stageOf(waterCount(p));
  if (s1 <= s0) return ev;
  for (let s = s0 + 1; s <= s1; s++) {
    if (s <= 0) continue; // la graine elle-même
    if (s === STAGES.length - 1) { addSeeds(S, 3, 'pleine terre', day); ev.push({ kind: 'ground', plant: p, seeds: 3 }); if (!p.rare && !p.src && rand.f() < RARE_CHANCE) { p.rare = day; ev.push({ kind: 'rare', plant: p, name: rareName(p) }); } }
    else { addSeeds(S, 1, 'taille', day); ev.push({ kind: 'stage', plant: p, stage: STAGES[s][0], seeds: 1 }); }
  }
  for (const x of catalogue(S, house)) if (x.open && !openBefore.includes(x.id)) ev.push({ kind: 'unlock', species: x });
  return ev;
}
function feed(S, p, can, day) { const before = waterCount(p), open = catalogue(S, catId(p.cat)).filter((x) => x.open).map((x) => x.id); if (!Array.isArray(p.waters)) p.waters = []; p.waters.push({ id: can.id, day, t: can.title || null }); if (p.dormant) delete p.dormant; return grew(S, p, before, open, day); }

// La plante d'un pont (créée au besoin, sans condition de déblocage).
function bridgePlant(S, src, cat, day) {
  const g = ensure(S); let p = g.plants.find((x) => isNew(x) && x.src === src);
  if (!p) { const house = catId(cat), sp = BRIDGE_SPECIES[src] && speciesById(BRIDGE_SPECIES[src]).house === house ? BRIDGE_SPECIES[src] : SPECIES[house][0].id; p = { id: `b-${src}`, kind: 'plant', v: 2, cat: house, sp, day, seed: seedNum(), src, waters: [] }; g.plants.push(p); }
  return p;
}

// Une chose faite : un arrosoir plein (ou, venue d'un pont, versé tout de suite sur la plante du pont).
// L'identifiant vient de la chose : recochée après avoir versé son arrosoir, ou cochée sur deux appareils, elle n'en
// donne qu'un. → { can } ou { plant, events } ou { dup }
export function addCan(S, { cat, day, title = null, thing = null, listId = null, src = null, id = null }) {
  const g = ensure(S), can = { id: id || (thing ? `c-t-${thing}` : listId ? `c-l-${listId}` : uid()), cat: catId(cat || 'perso'), day, title: title ? String(title).slice(0, 120) : null };
  if (thing) can.thing = thing; if (listId) can.listId = listId;
  if (g.cans.some((c) => c.id === can.id) || g.plants.some((p) => Array.isArray(p.waters) && p.waters.some((w) => w.id === can.id))) return { dup: true };
  if (src) { can.src = src; const p = bridgePlant(S, src, can.cat, day); return { plant: p, events: feed(S, p, can, day) }; }
  g.cans.push(can); return { can };
}
// Retirer les arrosoirs d'une chose décochée, s'ils n'ont pas encore été versés.
export function dropCan(S, { thing = null, listId = null }) {
  const g = ensure(S), n = g.cans.length; g.cans = g.cans.filter((c) => !((thing && c.thing === thing) || (listId && c.listId === listId)));
  return g.cans.length < n;
}

// Verser n arrosoirs de la serre de la plante (les plus anciens d'abord). → { poured, events }
export function pour(S, plantId, day, n = 1) {
  const g = ensure(S), p = g.plants.find((x) => x.id === plantId); if (!isNew(p)) return { poured: 0, events: [] };
  const house = catId(p.cat), take = cansOf(S, house).slice(0, n), events = [];
  for (const c of take) { g.cans.splice(g.cans.indexOf(c), 1); events.push(...feed(S, p, c, day)); }
  return { poured: take.length, events };
}

// Planter une graine : il faut un arrosoir plein de la serre et une espèce ouverte. → { plant, events } ou { error }
export function sow(S, house, spId, day) {
  const g = ensure(S), sp = catalogue(S, house).find((x) => x.id === spId);
  if (!sp) return { error: 'espèce' }; if (!sp.open) return { error: 'fermée' };
  const can = cansOf(S, house)[0]; if (!can) return { error: 'arrosoir' };
  const p = { id: uid(), kind: 'plant', v: 2, cat: house, sp: spId, day, seed: seedNum(), waters: [] }; g.plants.push(p);
  g.cans.splice(g.cans.indexOf(can), 1); const events = feed(S, p, can, day);
  return { plant: p, events };
}

// Troc : ouvrir une espèce contre des graines.
export function trade(S, spId, day) {
  const s = speciesById(spId); if (!s) return { error: 'espèce' };
  const c = catalogue(S, s.house).find((x) => x.id === spId); if (c.open) return { error: 'ouverte' }; if (!c.canTrade) return { error: 'graines' };
  addSeeds(S, -c.price, `troc:${spId}`, day); ensure(S).unlocked[spId] = day; return { ok: true, species: c };
}

// Dormance : trois semaines sans arrosage, Ernest propose de ranger la plante à la cabane (sauf si on l'a fixée).
export const resting = (S, house) => plantsOf(S, house).filter((p) => p.dormant);
// Ressortie de la cabane : les trois semaines repartent de ce jour-là.
const lastCare = (p) => { const w = lastWater(p); return p.woke && (!w || p.woke > w) ? p.woke : w; };
export const toRest = (S, today) => (G(S).plants || []).filter((p) => isNew(p) && !p.fixed && !p.dormant && !p.src && diffDays(lastCare(p), today) >= DORMANT_DAYS);
export function rest(S, id, day) { const p = (G(S).plants || []).find((x) => x.id === id); if (!isNew(p)) return false; p.dormant = day; return true; }
export function wake(S, id, day = null) { const p = (G(S).plants || []).find((x) => x.id === id); if (!isNew(p) || !p.dormant) return false; delete p.dormant; if (day) p.woke = day; return true; }
export function fix(S, id, on = true) { const p = (G(S).plants || []).find((x) => x.id === id); if (!isNew(p)) return false; if (on) p.fixed = true; else delete p.fixed; return true; }

// Ce qui a nourri une plante : les titres des choses, avec leur nombre, du plus fréquent au plus rare.
export function fedBy(p) { const m = new Map(); for (const w of p.waters || []) { const t = w.t || 'Sans titre'; m.set(t, (m.get(t) || 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); }

// ---------- Migration : les anciens pots (une plante par chose faite) deviennent des arrosoirs à verser ----------
// Les pots venus d'un pont nourrissent la plante de ce pont. Les identifiants sont tirés des pots : deux appareils
// qui migrent chacun de leur côté produisent les mêmes arrosoirs, la synchronisation les réunit sans doublon.
// Un arrosoir déjà versé (son identifiant est dans une plante) ou en double ne reste pas à verser : la fusion de deux
// appareils (l'un a versé, l'autre a migré de son côté) peut le faire revenir.
export function tidyCans(S) {
  const g = ensure(S), poured = new Set(), seen = new Set();
  // un même arrosoir versé sur deux plantes (deux appareils, chacun de son côté) ne compte qu'une fois
  for (const p of g.plants) if (p && Array.isArray(p.waters)) p.waters = p.waters.filter((w) => { if (!w || poured.has(w.id)) return false; poured.add(w.id); return true; });
  const before = g.cans.length; g.cans = g.cans.filter((c) => c && !poured.has(c.id) && !seen.has(c.id) && seen.add(c.id));
  return before - g.cans.length;
}
export function migrateGarden(S) {
  const g = ensure(S); g.v = 2; tidyCans(S); if (!g.plants.some((p) => p && p.kind === 'plant' && p.v !== 2)) return 0;
  const things = new Map(); for (const d of Object.values(S.days || {})) for (const t of (d && d.things) || []) things.set(t.id, t);
  const list = new Map((S.list || []).map((l) => [l.id, l]));
  let n = 0; const keep = [];
  for (const p of g.plants) {
    if (!p || p.kind !== 'plant' || p.v === 2) { keep.push(p); continue; }
    const t = p.thing && things.get(p.thing), l = p.listId && list.get(p.listId);
    const can = { id: `m${p.id}`, cat: catId(p.cat), day: p.day, title: t ? t.title : l ? l.text : null };
    if (p.thing) can.thing = p.thing; if (p.listId) can.listId = p.listId;
    g.plants = keep; // bridgePlant cherche dans g.plants
    if (p.src) { const bp = bridgePlant(S, p.src, can.cat, p.day); can.src = p.src; if (!(bp.waters || []).some((w) => w.id === can.id)) feed(S, bp, can, p.day); }
    else g.cans.push(can);
    n++;
  }
  g.plants = keep; tidyCans(S); g.migrated = { n: ((g.migrated && g.migrated.n) || 0) + n, at: new Date().toISOString().slice(0, 10), seen: false };
  return n;
}

// ---------- Décors à troquer (six par serre) ----------
export const DECORS = {
  bienetre: [['arrosoir', 'Arrosoir de cuivre', 3], ['etiquettes', 'Étiquettes de botaniste', 4], ['banc', 'Banc de jardin', 6], ['lanternes', 'Lanternes', 8], ['bassin', 'Bassin et fontaine', 12], ['carillon', 'Carillon', 5]],
  travail: [['arrosoir', 'Arrosoir de cuivre', 3], ['etiquettes', 'Étiquettes de botaniste', 4], ['banc', 'Banc de lecture', 6], ['lanternes', 'Lampes de bibliothèque', 8], ['cadran', 'Cadran solaire', 12], ['horloge', 'Horloge de gare', 5]],
  perso: [['arrosoir', 'Arrosoir de cuivre', 3], ['etiquettes', 'Étiquettes peintes', 4], ['banc', 'Banc de jardin', 6], ['guirlande', 'Guirlande lumineuse', 8], ['vasque', 'Vasque aux oiseaux', 12], ['carillon', 'Carillon', 5]],
};
export function decorsOf(S, house) { const got = G(S).decors || {}, seeds = seedsOf(S); return DECORS[house].map(([id, nom, prix]) => ({ id, key: `${house}:${id}`, house, nom, prix, got: got[`${house}:${id}`] || null, canTrade: !got[`${house}:${id}`] && seeds >= prix })); }
export function tradeDecor(S, house, id, day) {
  const d = decorsOf(S, house).find((x) => x.id === id); if (!d) return { error: 'décor' }; if (d.got) return { error: 'obtenu' }; if (!d.canTrade) return { error: 'graines' };
  addSeeds(S, -d.prix, `décor:${d.key}`, day); const g = ensure(S); if (!g.decors || typeof g.decors !== 'object') g.decors = {}; g.decors[d.key] = day; return { ok: true, decor: d };
}

// ---------- Étagère à bonsaïs : un objectif atteint, Ernest propose de poser son bonsaï dans la cabane ----------
export const bonsaiOf = (S, goalId) => (G(S).plants || []).find((p) => p && p.kind === 'bonsai' && p.goal === goalId) || null;
// Visible dans la serre : objectif en cours, ou atteint et pas encore posé sur l'étagère.
export const bonsaiInSerre = (p, goal) => !!goal && (goal.status === 'active' || (goal.status === 'done' && !p.shelf));
export const shelfCandidates = (S) => (G(S).plants || []).filter((p) => p && p.kind === 'bonsai' && !p.shelf && !p.keep && ((S.goals || []).find((g) => g.id === p.goal) || {}).status === 'done');
export const shelf = (S) => (G(S).plants || []).filter((p) => p && p.kind === 'bonsai' && p.shelf);
export function shelve(S, goalId, day) { const p = bonsaiOf(S, goalId); if (!p) return false; p.shelf = day; delete p.keep; return true; }
export function keepInSerre(S, goalId) { const p = bonsaiOf(S, goalId); if (!p) return false; delete p.shelf; p.keep = true; return true; }

// ---------- Achèvements (le livre) : calculés depuis l'état, rien à enregistrer ----------
// → [{ id, groupe, nom, desc, done }]
export function achievements(S) {
  const ps = (G(S).plants || []).filter(isNew), waters = ps.reduce((a, p) => a + waterCount(p), 0);
  const sown = new Set(ps.map((p) => p.sp)), ground = ps.filter((p) => waterCount(p) >= GROUND);
  const active = Object.keys(S.days || {}).filter((k) => isActive(S, k)).length, finds = G(S).findsTotal || 0;
  const goals = (S.goals || []).filter((g) => g.status === 'done');
  const A = (id, groupe, nom, desc, done) => ({ id, groupe, nom, desc, done: !!done });
  const out = [
    A('terre1', 'Botanique', 'Première pleine terre', 'Une plante arrosée vingt fois.', ground.length >= 1),
    A('terre10', 'Botanique', 'Dix en pleine terre', 'Dix plantes arrosées vingt fois.', ground.length >= 10),
    A('esp6', 'Botanique', 'Six espèces', 'Six espèces différentes semées.', sown.size >= 6),
    A('esp36', 'Botanique', 'Toutes les espèces', 'Les trente-six espèces semées.', sown.size >= 36),
    A('eau100', 'Botanique', 'Cent arrosoirs', 'Cent arrosoirs versés.', waters >= 100),
    A('rare1', 'Botanique', 'Une variante rare', 'Une chance sur dix à la pleine terre.', ps.some((p) => p.rare)),
    ...Object.keys(SPECIES).map((h) => A(`serre-${h}`, 'Botanique', `Serre ${{ travail: 'Travail', bienetre: 'Bien-être', perso: 'Vie perso' }[h]} accomplie`, 'Ses douze espèces en pleine terre.', SPECIES[h].every((sp) => ground.some((p) => p.sp === sp.id)))),
    A('jours10', 'Régularité douce', 'Dix jours', 'Dix jours où tu as avancé, pas forcément d’affilée.', active >= 10),
    A('jours30', 'Régularité douce', 'Trente jours', 'Trente jours où tu as avancé.', active >= 30),
    A('jours100', 'Régularité douce', 'Cent jours', 'Cent jours où tu as avancé.', active >= 100),
    A('obj1', 'Objectifs', 'Premier objectif atteint', 'Un bonsaï achevé.', goals.length >= 1),
    ...goals.map((g) => A(`obj-${g.id}`, 'Objectifs', g.title, `Atteint${g.doneAt ? ` le ${g.doneAt}` : ''}.`, true)),
    A('serres3', 'Promenade', 'Les trois serres', 'Les trois serres arrosées le même jour.', !!G(S).waterCard),
    A('dorees10', 'Promenade', 'Dix graines dorées', 'Ramassées en promenade.', finds >= 10),
    A('dorees50', 'Promenade', 'Cinquante graines dorées', 'Ramassées en promenade.', finds >= 50),
  ];
  return out;
}
