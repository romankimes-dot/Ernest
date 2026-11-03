import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Le village 3D n'est pas testable sans navigateur : on vérifie au moins que chaque type de pièce utilisé
// (boxAt, ibPut) a été défini (ibDef). Un commentaire mal placé avait avalé « brick » et plantait toute la 3D.
test('village 3D : chaque pièce utilisée est définie', () => {
  const src = readFileSync('js/garden3d.js', 'utf8').split('\n').map((l) => l.replace(/\s\/\/\s.*$/, '')).join('\n');
  const defined = new Set([...src.matchAll(/ibDef\('(\w+)'/g)].map((m) => m[1]));
  const used = new Set([...src.matchAll(/(?:boxAt|ibPut)\('(\w+)'/g)].map((m) => m[1]));
  for (const k of used) assert.ok(defined.has(k), `pièce « ${k} » utilisée mais jamais définie`);
});
