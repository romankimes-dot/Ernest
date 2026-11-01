import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const CTX = ['ouverture.matin', 'ouverture.midi', 'ouverture.soir', 'ouverture.nuit', 'coche', 'coche.derniere', 'demarre', 'retour', 'idee', 'liste', 'laisse', 'reporte', 'dimanche', 'rituel.debut', 'rituel.fin', 'jmoins', 'apres-examen', 'semaine-grise', 'manies', 'premiere.ouverture'];
const BAD = [/\btu devrais\b/i, /\bil faut que tu\b/i, /\bbravo\b/i, /\bdommage\b/i, /\bça va aller\b/i, /\?\s*$/];

test('répliques : JSON valide, tous les contextes servis, ton respecté', { skip: !existsSync('data/ernest/repliques.json') && 'pas encore écrites' }, () => {
  const lines = JSON.parse(readFileSync('data/ernest/repliques.json', 'utf8'));
  assert.ok(Array.isArray(lines) && lines.length >= 300, `${lines.length} répliques`);
  for (const c of CTX) assert.ok(lines.filter((l) => l.ctx === c).length >= 10, `contexte ${c} trop pauvre`);
  const seq = lines.filter((l) => l.ctx === 'premiere.ouverture').map((l) => l.seq).sort((a, b) => a - b);
  for (let i = 1; i <= 10; i++) assert.ok(seq.includes(i), `premiere.ouverture seq ${i}`);
  const fautes = lines.filter((l) => BAD.some((re) => re.test(l.t))).map((l) => l.t);
  assert.deepEqual(fautes.slice(0, 5), [], `${fautes.length} répliques à reprendre (reproche, question ou évaluation)`);
  const texts = lines.map((l) => l.t); assert.equal(new Set(texts).size, texts.length, 'doublons');
});

test('cartes : format, sources obligatoires, feuilleton complet', () => {
  for (const f of ['botanique', 'profession', 'tips', 'blagues', 'encouragements', 'feuilleton']) {
    const p = `data/cartes/${f}.json`; if (!existsSync(p)) continue;
    const cards = JSON.parse(readFileSync(p, 'utf8'));
    assert.ok(Array.isArray(cards) && cards.length > 0, f);
    const ids = new Set();
    for (const c of cards) {
      assert.ok(c.id && c.texte && ['sourcee', 'aucune', 'fiction'].includes(c.fiabilite) && ['courante', 'longue', 'rare'].includes(c.rarete), `${f} ${c.id}`);
      assert.ok(!ids.has(c.id), `${f} id en double ${c.id}`); ids.add(c.id);
      if (c.fiabilite === 'sourcee') assert.ok(c.source && c.source.length > 8, `${f} ${c.id} sans source`);
    }
    if (f === 'feuilleton') { const eps = cards.map((c) => c.ep).sort((a, b) => a - b); for (let i = 1; i <= eps.length; i++) assert.equal(eps[i - 1], i, 'épisodes consécutifs'); }
  }
});
