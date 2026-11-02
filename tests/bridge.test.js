import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode, merge, linkFor } from '../js/bridge.js';
import { defaultState } from '../js/store.js';

const payload = { v: 1, src: 'deonto', things: [{ title: 'Révision · Plan du jour', cat: 'revision', est: 75, link: 'https://x/', day: '2026-11-03' }], goals: [{ title: 'Épreuve 1', due: '2026-11-10', milestones: ['Examen blanc QCM', { text: 'Veille légère', done: false }] }] };

test('aller-retour base64url, accents compris', () => {
  const e = encode(payload);
  assert.ok(!/[+/=]/.test(e));
  assert.deepEqual(decode(e), payload); assert.deepEqual(decode(encode({ ...payload, history: [{ day: '2026-10-30', n: 2 }] })).history, [{ day: '2026-10-30', n: 2 }]);
  assert.deepEqual(decode(`https://romankimes-dot.github.io/Ernest/#import=${e}`), payload);
  assert.deepEqual(decode(JSON.stringify(payload)), payload);
  assert.equal(decode('n importe quoi'), null);
  assert.ok(linkFor(payload).startsWith('https://romankimes-dot.github.io/Ernest/#import='));
});
test('fusion sans doublon', () => {
  const s = defaultState();
  let r = merge(s, payload, '2026-11-03');
  assert.deepEqual(r, { things: 1, goals: 1, milestones: 2 });
  r = merge(s, payload, '2026-11-03');
  assert.deepEqual(r, { things: 0, goals: 0, milestones: 0 });
  assert.equal(s.days['2026-11-03'].things.length, 1);
  assert.equal(s.goals[0].milestones.length, 2);
  merge(s, { ...payload, goals: [{ title: 'Épreuve 1', milestones: [{ text: 'Veille légère', done: true }] }] }, '2026-11-03');
  assert.equal(s.goals[0].milestones[1].done, true);
  assert.ok(s.bridges.deonto.last);
});

test('moment proposé par le pont : appliqué aux choses déjà reçues sans moment', () => {
  const s = defaultState();
  merge(s, { v: 1, src: 'deonto', things: [{ title: 'A', day: '2026-11-03' }], goals: [] }, '2026-11-03');
  assert.equal(s.days['2026-11-03'].things[0].slot, null);
  merge(s, { v: 1, src: 'deonto', things: [{ title: 'A', day: '2026-11-03', slot: 'matin' }, { title: 'B', day: '2026-11-03', slot: 'soir' }], goals: [] }, '2026-11-03');
  assert.deepEqual(s.days['2026-11-03'].things.map((t) => [t.title, t.slot]), [['A', 'matin'], ['B', 'soir']]);
  s.days['2026-11-03'].things[0].slot = 'midi';
  merge(s, { v: 1, src: 'deonto', things: [{ title: 'A', day: '2026-11-03', slot: 'soir' }], goals: [] }, '2026-11-03');
  assert.equal(s.days['2026-11-03'].things[0].slot, 'midi', 'choix fait dans Ernest gardé');
});
