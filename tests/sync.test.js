import { test } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { defaultState } = await import('../js/store.js');
const SY = await import('../js/sync.js');

// Serveur minimal, mêmes règles que le Worker de Dec-Deonto (révision, If-Match, ponts)
function server() {
  const kv = new Map(); let n = 0;
  const res = (status, body = null, headers = {}) => ({ status, ok: status >= 200 && status < 300, headers: { get: (k) => headers[k] ?? null }, text: async () => body, json: async () => JSON.parse(body) });
  const f = async (url, o = {}) => {
    const path = new URL(url).pathname; const h = o.headers || {};
    if (h.Authorization !== 'Bearer s') return res(401);
    if (path === '/ponts') return res(200, JSON.stringify(Object.fromEntries([...kv].filter(([k]) => k.startsWith('pont:')).map(([k, v]) => [k.slice(5), JSON.parse(v.value)]))));
    const key = path.slice(1); const cur = kv.get(key);
    if ((o.method || 'GET') === 'GET') return cur ? res(200, cur.value, { 'X-Rev': cur.rev }) : res(204);
    if (h['If-Match'] !== undefined && h['If-Match'] !== (cur ? cur.rev : '')) return res(412);
    const rev = `r${++n}`; kv.set(key, { value: o.body, rev }); return res(200, JSON.stringify({ rev }), { 'X-Rev': rev });
  };
  return { kv, f };
}
const cfg = { url: 'https://x.workers.dev', token: 's' };
const T = '2026-11-03';

// Un appareil : son état et sa mémoire de synchro, comme dans app.js
function device(f, state) {
  const d = { S: state, m: { rev: null, dirty: true } };
  d.sync = async () => {
    const r = await SY.pull(cfg, d.S, d.m, T, { fetch: f });
    if (r.state !== d.S) d.S = r.state;
    let rev = r.rev; if (r.needPush) rev = await SY.push(cfg, d.S, r.rev, { fetch: f });
    d.m = { rev, dirty: false }; return r;
  };
  d.edit = (fn) => { fn(d.S); d.S.updatedAt = (d.S.updatedAt || 0) + 1000; d.m.dirty = true; };
  return d;
}

test('téléphone puis ordinateur : le second reprend l’état du premier, puis chacun suit l’autre', async () => {
  const { f } = server();
  const phone = device(f, { ...defaultState(), updatedAt: 10, list: [{ id: 'a', text: 'Colis', done: false }] });
  await phone.sync();
  const pc = device(f, { ...defaultState(), updatedAt: 99 }); // appareil neuf, plus récent mais vide
  const r = await pc.sync();
  assert.equal(r.first, true); assert.equal(r.adopted, true);
  assert.deepEqual(pc.S.list.map((x) => x.text), ['Colis']);
  pc.edit((s) => s.list.push({ id: 'b', text: 'Voiture', done: false }));
  await pc.sync();
  const back = await phone.sync();
  assert.equal(back.adopted, true); assert.equal(back.conflict, false);
  assert.deepEqual(phone.S.list.map((x) => x.text), ['Colis', 'Voiture']);
  phone.edit((s) => { s.list = s.list.filter((x) => x.id !== 'a'); }); // une suppression n'est pas ressuscitée
  await phone.sync(); await pc.sync();
  assert.deepEqual(pc.S.list.map((x) => x.text), ['Voiture']);
});

test('modifié des deux côtés : la version la plus récente gagne, signalé comme conflit', async () => {
  const { f } = server();
  const a = device(f, { ...defaultState(), updatedAt: 1 }); await a.sync();
  const b = device(f, { ...defaultState(), updatedAt: 1 }); await b.sync();
  a.edit((s) => s.ideas.push({ id: 'i1', text: 'A' })); await a.sync();
  b.edit((s) => s.ideas.push({ id: 'i2', text: 'B' })); b.S.updatedAt = a.S.updatedAt + 5000;
  const r = await b.sync();
  assert.equal(r.adopted, false); assert.equal(r.needPush, true);
  assert.deepEqual(b.S.ideas.map((x) => x.text), ['B']);
  const ra = await a.sync();
  assert.equal(ra.adopted, true); assert.deepEqual(a.S.ideas.map((x) => x.text), ['B']);
});

test('plan déposé par Deonto : ajouté une fois, jamais remis après suppression', async () => {
  const { kv, f } = server();
  const pont = { v: 1, src: 'deonto', things: [{ title: 'Déonto · Session', cat: 'revision', est: 20, day: T }, { title: 'Déonto · Schéma', day: T }], goals: [{ title: 'Épreuve 1', due: '2026-11-10', milestones: ['Examen blanc QCM'] }], history: [{ day: '2026-11-01', n: 2 }] };
  kv.set('pont:deonto', { value: JSON.stringify(pont), rev: 'p1' });
  const d = device(f, { ...defaultState(), updatedAt: 1 });
  const r = await d.sync();
  assert.deepEqual(r.bridged.map((x) => [x.src, x.things]), [['deonto', 2]]);
  assert.equal(d.S.days[T].things.length, 2);
  assert.equal(d.S.garden.plants.filter((p) => p.src === 'deonto').length, 2);
  assert.equal((await d.sync()).bridged.length, 0, 'même plan : rien de plus');
  d.edit((s) => { s.days[T].things = s.days[T].things.filter((t) => t.title !== 'Déonto · Schéma'); });
  kv.set('pont:deonto', { value: JSON.stringify({ ...pont, things: [...pont.things, { title: 'Déonto · Jeu', day: T }] }), rev: 'p2' });
  const r2 = await d.sync();
  assert.deepEqual(r2.bridged.map((x) => x.things), [1]);
  assert.deepEqual(d.S.days[T].things.map((t) => t.title).sort(), ['Déonto · Jeu', 'Déonto · Session']);
});

test('réglages : adresse https exigée ; code refusé signalé', async () => {
  assert.equal(SY.normalizeUrl('https://x.workers.dev/ernest/'), 'https://x.workers.dev');
  assert.equal(SY.normalizeUrl('http://x'), null);
  const { f } = server();
  await assert.rejects(SY.pull({ ...cfg, token: 'faux' }, defaultState(), { rev: null, dirty: true }, T, { fetch: f }), /code secret/);
});

test('recevoir à nouveau : le plan du jour revient, même supprimé', async () => {
  const { forgetDay } = await import('../js/bridge.js');
  const { kv, f } = server();
  kv.set('pont:deonto', { value: JSON.stringify({ v: 1, src: 'deonto', things: [{ title: 'Déonto · Session', day: T }], goals: [] }), rev: 'p1' });
  const d = device(f, { ...defaultState(), updatedAt: 1 });
  await d.sync();
  d.edit((s) => { s.days[T].things = []; });
  assert.equal((await d.sync()).bridged.length, 0);
  forgetDay(d.S, T); d.m.dirty = true;
  const r = await d.sync();
  assert.deepEqual(r.bridged.map((x) => x.things), [1]);
  assert.deepEqual(d.S.days[T].things.map((t) => t.title), ['Déonto · Session']);
});
