import { test } from 'node:test';
import assert from 'node:assert/strict';
import { merge3 } from '../js/merge.js';

const T = '2026-11-03';
const st = (things, extra = {}) => ({ updatedAt: 1, days: { [T]: { things } }, list: [], garden: { plants: [] }, ...extra });
const th = (id, o = {}) => ({ id, title: id, done: false, real: 0, doneAt: null, ...o });

test('sans base : tout est réuni, « fait » l’emporte même sur une version plus récente', () => {
  const l = st([th('a'), th('b')], { updatedAt: 9 });
  const r = st([th('a', { done: true, doneAt: 'X', real: 5 }), th('c')], { updatedAt: 2 });
  const m = merge3(null, l, r);
  assert.deepEqual(m.days[T].things.map((t) => [t.id, t.done, t.doneAt, t.real]), [['a', true, 'X', 5], ['b', false, null, 0], ['c', false, null, 0]]);
  assert.equal(m.updatedAt, 9);
});
test('avec base : suppressions et changements d’un seul côté repris, conflit à la plus récente', () => {
  const b = st([th('a'), th('b'), th('c')], { list: [{ id: 'l1', text: 'Colis' }] });
  const l = st([th('a', { title: 'A ici' }), th('c')], { updatedAt: 5, list: [{ id: 'l1', text: 'Colis !' }] });
  const r = st([th('a'), th('b', { done: true }), th('c', { title: 'C là-bas' })], { updatedAt: 3, list: [{ id: 'l1', text: 'Colis ?' }] });
  const m = merge3(b, l, r);
  assert.deepEqual(m.days[T].things.map((t) => [t.title, t.done]), [['A ici', false], ['C là-bas', false], ['b', true]], 'b supprimé ici mais coché là-bas : gardé');
  assert.equal(m.list[0].text, 'Colis !');
  const m2 = merge3(b, st([th('a'), th('c')], { updatedAt: 5 }), st([th('a'), th('b'), th('c')], { updatedAt: 3 }));
  assert.deepEqual(m2.days[T].things.map((t) => t.id), ['a', 'c'], 'suppression non ressuscitée');
});
test('tableaux sans identifiant : réunis, retraits d’un côté repris', () => {
  const b = { updatedAt: 1, bridges: { deonto: { days: { [T]: ['A'] } } } };
  const m = merge3(b, { updatedAt: 2, bridges: { deonto: { days: { [T]: ['A', 'B'] } } } }, { updatedAt: 3, bridges: { deonto: { days: { [T]: ['A', 'C'] } } } });
  assert.deepEqual(m.bridges.deonto.days[T], ['A', 'B', 'C']);
});
