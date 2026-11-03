// Page de présentation (decouvrir.html) : serre 3D en direct au soir, mini-démo, cartes, jour/nuit, graines dorées.
const $ = (s) => document.querySelector(s);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Répliques d'Ernest (les vraies, sans variables ni conditions) ----------
let LINES = [];
const FALLBACK = {
  touche: ["Un gobelin bien rangé, c'est un gobelin qui a fini d'arroser.", 'La bouilloire est sur le feu. Elle siffle faux, je l\'aime quand même.'],
  coche: ['Une de faite. Je la plante tout de suite.'],
  derniere: ["Et de trois. Le reste de la journée est en jachère, c'est bon pour la terre."],
  reporte: ['Demain, alors. La terre attend, elle a l\'habitude.'],
  trouvaille: ["Tiens, une graine qui brille. Il y en a d'autres, j'en suis presque sûr."],
};
const usable = (l) => !l.t.includes('{') && (!l.when || Object.keys(l.when).every((k) => k === 'three'));
function line(ctxs, key, last) {
  const pool = LINES.filter((l) => ctxs.includes(l.ctx) && usable(l) && l.t !== last).map((l) => l.t);
  return pool.length ? rnd(pool) : rnd(FALLBACK[key]);
}
fetch('./data/ernest/repliques.json').then((r) => r.json()).then((d) => { LINES = Array.isArray(d) ? d : []; }).catch(() => {});

function say(el, text) { el.textContent = text; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function hop(btn) { btn.classList.remove('hop'); void btn.offsetWidth; btn.classList.add('hop'); }

// ---------- 1. Accueil : Ernest et la serre 3D ----------
const heroBubble = $('#heroBubble');
let lastHero = '';
$('#heroErnest').addEventListener('click', (e) => { hop(e.currentTarget); lastHero = line(['ernest.touche', 'manies', 'lieu.chaumiere'], 'touche', lastHero); say(heroBubble, lastHero); });

async function serre3d() {
  const canvas = $('#serre');
  let G, mod;
  try { mod = await import('./garden3d.js'); G = mod.default; if (!mod.webglOk()) return; } catch { return; }
  const { HOUSE_OF, HOUSE_IDS, SLOTS_PER_HOUSE } = mod;
  // Serre « un an » : la plus fournie (mêmes données fictives que la démonstration serre3d.html, stade 4)
  const CATS = ['travail', 'bienetre', 'perso'], n = 250;
  const all = Array.from({ length: Math.min(n, 3 * SLOTS_PER_HOUSE) }, (_, i) => ({ id: 'd' + i, cat: CATS[(i * 7 + (i >> 2)) % 3], seed: 1000 + i * 7919, g: Math.min(1, 0.4 + (n - i) / 40) }));
  const BONSAI = { travail: [[77, 6], [78, 3]], bienetre: [[91, 5]], perso: [[55, 4]] };
  const houses = {};
  for (const id of HOUSE_IDS) {
    const plants = all.filter((p) => HOUSE_OF[p.cat] === id).slice(-SLOTS_PER_HOUSE), hn = Math.round(n * plants.length / Math.max(1, all.length));
    houses[id] = { n: hn, plants, moss: plants.length ? 600 : 0, vine: Math.min(1, hn / 80), hanging: [8, 25, 50].filter((k) => hn >= k).length, bonsai: (BONSAI[id] || []).map(([seed, branches]) => ({ seed, branches })) };
  }
  try {
    G.mount(canvas, { mode: 'full' });
    G.setModel({ houses, shrooms: false, path: 1, beds: [1, 0.9, 0.8, 1, 0.7, 0.9], flowers: 0.95, mood: 4 });
    G.setTime('dusk');
    G.setErnest('salue');
  } catch { return; }
  const c = G.controls, touch = matchMedia('(pointer: coarse)').matches;
  c.enableZoom = false; c.enablePan = false;
  c.enabled = !touch; // téléphone : le doigt fait défiler la page, la caméra tourne seule
  canvas.style.touchAction = 'pan-y';
  c.autoRotate = !reduced; c.autoRotateSpeed = 0.35;
  G.onPick((p) => {
    const ctx = p.kind === 'sign' ? ['lieu.' + p.house] : p.kind === 'cottage' ? ['lieu.chaumiere'] : p.kind === 'plant' || p.kind === 'bonsai' ? ['arrosage'] : ['ernest.touche', 'manies'];
    if (p.kind === 'plant') G.water();
    lastHero = line(ctx, 'touche', lastHero); say(heroBubble, lastHero);
  });
  setTimeout(() => canvas.classList.add('on'), 900);
}
serre3d();

// ---------- 2. Mini-démo : cocher remplit un arrosoir, le verser fait passer un stade à la monstera ----------
const cans = [...document.querySelectorAll('#cans .can')], pot = $('#bigPot'), stageEl = $('#stage'), playBubble = $('#playBubble'), playImg = $('#playImg'), playBtn = $('#playErnest');
const done = [false, false, false], STAGES = ['Graine', 'Pousse', 'Plante', 'Grande'];
let full = 0, poured = 0, poseT = 0, lastPlay = '';
function burst(el, colors = ['#6cbb74', '#8fc98f', '#5fae6d', '#f2b23d']) {
  if (reduced) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('i'); s.className = 'leaf';
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
    s.style.left = r.left + r.width / 2 + 'px'; s.style.top = r.top + r.height * 0.3 + 'px';
    s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d - 40 + 'px'); s.style.setProperty('--r', Math.random() * 540 + 'deg');
    s.style.background = rnd(colors);
    document.body.appendChild(s); setTimeout(() => s.remove(), 1700);
  }
}
const pose = (img, ms = 1800) => { playImg.src = img; clearTimeout(poseT); poseT = setTimeout(() => { playImg.src = './img/ernest-salue.jpg'; }, ms); };
function paint() {
  cans.forEach((c, i) => { c.classList.toggle('full', i < full); c.classList.toggle('used', i >= full && i < full + poured); });
  pot.dataset.stage = poured; pot.classList.toggle('ready', full > 0);
  stageEl.textContent = `${STAGES[poured]} · ${poured} arrosage${poured > 1 ? 's' : ''}${full ? ' · touche le pot pour verser' : poured === 3 ? ' · à vingt, la pleine terre' : ''}`;
}
document.querySelectorAll('#todo .t').forEach((b) => b.addEventListener('click', () => {
  const i = Number(b.dataset.i); done[i] = !done[i];
  b.classList.toggle('done', done[i]); b.setAttribute('aria-pressed', done[i]);
  if (done[i]) { full++; lastPlay = full + poured === 3 ? line(['coche.derniere'], 'derniere', lastPlay) : line(['coche'], 'coche', lastPlay); pose('./img/ernest-arrose.jpg'); setTimeout(() => burst(cans[Math.min(2, full + poured - 1)], ['#9fd0f0', '#cfe8f2', '#6aa8d8']), 250); }
  else { if (full > 0) full--; lastPlay = line(['reporte', 'laisse'], 'reporte', lastPlay); }
  paint(); say(playBubble, lastPlay); hop(playBtn);
}));
pot.addEventListener('click', () => {
  if (!full) { say(playBubble, poured === 3 ? 'Elle a eu ses trois arrosoirs. Dans l’app, à vingt, elle part en pleine terre.' : 'Pas d’arrosoir plein. Coche d’abord une case.'); hop(playBtn); return; }
  full--; poured++; paint(); pose('./img/ernest-arrose.jpg', 2200); burst(pot, ['#9fd0f0', '#cfe8f2']); setTimeout(() => burst(pot), 450);
  const st = STAGES[poured].toLowerCase(), pool = LINES.filter((l) => l.ctx === 'flore.stade').map((l) => l.t);
  const t = pool.length ? rnd(pool).replace(/\{espece\}/g, 'la monstera').replace(/\{stade\}/g, st) : `La monstera passe au stade ${st}.`;
  lastPlay = t.charAt(0).toUpperCase() + t.slice(1); say(playBubble, lastPlay); hop(playBtn);
});
paint();
playBtn.addEventListener('click', () => { hop(playBtn); lastPlay = line(['ernest.touche', 'manies'], 'touche', lastPlay); say(playBubble, lastPlay); });

// ---------- 3. Carrousel des cartes ----------
const DECKS = { profession: 'Profession', botanique: 'Botanique', feuilleton: 'Feuilleton', blagues: 'Blague', tips: 'Pratique' };
const ICONS = {
  profession: '<svg class="ic" viewBox="0 0 48 48" fill="none" stroke="#e3b46a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8h22a4 4 0 0 1 4 4v28H16a4 4 0 0 1-4-4z"/><path d="M12 36a4 4 0 0 1 4-4h22M19 16h12M19 22h12"/></svg>',
  botanique: '<svg class="ic" viewBox="0 0 48 48" fill="none" stroke="#8fc98f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 38C10 20 22 10 40 8c0 18-10 30-28 30"/><path d="M10 38 28 20"/></svg>',
  feuilleton: '<svg class="ic" viewBox="0 0 48 48" fill="none" stroke="#f2b23d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h12M24 6v4M16 14h16l2 22H14z"/><path d="M14 36h20v4H14z"/><path d="M24 20c-3 3-3 7 0 9 3-2 3-6 0-9z" fill="#f2b23d" opacity=".6"/></svg>',
  blagues: '<svg class="ic" viewBox="0 0 48 48" fill="none" stroke="#e98a8a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 24a16 12 0 0 1 32 0z"/><path d="M19 24v12a5 5 0 0 0 10 0V24"/><circle cx="17" cy="18" r="2" fill="#e98a8a"/><circle cx="28" cy="15" r="2" fill="#e98a8a"/><circle cx="33" cy="20" r="1.5" fill="#e98a8a"/></svg>',
  tips: '<svg class="ic" viewBox="0 0 48 48" fill="none" stroke="#8fc0cf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 34h12M20 40h8M24 6a11 11 0 0 0-6 20c1 1 2 3 2 5h8c0-2 1-4 2-5a11 11 0 0 0-6-20z"/></svg>',
};
const srcTxt = (s) => String(s || '').replace(/https?:\/\/(?:www\.)?([^/\s]+)\S*/g, '$1'); // une URL longue déborde : le domaine suffit
const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function split(card, deck) {
  const tx = card.texte || '';
  if (card.titre) return { title: card.titre, teaser: firstSentence(tx) };
  const m = tx.match(/^(.+?[.!…])\s+(.+)$/s); // blague sans titre : la chute au dos du recto
  return m ? { title: m[1], teaser: m[2] } : { title: DECKS[deck], teaser: tx };
}
function firstSentence(t) { const m = t.match(/^(.{20,140}?[.!…])\s/); return m ? m[1] : t.slice(0, 120) + (t.length > 120 ? '…' : ''); }
function cardHTML(deck, card, rare) {
  const { title, teaser } = split(card, deck);
  const k = deck === 'feuilleton' && card.ep ? `Feuilleton · ép. ${card.ep}` : DECKS[deck];
  return `<div class="in"><div class="f">${rare ? '<span class="rare">Rare</span>' : ''}<span class="k">${esc(k)}</span><h3>${esc(title)}</h3><p>${esc(teaser)}</p>${ICONS[deck]}</div>`
    + `<div class="b"><span class="k">${esc(k)}</span><h3>${esc(title)}</h3><p>${esc(card.texte)}</p>${card.source && card.fiabilite === 'sourcee' ? `<p class="src">${esc(srcTxt(card.source))}</p>` : ''}</div></div>`;
}
const DATA = {};
async function loadDeck(d) { if (!DATA[d]) { try { DATA[d] = await (await fetch(`./data/cartes/${d}.json`)).json(); } catch { DATA[d] = []; } } return DATA[d]; }
async function cards() {
  const track = $('#track'), dots = $('#dots');
  await Promise.all(Object.keys(DECKS).map(loadDeck));
  const pick = (d, f = () => true) => rnd(DATA[d].filter(f)) || DATA[d][0];
  const list = [
    ['profession', DATA.profession.find((c) => /1494/.test(c.titre || '')) || pick('profession')],
    ['botanique', pick('botanique')],
    ['feuilleton', DATA.feuilleton.find((c) => c.ep === 1) || pick('feuilleton'), true],
    ['blagues', pick('blagues')],
    ['tips', pick('tips')],
  ].filter(([, c]) => c);
  track.innerHTML = list.map(([d, c, r]) => `<button class="card c-${d}">${cardHTML(d, c, r)}</button>`).join('')
    + '<button class="card c-mystere" id="mystere"><div class="in"><div class="f"><span class="q">?</span><small>Tape pour retourner</small></div><div class="b"></div></div></button>';
  const myst = $('#mystere');
  track.addEventListener('click', (e) => {
    const c = e.target.closest('.card'); if (!c) return;
    if (c === myst && !myst.dataset.deck) { // la carte mystère : une carte tirée au hasard, à chaque fois différente
      const d = rnd(['botanique', 'blagues', 'tips', 'profession']); const card = pick(d);
      myst.dataset.deck = d; myst.className = `card c-${d} spin`; myst.innerHTML = cardHTML(d, card); // révélée d'un tour, recto visible
      return;
    }
    c.classList.toggle('flip');
  });
  const n = track.children.length;
  dots.innerHTML = '<i></i>'.repeat(n);
  const upd = () => { const w = track.children[0].getBoundingClientRect().width + 18, i = Math.round(track.scrollLeft / w); [...dots.children].forEach((d, j) => d.classList.toggle('on', j === Math.min(n - 1, i))); };
  track.addEventListener('scroll', upd, { passive: true }); upd();
  const step = (s) => track.scrollBy({ left: s * (track.children[0].getBoundingClientRect().width + 18), behavior: 'smooth' });
  $('#prev').onclick = () => step(-1); $('#next').onclick = () => step(1);
}
cards();

// ---------- 4. Le soir tombe ----------
{
  const r = $('#dnRange'), night = $('#night'), handle = $('#handle');
  const set = () => { const v = Number(r.value); night.style.clipPath = `inset(0 0 0 ${v}%)`; handle.style.left = v + '%'; };
  r.addEventListener('input', set); set();
}

// ---------- 5. Graines dorées ----------
let found = 0;
const toast = $('#toast'), hud = $('#hud');
let toastT = 0;
function showToast(t) { toast.textContent = t; toast.hidden = false; toast.style.animation = 'none'; void toast.offsetWidth; toast.style.animation = ''; clearTimeout(toastT); toastT = setTimeout(() => { toast.hidden = true; }, 3600); }
let rare = null;
async function openRare() {
  if (!rare) {
    const prof = (await loadDeck('profession')).filter((c) => c.rarete === 'longue');
    const feu = (await loadDeck('feuilleton')).filter((c) => c.ep > 1);
    const pool = [...prof.map((c) => ['profession', c]), ...feu.map((c) => ['feuilleton', c])];
    rare = rnd(pool) || ['profession', { titre: 'Venise, 1494', texte: 'Pacioli publie la règle qui t\'occupe encore : tout débit a son crédit.' }];
  }
  const [d, c] = rare;
  $('#rareK').textContent = d === 'feuilleton' ? `Feuilleton · ép. ${c.ep}` : DECKS[d];
  $('#rareT').textContent = c.titre || DECKS[d]; $('#rareX').textContent = c.texte; $('#rareS').textContent = c.fiabilite === 'sourcee' ? srcTxt(c.source) : '';
  $('#rareScroll').scrollTop = 0;
  const dlg = $('#rareDlg'); if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}
function huntText() {
  const left = 3 - found;
  $('#huntTitle').textContent = left === 0 ? 'Les trois. La carte rare est à toi.' : `Il en manque ${['', 'une', 'deux', 'trois'][left]}.`;
  $('#huntSub').textContent = left === 0 ? 'Ernest les a déjà mises en terre.' : 'Trois graines dorées sont cachées sur cette page.';
  [...$('#counter').children].forEach((x, i) => x.classList.toggle('on', i < found));
  $('#hudN').textContent = `${found}/3`; hud.hidden = found === 0;
  $('#rareAgain').hidden = left !== 0;
}
document.querySelectorAll('.seed').forEach((s) => s.addEventListener('click', () => {
  if (s.classList.contains('got')) return;
  s.classList.add('got'); found++; huntText();
  if (found < 3) showToast(line(['trouvaille'], 'trouvaille'));
  else { toast.hidden = true; setTimeout(openRare, 600); }
}));
$('#rareAgain').addEventListener('click', openRare);
huntText();
