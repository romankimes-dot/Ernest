import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCan, dropCan, pour, sow, trade, catalogue, seedsOf, stageOf, waterCount, cansOf, toRest, rest, wake, fix, fedBy, migrateGarden, growthOf, SPECIES } from '../js/flore.js';
import { defaultState, hydrate } from '../js/store.js';
import { merge3 } from '../js/merge.js';
import { floraOf } from '../js/model.js';

const D = '2026-11-03';
const many = (S, n, cat = 'bienetre', title = 'Litière') => { for (let i = 0; i < n; i++) addCan(S, { cat, day: D, title, thing: `t${i}` }); };

test('stades : graine 1, pousse 2, plante 5, grande 10, pleine terre 20', () => {
  assert.deepEqual([0, 1, 2, 4, 5, 9, 10, 19, 20, 50].map(stageOf), [-1, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  assert.ok(growthOf({ waters: [{}] }) < growthOf({ waters: Array(20).fill({}) }));
});
test('une chose faite donne un arrosoir ; décochée avant d’être versée, il repart', () => {
  const S = defaultState();
  assert.ok(addCan(S, { cat: 'bienetre', day: D, title: 'Litière', thing: 'a' }).can);
  assert.equal(addCan(S, { cat: 'bienetre', day: D, title: 'Litière', thing: 'a', id: S.garden.cans[0].id }).dup, true);
  assert.equal(cansOf(S, 'bienetre').length, 1); assert.equal(cansOf(S, 'travail').length, 0);
  assert.equal(dropCan(S, { thing: 'a' }), true); assert.equal(S.garden.cans.length, 0);
});
test('semer, verser, grandir : stades, graines de taille, pleine terre, espèce débloquée', () => {
  const S = defaultState(); many(S, 25);
  assert.equal(sow(S, 'bienetre', 'monstera', D).error, 'fermée');
  const { plant, events } = sow(S, 'bienetre', 'thym', D);
  assert.equal(waterCount(plant), 1); assert.equal(events.length, 0); assert.equal(floraOf(plant)[1], 'le thym');
  const r = pour(S, plant.id, D, 19);
  assert.equal(r.poured, 19); assert.equal(waterCount(plant), 20);
  assert.deepEqual(r.events.filter((e) => e.kind === 'stage').map((e) => e.stage), ['Pousse', 'Plante', 'Grande']);
  assert.ok(r.events.some((e) => e.kind === 'ground'));
  assert.ok(r.events.some((e) => e.kind === 'unlock' && e.species.id === 'romarin'), 'une plante en pleine terre ouvre le romarin');
  assert.equal(seedsOf(S), 3 + 3);
  assert.deepEqual(fedBy(plant), [['Litière', 20]]);
  assert.equal(pour(S, plant.id, D, 10).poured, 5, 'seulement les arrosoirs de la serre');
});
test('troc : une espèce contre des graines', () => {
  const S = defaultState(); many(S, 30); const { plant } = sow(S, 'bienetre', 'thym', D); pour(S, plant.id, D, 19);
  assert.equal(trade(S, 'aloes', D).ok, true); assert.equal(seedsOf(S), 1);
  assert.equal(catalogue(S, 'bienetre').find((x) => x.id === 'aloes').open, true);
  assert.equal(trade(S, 'lierre', D).error, 'graines');
});
test('ponts : la chose cochée nourrit seule la plante du pont', () => {
  const S = defaultState();
  const r = addCan(S, { cat: 'travail', day: D, title: 'Déonto · Session', thing: 'x', src: 'deonto' });
  assert.equal(r.plant.sp, 'ficus'); assert.equal(waterCount(r.plant), 1); assert.equal(S.garden.cans.length, 0);
  addCan(S, { cat: 'travail', day: D, title: 'Déonto · Schéma', thing: 'y', src: 'deonto' });
  assert.equal(S.garden.plants.length, 1); assert.equal(waterCount(S.garden.plants[0]), 2);
});
test('dormance : trois semaines sans eau, proposée ; fixée, jamais', () => {
  const S = defaultState(); many(S, 2); const a = sow(S, 'bienetre', 'thym', '2026-10-01').plant, b = sow(S, 'bienetre', 'basilic', '2026-10-01').plant;
  assert.deepEqual(toRest(S, '2026-10-15').length, 0);
  fix(S, b.id); assert.deepEqual(toRest(S, '2026-10-30').map((p) => p.id), [a.id]);
  rest(S, a.id, '2026-10-30'); assert.equal(toRest(S, '2026-10-30').length, 0);
  wake(S, a.id); assert.ok(!a.dormant);
});
test('migration : les anciens pots deviennent des arrosoirs, ceux des ponts nourrissent la plante du pont', () => {
  const old = { days: { [D]: { things: [{ id: 't1', title: 'Litière', cat: 'bienetre', done: true }] } }, list: [{ id: 'l1', text: 'Colis', done: true }],
    garden: { plants: [{ id: 'p1', cat: 'bienetre', day: D, seed: 1, kind: 'plant', thing: 't1' }, { id: 'p2', cat: 'perso', day: D, seed: 2, kind: 'plant', listId: 'l1' }, { id: 'p3', cat: 'travail', day: D, seed: 3, kind: 'plant', src: 'deonto' }, { id: 'g', kind: 'bonsai', cat: 'travail', goal: 'x' }], objects: [] } };
  const h = hydrate(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(h.garden.cans.map((c) => [c.id, c.title]), [['mp1', 'Litière'], ['mp2', 'Colis']]);
  assert.deepEqual(h.garden.plants.map((p) => p.kind), ['plant', 'bonsai']);
  assert.equal(h.garden.plants[0].src, 'deonto'); assert.equal(h.garden.migrated.n, 3);
  assert.equal(migrateGarden(h), 0, 'une seule fois');
  // deux appareils qui migrent chacun de leur côté : réunis sans doublon
  const a = hydrate(JSON.parse(JSON.stringify(old))), b = hydrate(JSON.parse(JSON.stringify(old)));
  const m = merge3(null, { ...a, updatedAt: 2 }, { ...b, updatedAt: 1 });
  assert.equal(m.garden.cans.length, 2); assert.equal(m.garden.plants.filter((p) => p.src === 'deonto').length, 1);
});
test('douze espèces par serre, chacune avec un dessin', () => {
  for (const l of Object.values(SPECIES)) { assert.equal(l.length, 12); for (const s of l) assert.ok(s.look && s.art && s.latin); }
});
import { decorsOf, tradeDecor, shelfCandidates, shelve, keepInSerre, bonsaiInSerre, shelf, achievements, addSeeds } from '../js/flore.js';
test('décors : troqués une fois contre des graines', () => {
  const S = defaultState(); addSeeds(S, 4, 'test', D);
  assert.equal(tradeDecor(S, 'bienetre', 'bassin', D).error, 'graines');
  assert.equal(tradeDecor(S, 'bienetre', 'arrosoir', D).ok, true); assert.equal(seedsOf(S), 1);
  assert.equal(tradeDecor(S, 'bienetre', 'arrosoir', D).error, 'obtenu');
  assert.ok(decorsOf(S, 'bienetre')[0].got); assert.ok(!decorsOf(S, 'travail')[0].got);
});
test('étagère : un objectif atteint, le bonsaï proposé ; posé, il quitte la serre', () => {
  const S = defaultState(); S.goals.push({ id: 'g', title: 'Épreuve 1', status: 'active', milestones: [] }); S.garden.plants.push({ id: 'b', kind: 'bonsai', goal: 'g', cat: 'travail', seed: 1, branches: 3 });
  assert.equal(shelfCandidates(S).length, 0);
  S.goals[0].status = 'done'; assert.equal(shelfCandidates(S).length, 1); assert.equal(bonsaiInSerre(S.garden.plants[0], S.goals[0]), true);
  shelve(S, 'g', D); assert.equal(shelf(S).length, 1); assert.equal(bonsaiInSerre(S.garden.plants[0], S.goals[0]), false); assert.equal(shelfCandidates(S).length, 0);
  keepInSerre(S, 'g'); assert.equal(shelf(S).length, 0); assert.equal(shelfCandidates(S).length, 0);
});
test('achèvements : calculés depuis l’état', () => {
  const S = defaultState(); many(S, 20); const { plant } = sow(S, 'bienetre', 'thym', D); pour(S, plant.id, D, 19);
  S.goals.push({ id: 'g', title: 'Épreuve 1', status: 'done', doneAt: D, milestones: [] });
  const a = Object.fromEntries(achievements(S).map((x) => [x.id, x.done]));
  assert.equal(a.terre1, true); assert.equal(a.terre10, false); assert.equal(a.obj1, true); assert.equal(a['obj-g'], true); assert.equal(a['serre-bienetre'], false);
});

import { rand, RARE, rareName } from '../js/flore.js';
test('variante rare : tirée à la pleine terre, une fois', () => {
  for (const l of Object.values(SPECIES)) for (const s of l) assert.ok(RARE[s.id], s.id);
  const S = defaultState(); many(S, 40); const { plant } = sow(S, 'bienetre', 'monstera', D).plant ? sow(S, 'bienetre', 'monstera', D) : { plant: null };
  assert.equal(plant, null, 'monstera fermée au départ');
  const a = sow(S, 'bienetre', 'thym', D).plant, keep = rand.f;
  rand.f = () => 0.05; const r = pour(S, a.id, D, 19); rand.f = keep;
  assert.ok(r.events.some((e) => e.kind === 'rare')); assert.equal(rareName(a), 'Thym à fleurs blanches');
  rand.f = () => 0.05; const r2 = pour(S, a.id, D, 5); rand.f = keep; assert.ok(!r2.events.some((e) => e.kind === 'rare'), 'une seule fois');
  assert.equal(Object.fromEntries(achievements(S).map((x) => [x.id, x.done])).rare1, true);
});

test('plan partagé : pleine terre à sa place, le reste sur l\'établi', async () => {
  const { layout, SLOT_XZ } = await import('../js/flore.js');
  const L = layout([{ id: 'a', sp: 'thym', n: 25, place: 3 }, { id: 'b', sp: 'basilic', n: 22, place: 3 }, { id: 'c', sp: 'monstera', n: 30 }, { id: 'd', sp: 'thym', n: 4 }, { id: 'x', sp: 'inconnue', n: 40 }]);
  assert.deepEqual(L.at.get('a'), { mode: 'ground', type: 'Massif', k: 3, x: SLOT_XZ.Massif[3][0], z: SLOT_XZ.Massif[3][1] });
  assert.equal(L.at.get('b').k, 0); // place prise : la première libre
  assert.equal(L.at.get('c').type, 'Géante');
  assert.deepEqual(L.at.get('d'), { mode: 'bench', type: 'Massif', k: 0 });
  assert.equal(L.at.has('x'), false);
  assert.equal(SLOT_XZ.Massif.length, 24);
});

import { stageLook } from '../js/flore.js';
test('stade et avancée dans le stade : un dessin par stade', () => {
  assert.deepEqual(stageLook(0), { s: -1, k: 0 });
  assert.equal(stageLook(1).s, 0);
  assert.equal(stageLook(2).s, 1); assert.equal(stageLook(3).k, 1 / 3);
  assert.equal(stageLook(5).s, 2); assert.equal(stageLook(10).s, 3); assert.equal(stageLook(19).k, 0.9);
  assert.equal(stageLook(20).s, 4); assert.equal(stageLook(80).k, 1);
});
