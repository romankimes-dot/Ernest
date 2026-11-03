import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeByCat, fmtMin, materialize, daysLabel, seriesDue, isoWeek, weekDays, addDays, doneOn, activeDays, estimate, moodAvg, sortList, suggestions, chooseLine, fillLine, pickCard, growth, catCounts, minimums, catOf, CATS } from '../js/model.js';
import { defaultState, hydrate } from '../js/store.js';

const st = () => { const s = defaultState(); s.days['2026-11-03'] = { things: [{ id: 'a', title: 'x', cat: 'revision', done: true, real: 80 }, { id: 'b', title: 'y', cat: 'corps', done: false }], journal: '', mood: 1, planned: true }; return s; };

test('semaine ISO et jours', () => {
  assert.equal(isoWeek('2026-11-03'), '2026-W45');
  assert.equal(isoWeek('2026-01-01'), '2026-W01');
  assert.deepEqual(weekDays('2026-11-08')[0], '2026-11-02');
  assert.equal(weekDays('2026-11-08')[6], '2026-11-08');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
});
test('faits, jours actifs, comptes', () => {
  const s = st();
  s.list.push({ id: 'l', text: 'colis', cat: 'perso', done: true, doneAt: '2026-11-03T10:00:00' });
  assert.equal(doneOn(s, '2026-11-03').n, 2);
  assert.equal(activeDays(s, weekDays('2026-11-03')), 1);
  assert.deepEqual(catCounts(s, ['2026-11-03']), { revision: 1, perso: 1 });
  assert.deepEqual(minimums(s, ['2026-11-03']), [{ cat: 'bienetre', min: 5, done: 0 }]);
});
test('estimation : médiane arrondie à 5, défaut sinon', () => {
  const s = st();
  assert.equal(estimate(s, 'revision'), 80);
  assert.equal(estimate(s, 'cuisine', 25), 25);
  s.days['2026-11-02'] = { things: [{ cat: 'revision', done: true, real: 33 }, { cat: 'revision', done: true, real: 47 }], journal: '', mood: null };
  assert.equal(estimate(s, 'revision'), 45);
});
test('humeur moyenne', () => {
  const s = st();
  assert.equal(moodAvg(s, '2026-11-03'), 'low');
  assert.equal(moodAvg(defaultState(), '2026-11-03'), null);
});
test('tri de la liste et suggestions', () => {
  const l = [{ id: 1, text: 'a', at: '2', done: false }, { id: 2, text: 'b', at: '1', done: false, due: '2026-11-05' }, { id: 3, text: 'c', at: '0', done: true }, { id: 4, text: 'd', at: '3', due: '2026-11-04', done: false }];
  assert.deepEqual(sortList(l).map((x) => x.id), [4, 2, 1, 3]);
  const s = st(); s.list = l; s.settings.minimumsFrom = null;
  const sug = suggestions(s, '2026-11-04');
  assert.equal(sug[0].title, 'd'); assert.equal(sug[0].why, 'pour demain');
  assert.ok(sug.some((x) => x.kind === 'min' && x.cat === 'bienetre'));
  s.days['2026-11-03'].things.push({ id: 'z', title: 'd', cat: 'perso', done: false, fromList: 4 });
  assert.ok(!suggestions(s, '2026-11-04').some((x) => x.id === 4), 'déjà placée');
});
test('répliques : conditions, variables, rotation', () => {
  const lines = [{ ctx: 'coche', t: 'A {plante}' }, { ctx: 'coche', t: 'B', when: { mood: 'low' } }, { ctx: 'coche', t: 'C', when: { jmin: 0, jmax: 3 } }, { ctx: 'x', t: 'D' }];
  const env = { j: 10, dow: 2, mood: 'ok', n: 0 };
  for (let i = 0; i < 10; i++) assert.equal(chooseLine(lines, 'coche', env).t, 'A {plante}');
  assert.equal(chooseLine(lines, 'coche', { ...env, j: 2 }, { 0: Date.now() }).t, 'C');
  assert.equal(chooseLine(lines, 'nope', env), null);
  assert.equal(fillLine('A {plante} {x}', { plante: 'le thym' }), 'A le thym {x}');
  const seq = [{ ctx: 'premiere.ouverture', t: '1', seq: 1 }, { ctx: 'premiere.ouverture', t: '2', seq: 2 }];
  assert.equal(chooseLine(seq, 'premiere.ouverture', { ...env, seq: 2 }).t, '2');
});
test('cartes : jamais deux fois la même', () => {
  const cards = [{ id: 'a', rarete: 'courante', famille: 'blagues' }, { id: 'b', rarete: 'longue', famille: 'tips' }];
  assert.equal(pickCard(cards, { a: 1 }, 'courante'), null);
  assert.equal(pickCard(cards, {}, 'courante', ['blagues']).id, 'a');
  assert.equal(pickCard(cards, {}, 'longue', ['blagues']), null);
});
test('croissance : jours actifs depuis la plantation, plafonnée à 7', () => {
  const s = st();
  for (let i = 4; i < 12; i++) s.days[`2026-11-${String(i).padStart(2, '0')}`] = { things: [{ cat: 'perso', done: true }], journal: '', mood: null };
  assert.equal(growth({ day: '2026-11-03' }, s, '2026-11-03'), 1 / 7);
  assert.equal(growth({ day: '2026-11-03' }, s, '2026-11-20'), 1);
});
test('hydratation tolérante', () => {
  const h = hydrate({ days: {}, settings: { minimums: { corps: 2 } }, list: 'nope' });
  assert.equal(h.settings.minimums.bienetre, 2); assert.equal(h.settings.minimums.corps, undefined); assert.deepEqual(h.list, []);
});
test('trois catégories : les six anciennes converties à la lecture', () => {
  const h = hydrate({ days: { '2026-11-02': { things: [{ id: 'a', title: 'x', cat: 'revision' }, { id: 'b', title: 'y', cat: 'cuisine' }] } }, goals: [{ id: 'g', cat: 'boulot', milestones: [] }], garden: { plants: [{ id: 'p', cat: 'esprit', seed: 1, kind: 'plant' }] }, settings: { minimums: { corps: 4, esprit: 3 } } });
  assert.deepEqual(h.days['2026-11-02'].things.map((t) => t.cat), ['travail', 'bienetre']);
  assert.equal(h.goals[0].cat, 'travail'); assert.equal(h.garden.cans[0].cat, 'bienetre'); assert.deepEqual(h.settings.minimums, { bienetre: 4 });
  assert.equal(catOf('corps').id, 'bienetre'); assert.equal(catOf('inconnue').id, 'perso'); assert.equal(CATS.length, 3);
});

test('séries : placées une fois par jour dû, jamais recréées', () => {
  const s = defaultState();
  s.series.push({ id: 'se', title: 'Courir', cat: 'corps', days: [1, 3, 5], start: '2026-11-01', active: true });
  assert.equal(materialize(s, '2026-11-02'), 1); // lundi
  assert.equal(materialize(s, '2026-11-02'), 0);
  s.days['2026-11-02'].things = []; // supprimée par l'utilisateur
  assert.equal(materialize(s, '2026-11-02'), 0, 'ne revient pas');
  assert.equal(materialize(s, '2026-11-03'), 0); // mardi
  assert.equal(materialize(s, '2026-11-04'), 1); // mercredi
  s.series[0].active = false; assert.equal(materialize(s, '2026-11-06'), 0);
  assert.equal(seriesDue({ days: [0], active: true }, '2026-11-01'), true);
  assert.equal(daysLabel([1, 2, 3, 4, 5]), 'Du lundi au vendredi');
  assert.equal(daysLabel([0, 1, 2, 3, 4, 5, 6]), 'Chaque jour');
  assert.equal(daysLabel([5, 1, 3]), 'lun, mer, ven');
});

test('temps mesuré par catégorie', () => {
  const s = defaultState();
  s.days['2026-11-02'] = { things: [{ cat: 'revision', done: true, real: 75 }, { cat: 'revision', done: false, spent: 15 * 60000 }, { cat: 'corps', done: false, startedAt: 1000, spent: 0 }], journal: '', mood: null };
  assert.deepEqual(timeByCat(s, ['2026-11-02'], 1000 + 30 * 60000), { revision: 90, corps: 30 });
  assert.equal(fmtMin(45), '45 min'); assert.equal(fmtMin(90), '1 h 30'); assert.equal(fmtMin(120), '2 h');
});

test('moments adaptatifs : une chose de pont dont le moment est passé glisse au moment en cours', async () => {
  const { reslot, slotAt } = await import('../js/model.js');
  const s = { days: { d: { things: [
    { title: 'A', slot: 'matin', slotAuto: true, done: false },
    { title: 'B', slot: 'matin', done: false },
    { title: 'C', slot: 'soir', slotAuto: true, done: false },
    { title: 'D', slot: 'matin', slotAuto: true, done: true },
  ] } } };
  assert.equal(slotAt(9), 'matin'); assert.equal(slotAt(15), 'aprem'); assert.equal(slotAt(20), 'soir');
  assert.equal(reslot(s, 'd', 10), 0);
  assert.equal(reslot(s, 'd', 15), 1);
  assert.deepEqual(s.days.d.things.map((t) => t.slot), ['aprem', 'matin', 'soir', 'matin']);
  assert.equal(reslot(s, 'd', 19), 1);
  assert.equal(s.days.d.things[0].slot, 'soir');
});

import { organize, observe } from '../js/model.js';
test('Ernest organisateur : habitude du jour, série proposée, charge, moment', () => {
  const st = { days: {}, list: [], ideas: [], goals: [], series: [], settings: { minimums: {}, minimumsFrom: '2099-01-01' } };
  // « Courir » fait les mardis 13, 20, 27 oct. au matin
  for (const k of ['2026-10-13', '2026-10-20', '2026-10-27']) st.days[k] = { things: [{ id: k, title: 'Courir', cat: 'corps', done: true, doneAt: k + 'T07:30:00', real: 30 }] };
  const k = '2026-11-03'; // un mardi
  st.days[k] = { things: [] };
  const r = organize(st, k, { max: 9 });
  assert.ok(r.some((x) => x.kind === 'habit' && x.title === 'Courir' && x.slot === 'matin'), 'habitude du mardi matin');
  assert.ok(r.some((x) => x.kind === 'series' && x.days.includes(2)), 'série proposée sur le mardi');
  st.days[k].things = Array.from({ length: 6 }, (_, i) => ({ id: 'x' + i, title: 'T' + i, cat: 'perso', done: false }));
  assert.ok(organize(st, k, { max: 9 }).some((x) => x.kind === 'load'), 'charge signalée au-delà de 5');
  st.days[k].things = [{ id: 'c', title: 'Gainage', cat: 'corps', done: false }];
  assert.ok(organize(st, k, { max: 9 }).some((x) => x.kind === 'slot' && x.slot === 'matin'), 'moment habituel de la catégorie');
  assert.equal(organize(st, k, { max: 9, dismissed: { [`hab:courir:${k}`]: 1 } }).some((x) => x.kind === 'habit' && x.title === 'Courir'), false, 'une proposition refusée ne revient pas');
  assert.equal(observe(st, k)[0].n, 3);
});

import { smallProposals } from '../js/model.js';
test('équilibre des serres : la Liste compte pour Vie perso, une petite chose proposée dans la serre en retard', () => {
  const s = defaultState();
  s.list.push({ id: 'l1', text: 'Courses', done: true, doneAt: '2026-11-03T18:00:00Z' }, { id: 'l2', text: 'Rendre le colis', done: false });
  s.days['2026-11-03'] = { things: [{ id: 'a', title: 'Session', cat: 'travail', done: true }, { id: 'b', title: 'Marche', cat: 'bienetre', done: true }, { id: 'c', title: 'Étirements', cat: 'bienetre', done: true }] };
  assert.equal(catCounts(s, ['2026-11-03']).perso, 1); // la course cochée, sans catégorie
  const p = smallProposals(s, '2026-11-04');
  assert.equal(p[0].cat, 'perso'); // 1 perso contre 2 bien-être
  assert.ok(p.some((o) => o.title === 'Rendre le colis' && o.fromList === 'l2'));
  assert.ok(p.some((o) => o.cat === 'bienetre'));
  s.days['2026-11-04'] = { things: [{ id: 'd', title: 'Rendre le colis', cat: 'perso', done: false }] };
  assert.ok(!smallProposals(s, '2026-11-04').some((o) => o.title === 'Rendre le colis')); // déjà posée
  const h = hydrate({ ...defaultState(), garden: { plants: [{ id: 'm', cat: 'perso', day: '2026-11-01', seed: 1, kind: 'moss' }], objects: [] } });
  assert.equal(h.garden.plants.length, 0); assert.equal(h.garden.cans[0].cat, 'perso'); // ancien pot → arrosoir
});
