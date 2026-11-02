// Fusion à trois de deux états d'Ernest modifiés chacun de leur côté depuis la dernière version commune (base).
// Ce qui n'a changé que d'un côté est repris ; ajouts des deux côtés gardés ; suppression reprise si l'autre côté n'a
// pas touché l'élément. Même valeur changée des deux côtés : la version la plus récente l'emporte, sauf « fait », qui
// l'emporte toujours (une chose cochée sur un appareil reste cochée). Sans base connue : tout est réuni.
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
const NONE = undefined;

// Tableau dont chaque élément porte un identifiant unique
function byId(arr) {
  if (!Array.isArray(arr)) return null;
  const m = new Map();
  for (const x of arr) { if (!isObj(x) || typeof x.id !== 'string' && typeof x.id !== 'number' || m.has(x.id)) return null; m.set(x.id, x); }
  return m;
}

function mergeVal(b, l, r, localWins, key) {
  if (same(l, r)) return l;
  if (b !== NONE && same(b, l)) return r;
  if (b !== NONE && same(b, r)) return l;
  if (isObj(l) && isObj(r)) return mergeObj(isObj(b) ? b : NONE, l, r, localWins);
  if (Array.isArray(l) && Array.isArray(r)) return mergeArr(Array.isArray(b) ? b : NONE, l, r, localWins);
  if (key === 'done' && (l === true || r === true)) return true;
  if (l === NONE) return r; if (r === NONE) return l;
  return localWins ? l : r;
}

function mergeObj(b, l, r, localWins) {
  const out = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
    const bv = b ? b[k] : NONE, lv = l[k], rv = r[k];
    if (lv === NONE || rv === NONE) {
      const v = lv === NONE ? rv : lv;
      if (b && bv !== NONE && same(bv, v)) continue; // supprimé d'un côté, pas touché de l'autre
      out[k] = v; continue;
    }
    out[k] = mergeVal(bv, lv, rv, localWins, k);
  }
  // Chose cochée d'un côté : l'heure et la durée viennent de ce côté-là
  if (out.done === true && !!l.done !== !!r.done) { const src = l.done ? l : r; for (const k of ['doneAt', 'real', 'spent', 'startedAt']) if (k in src) out[k] = src[k]; else delete out[k]; }
  return out;
}

function mergeArr(b, l, r, localWins) {
  const lm = byId(l), rm = byId(r), bm = b ? byId(b) : null;
  if (lm && rm && (!b || bm)) {
    const out = [];
    const take = (id, from) => {
      const lv = lm.get(id), rv = rm.get(id), bv = bm ? bm.get(id) : NONE;
      if (lv && rv) return out.push(mergeVal(bv, lv, rv, localWins));
      const v = lv || rv;
      if (bv && same(bv, v)) return; // supprimé de l'autre côté
      out.push(v);
    };
    for (const id of lm.keys()) take(id);
    for (const id of rm.keys()) if (!lm.has(id)) take(id);
    return out;
  }
  // Sans identifiants : on réunit (chaque élément une fois), sauf ce qui a été retiré d'un côté
  const bs = b ? new Set(b.map((x) => JSON.stringify(x))) : new Set();
  const ls = new Set(l.map((x) => JSON.stringify(x))), rs = new Set(r.map((x) => JSON.stringify(x)));
  const out = []; const seen = new Set();
  for (const [arr, other] of [[l, rs], [r, ls]]) for (const x of arr) {
    const s = JSON.stringify(x); if (seen.has(s)) continue; seen.add(s);
    if (!other.has(s) && bs.has(s)) continue;
    out.push(x);
  }
  return out;
}

// → nouvel état (local, remote et base ne sont pas modifiés)
export function merge3(base, local, remote) {
  const localWins = (Number(local.updatedAt) || 0) >= (Number(remote.updatedAt) || 0);
  const out = mergeObj(isObj(base) ? base : NONE, local, remote, localWins);
  out.updatedAt = Math.max(Number(local.updatedAt) || 0, Number(remote.updatedAt) || 0);
  return JSON.parse(JSON.stringify(out));
}
