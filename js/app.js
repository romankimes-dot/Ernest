// Ernest : interface. Quatre onglets (Aujourd'hui, Liste, Semaine, Carnet), réglages, rituel du soir, capture.
import * as store from './store.js';
import { timeByCat, fmtMin, materialize, daysLabel, seriesDue, DOW_SHORT, CATS, catOf, dayKey, addDays, dow, weekDays, isoWeek, uid, ensureDay, dayOf, doneOn, isActive, activeDays, totalDone, catCounts, estimate, moodAvg, moodLabel, jMinus, minimums, sortList, suggestions } from './model.js';
import { loadLines, env as ernestEnv, say, hourCtx, svg as ernestSvg, stateFor, plantName } from './ernest.js';
import { Garden } from './garden2d.js';
import { loadCards, allCards, cardById, drawShort, drawLong, drawRare, drawEpisode, FAMILLES } from './cards.js';
import { decode, merge } from './bridge.js';
import { icon } from './icons.js';

const VERSION = '0.7.0';
let S, today, tab = 'today', garden, g3d = null, bubbleT = null, carnetFam = 'all', listeFilter = 'todo';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Annuler la dernière action : on garde les états précédents des données (pas les répliques ni le carnet).
const UNDO = []; let lastKey = null, undoLabel = null, restoring = false;
const userKey = () => JSON.stringify([S.days, S.list, S.ideas, S.goals, S.weeks, S.garden, S.settings, S.milestones, S.series, S.seriesMade]);
const save = () => {
  const k = userKey();
  if (lastKey !== null && k !== lastKey && !restoring) { UNDO.push({ key: lastKey, label: undoLabel || 'la dernière action' }); if (UNDO.length > 30) UNDO.shift(); }
  lastKey = k; undoLabel = null; store.save(S); updateUndoBtn();
};
const label = (l) => { undoLabel = l; };
function updateUndoBtn() { const b = document.getElementById('btnUndo'); if (b) b.hidden = !UNDO.length; }
function undoLast() {
  const u = UNDO.pop(); if (!u) return;
  [S.days, S.list, S.ideas, S.goals, S.weeks, S.garden, S.settings, S.milestones, S.series, S.seriesMade] = JSON.parse(u.key);
  restoring = true; save(); restoring = false; closeSheet(); render(); setErnest();
  toast(`Annulé : ${u.label}.`);
}
const nowHour = () => new Date().getHours();
const BLOCKS = { matin: 'Matin', midi: 'Midi', aprem: 'Après-midi', soir: 'Soir' };
const slotLabel = (s) => (!s ? '' : BLOCKS[s] || s);
const blocksHtml = (slot) => `<div class="blocks">${Object.entries(BLOCKS).map(([k, v]) => `<button data-b="${k}" class="${slot === k ? 'on' : ''}">${v}</button>`).join('')}</div>`;
// Répétition : Non, chaque jour, en semaine, ou jours choisis
const repeatHtml = (days) => { const mode = !days || !days.length ? 'none' : days.length === 7 ? 'all' : days.length === 5 && [1, 2, 3, 4, 5].every((x) => days.includes(x)) ? 'week' : 'custom';
  return `<div class="kv rep"><label>Revient</label><div class="chips">${[['none', 'Une fois'], ['all', 'Chaque jour'], ['week', 'En semaine'], ['custom', 'Certains jours']].map(([k, v]) => `<button class="chip ${mode === k ? 'on' : ''}" data-rep="${k}">${v}</button>`).join('')}</div><div class="dows" ${mode === 'custom' ? '' : 'hidden'}>${[1, 2, 3, 4, 5, 6, 0].map((x) => `<button class="dow ${days && days.includes(x) ? 'on' : ''}" data-dow="${x}">${DOW_SHORT[x]}</button>`).join('')}</div></div>`; };
function bindRepeat(root, init) {
  let days = init ? [...init] : [];
  const dw = root.querySelector('.dows');
  root.querySelectorAll('[data-rep]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-rep]').forEach((x) => x.classList.toggle('on', x === b));
    const m = b.dataset.rep; days = m === 'none' ? [] : m === 'all' ? [0, 1, 2, 3, 4, 5, 6] : m === 'week' ? [1, 2, 3, 4, 5] : (days.length ? days : [dow(today)]);
    dw.hidden = m !== 'custom'; dw.querySelectorAll('[data-dow]').forEach((x) => x.classList.toggle('on', days.includes(Number(x.dataset.dow))));
  }));
  dw.querySelectorAll('[data-dow]').forEach((b) => b.addEventListener('click', () => { const v = Number(b.dataset.dow); days = days.includes(v) ? days.filter((x) => x !== v) : [...days, v]; b.classList.toggle('on', days.includes(v)); }));
  return () => days;
}
function saveSeries(t, days) {
  // crée ou met à jour la série d'une chose ; days vide = arrêter la série
  let se = t.seriesId ? S.series.find((x) => x.id === t.seriesId) : null;
  if (!days.length) { if (se) se.active = false; t.seriesId = null; return; }
  if (!se) { se = { id: uid(), start: today, active: true }; S.series.push(se); t.seriesId = se.id; S.seriesMade[`${se.id}|${today}`] = 1; }
  Object.assign(se, { title: t.title, cat: t.cat, est: t.est, slot: t.slot, days: [...days], active: true });
}
const MOMENTS = [['matin', 'Matin'], ['midi', 'Midi'], ['aprem', 'Après-midi'], ['soir', 'Soir'], [null, 'Dans la journée']];
const slotOrder = (s) => (!s ? 9 : BLOCKS[s] ? ['matin', 'midi', 'aprem', 'soir'].indexOf(s) * 100 + 50 : (parseInt(s, 10) || 0) * 10);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const fmtDay = (k) => new Date(k + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

// ---------- Démarrage ----------
async function init() {
  S = store.load(); today = dayKey(); if (materialize(S, today)) store.save(S); lastKey = userKey();
  S._light = moodAvg(S, today);
  garden = new Garden($('#garden')); gardenUpdate(); garden.start();
  setupGarden3d();
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  $('#fab').addEventListener('click', () => captureSheet(tab === 'liste' ? 'list' : tab === 'semaine' ? 'goal' : 'today'));
  $('#btnSettings').addEventListener('click', settingsSheet);
  $('#btnUndo').addEventListener('click', undoLast); updateUndoBtn();
  $('#sheetBg').addEventListener('click', closeSheet);
  $('#bulle').addEventListener('click', hideBubble);
  $('#ernestWrap').addEventListener('click', () => { const e = ernestEnv(S, today, plantNames()); bubble(say(S, 'manies', e) || '…'); save(); });
  await Promise.all([loadLines(), loadCards()]);
  for (const n of store.notices) toast(n.type === 'corrupt' ? 'Sauvegarde illisible gardée à part, repartie de la copie.' : 'Repris depuis la copie automatique.');
  render(); setErnest();
  greet();
  if (!S.ernest.tourSeen) setTimeout(() => tourSheet(0), 1200);
  $('#btnHelp').addEventListener('click', () => tourSheet(0));
  handleImport();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onReturn(); });
  window.addEventListener('hashchange', handleImport);
  setInterval(() => { if (tab === 'today') renderTimerOnly(); }, 30000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  pullToRefresh();
}

function onReturn() {
  const k = dayKey();
  if (k !== today) { today = k; if (materialize(S, today)) save(); S._light = moodAvg(S, today); gardenUpdate(); greet(); render(); return; }
  const running = dayOf(S, today).things.find((t) => t.startedAt && !t.done && t.link);
  if (running && Date.now() - running.startedAt > 3 * 60000 && !running._asked) { running._asked = true; const e = ernestEnv(S, today, plantNames()); bubble(say(S, 'retour', e) || 'Te revoilà.'); save(); doneSheet(running); }
  else greet();
  render();
}

// ---------- La serre : 3D si possible, 2D sinon ----------
function gardenUpdate() { garden.update(S, today); if (g3d) g3d.update(S, today); }
function gardenWater() { garden.water(); if (g3d) g3d.water(); }
async function setupGarden3d() {
  if (S.settings.garden3d === false) return;
  try {
    const mod = await import('./garden3d.js');
    if (!mod.webglOk()) return;
    const c = $('#garden3d'); c.hidden = false;
    g3d = mod.default; g3d.mount(c, { mode: 'band' }); g3d.update(S, today);
    $('#garden').hidden = true; garden.stop();
    c.addEventListener('click', openSerre);
    $('#serreClose').addEventListener('click', closeSerre);
  } catch (e) { g3d = null; $('#garden3d').hidden = true; $('#garden').hidden = false; garden.start(); }
}
function openSerre() {
  if (!g3d) return;
  const n = totalDone(S), pl = S.garden.plants.filter((p) => p.kind === 'plant').length;
  $('#sfCap').innerHTML = `<b>${pl} plante${pl > 1 ? 's' : ''}</b> · ${n} chose${n > 1 ? 's' : ''} faite${n > 1 ? 's' : ''}<br><span>Glisse pour tourner, pince pour approcher.</span>`;
  const f = $('#serreFull'); f.hidden = false; f.prepend($('#garden3d'));
  g3d.setMode('full');
}
function closeSerre() {
  $('#serre').prepend($('#garden3d')); $('#serreFull').hidden = true;
  if (g3d) g3d.setMode('band');
}

// ---------- Glisser vers le bas pour recharger ----------
// En haut de page, tirer vers le bas au-delà du seuil recharge l'app et va chercher une nouvelle version.
function pullToRefresh() {
  const ind = document.createElement('div'); ind.className = 'ptr'; ind.innerHTML = icon('refresh'); document.body.appendChild(ind);
  const TH = 70; let y0 = null, d = 0, busy = false;
  const reset = () => { ind.style.transition = 'transform .25s, opacity .25s'; ind.style.transform = 'translate(-50%, -48px)'; ind.style.opacity = '0'; ind.classList.remove('ready'); d = 0; };
  window.addEventListener('touchstart', (e) => {
    y0 = (busy || window.scrollY > 0 || !$('#sheet').hidden || !$('#serreFull').hidden || e.touches.length > 1) ? null : e.touches[0].clientY;
    ind.style.transition = 'none';
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    if (window.scrollY > 0) { y0 = null; reset(); return; }
    d = Math.max(0, Math.min((e.touches[0].clientY - y0) * 0.5, 110));
    ind.style.transform = `translate(-50%, ${d - 48}px) rotate(${d * 3}deg)`;
    ind.style.opacity = String(Math.min(1, d / 50));
    ind.classList.toggle('ready', d >= TH);
  }, { passive: true });
  window.addEventListener('touchend', () => {
    if (y0 === null) return; y0 = null;
    if (d < TH) { reset(); return; }
    busy = true; ind.classList.add('spin'); ind.style.transition = 'transform .2s'; ind.style.transform = `translate(-50%, ${TH - 40}px)`;
    refreshApp();
  }, { passive: true });
  window.addEventListener('touchcancel', () => { y0 = null; reset(); }, { passive: true });
}
async function refreshApp() {
  save();
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) {
      await reg.update();
      const sw = reg.installing || reg.waiting;
      if (sw) await new Promise((res) => { const t = setTimeout(res, 3000); sw.addEventListener('statechange', () => { if (sw.state === 'activated') { clearTimeout(t); res(); } }); });
    }
  } catch { /* hors ligne : on recharge quand même */ }
  setTimeout(() => location.reload(), 300);
}

// ---------- Ernest ----------
function plantNames() { return S.garden.plants.slice(-8).map(plantName); }
function setErnest(force) {
  const d = dayOf(S, today); const allDone = d.things.length > 0 && d.things.every((t) => t.done);
  const st = force || stateFor(nowHour(), { allDone, sunday: dow(today) === 0 });
  $('#ernestWrap').innerHTML = ernestSvg(st);
}
function bubble(text, long = false) {
  if (!text) return;
  const b = $('#bulle'); b.textContent = text; b.hidden = false; b.classList.toggle('long', long);
  S.ernest.log = [{ t: text, at: new Date().toISOString() }, ...(S.ernest.log || [])].slice(0, 60);
  clearTimeout(bubbleT); if (!long) bubbleT = setTimeout(hideBubble, 9000 + text.length * 40);
}
function hideBubble() { $('#bulle').hidden = true; }
function greet() {
  const e = ernestEnv(S, today, plantNames());
  const E = S.ernest; let ctx = hourCtx(nowHour()); let extra = {};
  if (E.firstSeq < 10) { ctx = 'premiere.ouverture'; extra.seq = E.firstSeq + 1; }
  else if (e.j !== null && e.j === -1 && !S.milestones['apres-examen']) { ctx = 'apres-examen'; S.milestones['apres-examen'] = today; }
  else if (E.lastGreetDay === today && E.lastGreetCtx === ctx) { if (Math.random() < 0.25) { const t = say(S, 'manies', e); if (t) bubble(t); save(); } return; }
  else if (e.mood === 'low' && Math.random() < 0.5) ctx = 'semaine-grise';
  else if (e.j !== null && e.j >= 0 && e.j <= 30 && Math.random() < 0.45) ctx = 'jmoins';
  else if (e.dow === 0 && Math.random() < 0.5) ctx = 'dimanche';
  let t = say(S, ctx, e, extra);
  if (!t && ctx !== hourCtx(nowHour())) t = say(S, hourCtx(nowHour()), e);
  if (ctx === 'premiere.ouverture') { E.firstSeq += 1; if (!t) t = ['Bonjour. Je suis Ernest. Je m\'occupe de la serre.', 'Chaque chose que tu fais y plante quelque chose.', 'Le soir, on pose trois choses pour demain. Pas plus.', 'La liste, à côté, c\'est pour tout le reste. Les courses, les colis.', 'Le dimanche, on regarde ce qui a poussé.', 'Les idées, tu les poses, je les range.', 'Je ne demande rien. Je raconte.', 'Un jour sans, ça arrive. La serre attend.', 'Le bouton + est là pour tout attraper.', 'Voilà. Je retourne compter les lucioles.'][E.firstSeq - 1]; }
  else { E.lastGreetDay = today; E.lastGreetCtx = ctx; }
  bubble(t || 'Bonjour.'); save();
}

// ---------- Navigation ----------
function switchTab(t) { tab = t; document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); render(); window.scrollTo(0, 0); }
function render() {
  S._light = moodAvg(S, today); gardenUpdate();
  const v = $('#view');
  v.innerHTML = tab === 'today' ? viewToday() : tab === 'liste' ? viewListe() : tab === 'semaine' ? viewSemaine() : viewCarnet();
  bindView(v);
  if (historyOpen && !$('#sheet').hidden) { const y = $('#sheet').scrollTop; historySheet(); $('#sheet').scrollTop = y; }
}
function toast(msg, ms = 2600, undo = null) {
  const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button class="undo">Annuler</button>' : ''}`; t.hidden = false; clearTimeout(t._t);
  if (undo) t.querySelector('.undo').addEventListener('click', () => { undo(); t.hidden = true; save(); render(); });
  t._t = setTimeout(() => { t.hidden = true; }, undo ? Math.max(ms, 5000) : ms);
}
// Suppressions, toujours annulables
function removeThing(id) {
  label('la suppression');
  const d = ensureDay(S, today), i = d.things.findIndex((x) => x.id === id); if (i < 0) return;
  const [t] = d.things.splice(i, 1); save(); render();
  toast('Supprimée.', 5000, () => d.things.splice(i, 0, t));
}
function removeList(id) {
  label('la suppression');
  const i = S.list.findIndex((x) => x.id === id); if (i < 0) return;
  const [l] = S.list.splice(i, 1);
  const d = ensureDay(S, today), placed = d.things.filter((t) => t.fromList === id && !t.done); d.things = d.things.filter((t) => !placed.includes(t));
  save(); render();
  toast('Supprimée de la liste.', 5000, () => { S.list.splice(i, 0, l); d.things.push(...placed); });
}
function removeGoal(id) {
  label("le retrait de l'objectif");
  const g = S.goals.find((x) => x.id === id); if (!g) return; const prev = g.status; g.status = 'dropped'; save(); render();
  toast('Objectif retiré.', 5000, () => { g.status = prev; });
}
// Glisser une ligne vers la gauche pour la supprimer
function bindSwipe(root) {
  root.querySelectorAll('[data-swipe]').forEach((w) => {
    const row = w.lastElementChild; let x0 = null, y0 = 0, dx = 0, lock = null;
    w.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; lock = null; row.style.transition = 'none'; }, { passive: true });
    w.addEventListener('touchmove', (e) => {
      if (x0 === null) return; const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (!lock) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; lock = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'; }
      if (lock !== 'x') return; dx = Math.min(0, mx); row.style.transform = `translateX(${dx}px)`; w.classList.toggle('armed', dx < -90);
    }, { passive: true });
    const end = () => {
      if (x0 === null) return; x0 = null; row.style.transition = 'transform .2s';
      if (dx < -90) { row.style.transform = 'translateX(-110%)'; const [k, id] = w.dataset.swipe.split('|'); setTimeout(() => (k === 'thing' ? removeThing(id) : removeList(id)), 180); }
      else { row.style.transform = ''; w.classList.remove('armed'); }
    };
    w.addEventListener('touchend', end, { passive: true }); w.addEventListener('touchcancel', end, { passive: true });
  });
}
const swipeWrap = (kind, id, html) => `<div class="swipe" data-swipe="${kind}|${id}"><div class="swipe-bg">${icon('trash')}<span>Supprimer</span></div>${html}</div>`;

// ---------- Sheets ----------
function openSheet(html) { $('#sheet').innerHTML = `<div class="handle"></div>${html}`; $('#sheet').hidden = false; $('#sheetBg').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; $('#sheetBg').hidden = true; historyOpen = false; }
const chips = (sel, name = 'cat') => `<div class="chips" data-chips="${name}">${CATS.map((c) => `<button class="chip ${sel === c.id ? 'on' : ''}" data-v="${c.id}"><span class="dot" style="background:${c.couleur}"></span>${c.nom}</button>`).join('')}</div>`;
function bindChips(root) {
  root.querySelectorAll('[data-chips]').forEach((g) => g.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => { const was = b.classList.contains('on'); g.querySelectorAll('.chip').forEach((x) => x.classList.remove('on')); if (!was || g.dataset.required) b.classList.add('on'); g.dispatchEvent(new CustomEvent('change', { detail: b.classList.contains('on') ? b.dataset.v : null })); })));
}
const chipValue = (root, name) => { const on = root.querySelector(`[data-chips="${name}"] .chip.on`); return on ? on.dataset.v : null; };

// ---------- Aujourd'hui ----------
function viewToday() {
  const d = ensureDay(S, today), tomorrow = addDays(today, 1), j = jMinus(S.settings.exam, today);
  const ordered = [...d.things].sort((a, b) => slotOrder(a.slot) - slotOrder(b.slot));
  const firstUndone = ordered.find((t) => !t.done);
  const dueToday = sortList(S.list).filter((l) => !l.done && l.due && l.due <= today);
  const all = d.things.length > 0 && d.things.every((t) => t.done);
  let h = `<div class="row spread"><div><div class="eyebrow">${esc(fmtDay(today))}</div><h1>${!d.things.length ? 'Rien de posé.' : all ? 'Tout est fait.' : 'Ta journée.'}</h1></div>${j !== null && j >= 0 && j <= 60 ? `<div class="muted small" style="text-align:right">${esc(S.settings.examLabel)}<br><b style="color:var(--amber)">J-${j}</b></div>` : ''}</div>`;
  h += moodBar(d);
  if (!standalone() && !S.ernest.installHint) h += `<div class="install"><b>Installer Ernest sur l'écran d'accueil</b><ol><li>Bouton Partager de Safari</li><li>« Sur l'écran d'accueil »</li><li>Ouvrir depuis l'icône (sinon Safari efface les données après 7 jours)</li></ol><button class="btn quiet" data-act="installOk">C'est fait, ou plus tard</button></div>`;
  if (!d.things.length) {
    const sug = suggestions(S, today).filter((s) => s.kind === 'list').slice(0, 3);
    h += `<div class="card amber stack">${sug.length ? `<div>Dans ta liste, pour aujourd'hui :</div>${sug.map((s, i) => `<label class="row"><input type="checkbox" checked data-sug="${i}" style="width:auto"> <span class="dot" style="background:${catOf(s.cat).couleur}"></span> ${esc(s.title)}</label>`).join('')}<button class="btn" data-act="acceptSug">Les placer dans ma journée</button>` : `<div class="muted">Une seule chose suffit pour commencer.</div>`}<button class="btn ${sug.length ? 'quiet' : ''}" data-act="addThing">${icon('plus', 'sm')} Poser une chose pour aujourd'hui</button></div>`;
  }
  let pending = 0; for (let i = 1; i <= 7; i++) pending += dayOf(S, addDays(today, -i)).things.filter((t) => !t.done).length;
  if (pending) h += `<button class="card row spread" data-act="history" style="width:100%;text-align:left"><span class="row">${icon('history')}<span><b>${pending} chose${pending > 1 ? 's' : ''} en suspens ces derniers jours</b><br><span class="muted small">Les remettre à aujourd'hui ou les supprimer</span></span></span><span style="color:var(--amber)">${icon('arrow')}</span></button>`;
  if (nowHour() >= 18 && !dayOf(S, tomorrow).planned) h += `<button class="card amber row spread" data-act="ritual" style="width:100%;text-align:left"><span class="row">${icon('moon')}<span><b>Préparer demain</b><br><span class="muted small">Cinq minutes avec Ernest</span></span></span><span style="color:var(--amber)">${icon('arrow')}</span></button>`;
  for (const [k, label] of MOMENTS) {
    const items = ordered.filter((t) => (BLOCKS[t.slot] ? t.slot : null) === k).sort((a, b) => a.done - b.done);
    if (items.length) h += `<div class="moment"><div class="moment-h">${label}</div><div class="stack">${items.map((t) => swipeWrap('thing', t.id, thingRow(t, t === firstUndone))).join('')}</div></div>`;
  }
  const cur = ordered.find((t) => !t.done && t.startedAt) || ordered.find((t) => !t.done && t.spent) || firstUndone;
  if (cur && tracking()) {
    if (cur.startedAt) h += `<div class="btns"><button class="btn quiet" data-act="pause" data-id="${cur.id}">${icon('pause', 'sm')} Pause</button><button class="btn" data-act="done" data-id="${cur.id}">${icon('check', 'sm')} Terminer · <span class="timer">${elapsed(cur)}</span></button></div><div class="muted small center">En cours : ${esc(cur.title)}</div>`;
    else if (cur.spent) h += `<div class="btns"><button class="btn" data-act="start" data-id="${cur.id}">${icon('play', 'sm')} Reprendre · ${elapsed(cur)}</button><button class="btn quiet" data-act="done" data-id="${cur.id}">${icon('check', 'sm')} Terminer</button></div><div class="muted small center">En pause : ${esc(cur.title)}</div>`;
    else h += `<button class="btn" data-act="start" data-id="${cur.id}">${icon('play', 'sm')} Démarrer : ${esc(cur.title)}</button>`;
  }
  if (d.things.length) h += `<button class="btn quiet" data-act="addThing">${icon('plus', 'sm')} Ajouter à ma journée</button>`;
  if (dueToday.length) h += `<div class="moment"><div class="moment-h">Dans la liste, daté d'aujourd'hui</div><div class="stack">${dueToday.map(listRow).join('')}</div></div>`;
  const dn = doneOn(S, today).n; if (dn) h += `<div class="muted small">${dn} chose${dn > 1 ? 's' : ''} faite${dn > 1 ? 's' : ''} aujourd'hui · ${totalDone(S)} en tout.</div>`;
  return h;
}
const TOUR = [
  ['sun', 'Ta journée', "Aujourd'hui montre ce que tu as décidé de faire aujourd'hui, rangé par moment : matin, midi, après-midi, soir. Coche ce qui est fait : une plante pousse dans la serre."],
  ['list', 'La liste', "Tout ce qui attend sans urgence : courses, colis, voiture. Le petit soleil d'une ligne la fait passer dans ta journée. Une ligne datée d'aujourd'hui y remonte toute seule."],
  ['moon', 'Le soir', "À partir de 18 h, « Préparer demain » : une ligne sur ta journée, ton humeur, puis trois choses pour demain, souvent prises dans la liste."],
  ['plus', 'Le bouton +', "Il attrape tout, de partout. Tu choisis où ça va : aujourd'hui, la liste, une idée, ou un objectif avec ses étapes."],
  ['hand', 'Modifier, supprimer', "Touche une ligne pour la modifier, la reporter à demain ou la supprimer. Glisse-la vers la gauche pour la supprimer d'un geste. Tu peux toujours annuler."],
  ['week', 'Semaine', "Jour par jour, ce qui est fait et ce qui est resté en suspens : le soleil le remet à aujourd'hui, la corbeille le supprime. Le dimanche, on regarde ce qui a poussé et on avance les objectifs."],
  ['carnet', 'Carnet et serre', "Le carnet garde les cartes gagnées et ce qu'Ernest t'a dit. Touche la serre pour l'ouvrir en grand et la parcourir au doigt."],
];
function tourSheet(i = 0) {
  const [ic, t, txt] = TOUR[i], last = i === TOUR.length - 1;
  openSheet(`<div class="tour"><div class="tour-ic">${icon(ic)}</div><div class="eyebrow">${i + 1} / ${TOUR.length}</div><h2>${t}</h2><p>${txt}</p><div class="dots">${TOUR.map((_, k) => `<span class="${k === i ? 'on' : ''}"></span>`).join('')}</div></div><div class="btns">${i ? '<button class="btn quiet" id="tPrev">Précédent</button>' : '<button class="btn quiet" id="tSkip">Passer</button>'}<button class="btn" id="tNext">${last ? "C'est parti" : 'Suivant'}</button></div>`);
  const done = () => { S.ernest.tourSeen = true; save(); closeSheet(); };
  $('#tNext').addEventListener('click', () => (last ? done() : tourSheet(i + 1)));
  if ($('#tPrev')) $('#tPrev').addEventListener('click', () => tourSheet(i - 1));
  if ($('#tSkip')) $('#tSkip').addEventListener('click', done);
}
// Humeur, à toute heure : la dernière note du jour fait foi, les précédentes restent dans l'historique du jour.
function moodBar(d) {
  const last = (d.moods || []).slice(-1)[0];
  const lt = last ? new Date(last.at) : null, when = lt ? `${lt.getHours()} h ${String(lt.getMinutes()).padStart(2, '0')}` : '';
  return `<div class="moodbar"><div class="row spread"><span class="small muted">${d.mood === null || d.mood === undefined ? 'Et là, comment ça va ?' : `Noté : ${moodLabel(d.mood)}${when ? ` · ${when}` : ''}`}</span>${(d.moods || []).length > 1 ? `<span class="small muted">${d.moods.map((x) => moodLabel(x.m)).slice(-3).join(' › ')}</span>` : ''}</div><div class="moods compact">${[0, 1, 2, 3, 4].map((i) => `<button data-act="mood" data-v="${i}" class="${d.mood === i ? 'on' : ''}" aria-label="${moodLabel(i)}">${icon('m' + i)}</button>`).join('')}</div></div>`;
}
function setMood(d, m) {
  d.mood = m; d.moods = d.moods || []; const now = Date.now();
  const last = d.moods[d.moods.length - 1];
  if (last && now - Date.parse(last.at) < 10 * 60000) last.m = m; else d.moods.push({ m, at: new Date(now).toISOString() });
}
function helpCard() {
  const r = (ic, t) => `<div class="help-row">${icon(ic)}<div>${t}</div></div>`;
  return `<div class="card help stack"><div class="eyebrow">Comment ça marche</div>
  ${r('sun', "<b>Aujourd'hui</b> : ce que tu as décidé de faire aujourd'hui, placé dans la journée (matin, midi, après-midi, soir). Trois choses suffisent.")}
  ${r('list', "<b>Liste</b> : tout ce qui attend, sans date ou pour plus tard. Courses, colis, voiture. Ce qui est daté d'aujourd'hui remonte ici.")}
  ${r('moon', "<b>Le soir</b> : tu choisis ce qui passera dans la journée de demain, souvent depuis la liste.")}
  ${r('week', "<b>Semaine</b> : ce qui a poussé, et tes objectifs avec leurs étapes.")}
  ${r('plus', "Le bouton <b>+</b> attrape tout : pour aujourd'hui, pour la liste, une idée ou un objectif. Tu choisis où ça va.")}
  <button class="btn quiet" data-act="helpOk">Compris</button></div>`;
}
function thingRow(t, first) {
  const c = catOf(t.cat);
  return `<div class="thing ${t.done ? 'done' : ''} ${first ? 'first' : ''}" data-thing="${t.id}"><button class="check" data-act="toggle" data-id="${t.id}" aria-label="Fait">${t.done ? icon('check') : ''}</button><div class="body" data-act="thingMenu" data-id="${t.id}"><div class="t">${t.seriesId ? `<span class="rep-ic">${icon('repeat', 'sm')}</span>` : ''}${esc(t.title)}</div><div class="s"><span class="dot" style="background:${c.couleur};display:inline-block;vertical-align:middle;margin-right:4px"></span>${esc(c.nom)}${t.done && t.real ? ` · ${fmtMin(t.real)}` : t.startedAt && !t.done ? ` · en cours ${elapsed(t)}` : t.spent && !t.done ? ` · en pause ${elapsed(t)}` : ''}${t.src ? ` · ${esc(t.src)}` : ''}</div></div>${t.link && !t.done ? `<button class="go" data-act="start" data-id="${t.id}" aria-label="Ouvrir">${icon('open')}</button>` : ''}</div>`;
}
const spentMs = (t) => (t.spent || 0) + (t.startedAt ? Date.now() - t.startedAt : 0);
const tracking = () => S.settings.trackTime !== false;
const elapsed = (t) => { const m = Math.round(spentMs(t) / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
function renderTimerOnly() { const t = dayOf(S, today).things.find((x) => x.startedAt && !x.done); if (t) document.querySelectorAll('.timer').forEach((el) => { el.textContent = elapsed(t); }); }

function bindView(v) {
  v.querySelectorAll('[data-act]').forEach((el) => el.addEventListener('click', (ev) => { ev.stopPropagation(); action(el.dataset.act, el.dataset, el, v); }));
  bindChips(v); bindSwipe(v);
  const cap = v.querySelector('#capture'); if (cap) cap.addEventListener('keydown', (e) => { if (e.key === 'Enter' && cap.value.trim()) { addList(cap.value.trim(), listeFilter === 'ideas' ? 'idea' : 'todo'); cap.value = ''; render(); } });
}
function action(act, ds, el, v) {
  const d = ensureDay(S, today);
  const thing = ds.id ? d.things.find((t) => t.id === ds.id) : null;
  label({ mood: "l'humeur", jListToggle: 'la coche', jListDel: 'la suppression', toggle: 'la coche', listToggle: 'la coche', listToday: "le passage dans la journée", start: 'le démarrage', pause: 'la pause', jToggle: 'la coche', jToday: "la remise à aujourd'hui", jDel: 'la suppression', ideaAct: "le tri de l'idée", goalMs: "l'étape", acceptSug: 'les choses posées' }[act] || null);
  switch (act) {
    case 'installOk': S.ernest.installHint = true; save(); render(); break;
    case 'listToday': { const l = S.list.find((x) => x.id === ds.id); if (!l) return; d.things.push({ id: uid(), title: l.text, cat: l.cat || 'perso', est: estimate(S, l.cat || 'perso'), slot: null, done: false, real: 0, fromList: l.id }); d.planned = true; save(); toast('Placée dans ta journée.'); render(); break; }
    case 'acceptSug': {
      const sug = suggestions(S, today).filter((s) => s.kind === 'list').slice(0, 3);
      const picked = [...v.querySelectorAll('[data-sug]')].filter((c) => c.checked).map((c) => sug[Number(c.dataset.sug)]);
      if (!picked.length) { thingSheet(); return; }
      for (const s of picked) { const l = S.list.find((x) => x.id === s.id); d.things.push({ id: uid(), title: s.title, cat: s.cat, est: estimate(S, s.cat), slot: null, src: null, link: null, done: false, real: 0, fromList: l ? l.id : null }); }
      d.planned = true; save(); render(); break;
    }
    case 'ritual': ritualSheet(); break;
    case 'addThing': thingSheet(); break;
    case 'start': if (thing) startThing(thing); break;
    case 'pause': if (thing && thing.startedAt) { thing.spent = spentMs(thing); thing.startedAt = null; save(); toast('En pause. Reprends quand tu veux.'); render(); } break;
    case 'done': if (thing) doneSheet(thing); break;
    case 'toggle': if (thing) { if (thing.done) { thing.done = false; thing.doneAt = null; save(); render(); } else doneSheet(thing); } break;
    case 'thingMenu': if (thing) thingSheet(thing); break;
    case 'listToggle': { const l = S.list.find((x) => x.id === ds.id); if (!l) return; if (l.done) { l.done = false; l.doneAt = null; } else { l.done = true; l.doneAt = new Date().toISOString(); plant(l.cat || 'perso', 'moss'); const e = ernestEnv(S, today, plantNames()); bubble(say(S, 'coche', e)); const c = drawShort(S); if (c) toast('Une carte de plus dans le Carnet.'); } save(); render(); break; }
    case 'listEdit': listSheet(S.list.find((x) => x.id === ds.id)); break;
    case 'ideaAct': { const i = S.ideas.find((x) => x.id === ds.id); if (!i) return; if (ds.v === 'todo') { S.list.push({ id: uid(), text: i.text, cat: null, due: null, done: false, at: new Date().toISOString() }); i.status = 'done'; } else if (ds.v === 'keep') i.status = 'kept'; else if (ds.v === 'drop') i.status = 'dropped'; else if (ds.v === 'goal') { S.goals.push({ id: uid(), title: i.text, cat: 'perso', due: null, horizon: 'month', milestones: [], status: 'active', reviews: {} }); i.status = 'done'; } save(); render(); break; }
    case 'jToggle': { const dd = dayOf(S, ds.day), t = dd.things.find((x) => x.id === ds.id); if (!t) return; if (!t.done && ds.day === today) { doneSheet(t); return; } t.done = !t.done; t.doneAt = t.done ? `${ds.day}T20:00:00` : null; if (!t.done) t.real = 0; save(); render(); break; }
    case 'jToday': { const dd = dayOf(S, ds.day), i = dd.things.findIndex((x) => x.id === ds.id); if (i < 0) return; const [t] = dd.things.splice(i, 1); d.things.push({ ...t, startedAt: null, spent: 0 }); d.planned = true; save(); toast('Remise dans ta journée.'); render(); break; }
    case 'jDel': { const dd = dayOf(S, ds.day), i = dd.things.findIndex((x) => x.id === ds.id); if (i < 0) return; const [t] = dd.things.splice(i, 1); save(); render(); toast('Supprimée.', 5000, () => dd.things.splice(i, 0, t)); break; }
    case 'filter': listeFilter = ds.v; render(); break;
    case 'history': historySheet(); break;
    case 'mood': { setMood(d, Number(ds.v)); save(); S._light = moodAvg(S, today); render(); if (Number(ds.v) <= 1) { const t = say(S, 'semaine-grise', ernestEnv(S, today, plantNames())); if (t) bubble(t); } break; }
    case 'seriesEdit': seriesSheet(S.series.find((x) => x.id === ds.id)); break;
    case 'jListToggle': { const l = S.list.find((x) => x.id === ds.id); if (!l) return; l.done = false; l.doneAt = null; save(); toast('Décochée, de retour dans la liste.'); render(); break; }
    case 'jListDel': removeList(ds.id); break;
    case 'fam': carnetFam = ds.v; render(); break;
    case 'goalMs': { const g = S.goals.find((x) => x.id === ds.id); const m = g && g.milestones[Number(ds.i)]; if (!m) return; m.done = !m.done; if (m.done) { m.doneAt = today; let p = S.garden.plants.find((x) => x.kind === 'bonsai' && x.goal === g.id); if (!p) { p = { id: uid(), cat: g.cat, day: today, seed: Math.floor(Math.random() * 1e9), kind: 'bonsai', goal: g.id, branches: 0 }; S.garden.plants.push(p); } p.branches = g.milestones.filter((x) => x.done).length; gardenWater(); } save(); render(); break; }
    case 'goalEdit': goalSheet(S.goals.find((x) => x.id === ds.id)); break;
    case 'addGoal': goalSheet(); break;
    case 'review': reviewSheet(); break;
    case 'openCard': { const c = cardById(ds.id); if (c) cardSheet(c); break; }
    case 'export': exportSheet(); break;
    default: break;
  }
}

// Démarrer / terminer une chose
function startThing(t) {
  for (const x of dayOf(S, today).things) if (x !== t && x.startedAt && !x.done) { x.spent = spentMs(x); x.startedAt = null; }
  t.startedAt = Date.now(); t._asked = false; save();
  const e = ernestEnv(S, today, plantNames()); bubble(say(S, 'demarre', e));
  if (t.link) window.open(t.link, '_blank');
  render();
}
function doneSheet(t) {
  const ms = spentMs(t);
  if (!tracking() || ms <= 0) { markDone(t, 0); return; }
  const real = Math.max(1, Math.round(ms / 60000));
  openSheet(`<h2>${esc(t.title)}</h2><div class="kv"><label>Temps mesuré</label><div class="row"><input id="realMin" type="number" inputmode="numeric" min="0" max="900" value="${real}" style="width:110px"><span class="muted">minutes, à corriger si le chrono a tourné pour rien</span></div></div><button class="btn" id="okDone">C'est fait</button><button class="btn quiet" id="noDone">Pas encore</button>`);
  $('#okDone').addEventListener('click', () => { markDone(t, Math.max(0, Number($('#realMin').value) || 0)); closeSheet(); });
  $('#noDone').addEventListener('click', closeSheet);
}
function markDone(t, real) {
  label('la chose faite');
  t.done = true; t.real = real; t.doneAt = new Date().toISOString(); t.spent = spentMs(t); t.startedAt = null;
  if (t.fromList) { const l = S.list.find((x) => x.id === t.fromList); if (l) { l.done = true; l.doneAt = t.doneAt; } }
  plant(t.cat, 'plant'); gardenWater(); setErnest('arrose'); setTimeout(() => setErnest(), 2500);
  const d = dayOf(S, today), all = d.things.every((x) => x.done);
  const e = ernestEnv(S, today, plantNames()); bubble(say(S, all ? 'coche.derniere' : 'coche', e));
  const c = drawShort(S); if (c) toast('Une carte de plus dans le Carnet.');
  if (all) { const L = drawLong(S, today); if (L) toast(`Carnet : « ${L.titre || 'une histoire'} »`, 4000); }
  milestones(); save(); render();
}
function plant(cat, kind) { S.garden.plants.push({ id: uid(), cat, day: today, seed: Math.floor(Math.random() * 1e9), kind }); if (S.garden.plants.length > 600) S.garden.plants.splice(0, S.garden.plants.length - 600); }
function milestones() {
  const n = totalDone(S), M = S.milestones;
  for (const k of [1, 10, 50, 100, 250, 500]) if (n >= k && !M[`n${k}`]) { M[`n${k}`] = today; const c = drawRare(S, `n${k}`); if (c) toast(`Carnet : carte rare « ${c.titre || ''} »`, 4000); S.garden.objects.push({ kind: `n${k}`, day: today }); }
}

// Feuille : une chose (créer ou modifier)
function thingSheet(t) {
  const d = ensureDay(S, today), isNew = !t; t = t || { id: uid(), title: '', cat: 'perso', est: null, slot: null, done: false, real: 0 };
  openSheet(`<h2>${isNew ? 'Une chose pour aujourd\'hui' : 'Cette chose'}</h2><input id="thTitle" placeholder="Quoi ?" value="${esc(t.title)}" autocomplete="off">${chips(t.cat)}<div class="kv"><label>Quand dans la journée</label>${blocksHtml(t.slot)}</div>${repeatHtml(t.seriesId ? (S.series.find((x) => x.id === t.seriesId) || {}).days : [])}<div class="kv" ${tracking() && (t.done || t.spent) ? '' : 'hidden'}><label>Temps passé (min)</label><input id="thEst" type="number" inputmode="numeric" value="${t.done ? t.real || 0 : Math.round(spentMs(t) / 60000)}" style="width:120px"></div><button class="btn" id="thSave">${isNew ? 'Poser' : 'Enregistrer'}</button>${isNew ? '' : `<div class="btns"><button class="btn quiet" id="thTomorrow">${icon('arrow', 'sm')} Demain</button><button class="btn quiet" id="thIdea">${icon('bulb', 'sm')} En idée</button><button class="btn danger" id="thDrop">${icon('trash', 'sm')} Supprimer</button></div>`}`);
  const sh = $('#sheet'); bindChips(sh); let slot = t.slot; const repDays = bindRepeat(sh, t.seriesId ? (S.series.find((x) => x.id === t.seriesId) || {}).days : []);
  sh.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => { slot = slot === b.dataset.b ? null : b.dataset.b; sh.querySelectorAll('[data-b]').forEach((x) => x.classList.toggle('on', x.dataset.b === slot)); }));
  $('#thSave').addEventListener('click', () => { label(isNew ? "l'ajout" : 'la modification'); const title = $('#thTitle').value.trim(); if (!title) { toast('Écris d\'abord quoi.'); $('#thTitle').focus(); return; } t.title = title; t.cat = chipValue(sh, 'cat') || 'perso'; if (tracking() && (t.done || t.spent)) { const m = Math.max(0, Number($('#thEst').value) || 0); if (t.done) t.real = m; else { t.spent = m * 60000; if (t.startedAt) t.startedAt = Date.now(); } } t.slot = slot; saveSeries(t, repDays()); if (isNew) { d.things.push(t); d.planned = true; } save(); if (t.seriesId) toast(`Revient : ${daysLabel(repDays()).toLowerCase()}.`); closeSheet(); render(); });
  if (!isNew) {
    $('#thTomorrow').addEventListener('click', () => { d.things = d.things.filter((x) => x.id !== t.id); ensureDay(S, addDays(today, 1)).things.push({ ...t, startedAt: null, spent: 0 }); const e = ernestEnv(S, today, plantNames()); bubble(say(S, 'reporte', e)); save(); closeSheet(); render(); });
    $('#thIdea').addEventListener('click', () => { d.things = d.things.filter((x) => x.id !== t.id); S.ideas.push({ id: uid(), text: t.title, at: new Date().toISOString(), status: 'inbox' }); save(); closeSheet(); render(); });
    $('#thDrop').addEventListener('click', () => { closeSheet(); const e = ernestEnv(S, today, plantNames()); bubble(say(S, 'laisse', e)); removeThing(t.id); });
  }
  setTimeout(() => $('#thTitle').focus(), 50);
}

// ---------- Capture (+) ----------
function captureSheet(preset = 'today') {
  let dest = preset, due = null, slot = null, repGet = () => [];
  const DEST = [['today', 'sun', "Aujourd'hui", 'Je le fais aujourd\'hui'], ['list', 'list', 'Liste', 'Plus tard, ou à une date'], ['idea', 'bulb', 'Idée', 'Une pensée à garder'], ['goal', 'flag', 'Objectif', 'Un cap, avec des étapes']];
  openSheet(`<input id="capText" placeholder="Qu'est-ce que tu veux attraper ?" autocomplete="off"><div class="dest">${DEST.map(([k, ic, t, sub]) => `<button data-dest="${k}" class="${k === dest ? 'on' : ''}">${icon(ic)}<span><b>${t}</b><small>${sub}</small></span></button>`).join('')}</div><div id="capOpts" class="stack"></div><button class="btn" id="capSave">Attraper</button>`);
  const sh = $('#sheet');
  const opts = () => {
    const o = $('#capOpts');
    if (dest === 'today') o.innerHTML = `${chips(null)}<div class="kv"><label>Quand dans la journée (facultatif)</label>${blocksHtml(slot)}</div>${repeatHtml([])}`;
    else if (dest === 'list') o.innerHTML = `${chips(null)}<div class="kv"><label>Pour quand (facultatif)</label><div class="chips"><button class="chip" data-d="1">Demain</button><button class="chip" data-d="7">Dans la semaine</button><input type="date" id="capDate" class="chip-date"></div></div>`;
    else if (dest === 'goal') o.innerHTML = `${chips(null)}<div class="kv"><label>Échéance (facultative)</label><input type="date" id="capGoalDue"></div><div class="kv"><label>Étapes, une par ligne (facultatif)</label><textarea id="capGoalMs" placeholder="Première étape&#10;Deuxième étape"></textarea></div>`;
    else o.innerHTML = `<div class="muted small">Elle ira dans Liste › Idées. Tu la trieras quand tu voudras.</div>`;
    bindChips(o); repGet = o.querySelector('.rep') ? bindRepeat(o, []) : () => [];
    o.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => { slot = slot === b.dataset.b ? null : b.dataset.b; o.querySelectorAll('[data-b]').forEach((x) => x.classList.toggle('on', x.dataset.b === slot)); }));
    o.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => { const was = b.classList.contains('on'); o.querySelectorAll('[data-d]').forEach((x) => x.classList.remove('on')); due = was ? null : addDays(today, Number(b.dataset.d)); if (!was) b.classList.add('on'); const cd = $('#capDate'); if (cd) cd.value = due || ''; }));
    const cd = $('#capDate'); if (cd) cd.addEventListener('change', () => { due = cd.value || null; o.querySelectorAll('[data-d]').forEach((x) => x.classList.remove('on')); });
  };
  sh.querySelectorAll('[data-dest]').forEach((b) => b.addEventListener('click', () => { dest = b.dataset.dest; due = null; slot = null; sh.querySelectorAll('[data-dest]').forEach((x) => x.classList.toggle('on', x === b)); opts(); }));
  opts();
  const go = () => {
    const text = $('#capText').value.trim();
    if (!text) { toast("Écris d'abord ce que tu veux attraper."); $('#capText').focus(); return; }
    const cat = chipValue(sh, 'cat'); label("l'ajout");
    if (dest === 'today') {
      const d = ensureDay(S, today), t = { id: uid(), title: text, cat: cat || 'perso', est: estimate(S, cat || 'perso'), slot, done: false, real: 0 }, rd = repGet();
      saveSeries(t, rd); const due = !rd.length || rd.includes(dow(today));
      if (due) { d.things.push(t); d.planned = true; }
      save(); closeSheet(); toast(rd.length ? `Série posée : ${daysLabel(rd).toLowerCase()}.${due ? '' : " Pas aujourd'hui."}` : 'Placée dans ta journée.'); switchTab('today');
    }
    else if (dest === 'list') { addList(text, 'todo', cat, due); closeSheet(); toast(due && due <= today ? "Dans la liste, et visible aujourd'hui." : due ? `Dans la liste, pour le ${new Date(due + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}.` : 'Dans la liste.'); render(); }
    else if (dest === 'idea') { addList(text, 'idea'); closeSheet(); toast('Rangée dans les idées.'); render(); }
    else { const ms = ($('#capGoalMs').value || '').split('\n').map((x) => x.trim()).filter(Boolean).map((t) => ({ text: t, done: false })); S.goals.push({ id: uid(), title: text, cat: cat || 'perso', due: $('#capGoalDue').value || null, horizon: 'month', milestones: ms, status: 'active', reviews: {} }); save(); closeSheet(); toast('Objectif posé, dans Semaine.'); switchTab('semaine'); }
  };
  $('#capSave').addEventListener('click', go); $('#capText').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  setTimeout(() => $('#capText').focus(), 50);
}
function addList(text, kind, cat = null, due = null) {
  if (kind === 'idea') S.ideas.push({ id: uid(), text, at: new Date().toISOString(), status: 'inbox' });
  else S.list.push({ id: uid(), text, cat, due, done: false, at: new Date().toISOString() });
  const e = ernestEnv(S, today, plantNames());
  bubble(say(S, kind === 'idea' ? 'idee' : 'liste', e));
  save();
}

// ---------- Liste ----------
function viewListe() {
  const open = sortList(S.list).filter((l) => !l.done), done = sortList(S.list).filter((l) => l.done).slice(0, 30), ideas = S.ideas.filter((i) => i.status === 'inbox' || i.status === 'kept');
  let h = `<h1>La liste.</h1><div class="muted small">Tout ce qui attend, sans date ou pour plus tard. Le soleil fait passer une entrée dans ta journée.</div><input id="capture" placeholder="${listeFilter === 'ideas' ? 'Une idée…' : 'Une chose à faire, un jour…'}" autocomplete="off"><div class="chips"><button class="chip ${listeFilter === 'todo' ? 'on' : ''}" data-act="filter" data-v="todo">À faire · ${open.length}</button><button class="chip ${listeFilter === 'ideas' ? 'on' : ''}" data-act="filter" data-v="ideas">Idées · ${ideas.length}</button><button class="chip ${listeFilter === 'series' ? 'on' : ''}" data-act="filter" data-v="series">${icon('repeat', 'sm')} Séries · ${S.series.filter((x) => x.active).length}</button><button class="chip ${listeFilter === 'done' ? 'on' : ''}" data-act="filter" data-v="done">Faites</button></div>`;
  if (listeFilter === 'todo') h += open.length ? `<div class="stack">${open.map(listRow).join('')}</div>` : `<div class="muted">Rien en attente. La serre est calme.</div>`;
  else if (listeFilter === 'series') { const ss = S.series.filter((x) => x.active); h += `<div class="muted small">Ce qui revient tout seul dans ta journée, certains jours. Pour en créer une : le +, « Aujourd'hui », puis « Revient ».</div>`; h += ss.length ? `<div class="stack">${ss.map((x) => `<button class="list-item" data-act="seriesEdit" data-id="${x.id}" style="width:100%;text-align:left"><span class="dot" style="background:${catOf(x.cat).couleur}"></span><span class="t"><b>${esc(x.title)}</b><br><span class="muted small">${esc(daysLabel(x.days))}${x.slot ? ` · ${esc(BLOCKS[x.slot] || '').toLowerCase()}` : ''}${seriesDue(x, today) ? " · aujourd'hui" : ''}</span></span><span style="color:var(--fg2)">${icon('arrow', 'sm')}</span></button>`).join('')}</div>` : `<div class="muted">Aucune série. Le sport trois fois par semaine, la révision chaque matin : c'est fait pour ça.</div>`; }
  else if (listeFilter === 'done') h += done.length ? `<div class="stack">${done.map(listRow).join('')}</div>` : `<div class="muted">Pas encore.</div>`;
  else h += ideas.length ? `<div class="stack">${ideas.map((i) => `<div class="card stack"><div>${esc(i.text)}</div><div class="muted small">${new Date(i.at).toLocaleDateString('fr-FR')}${i.status === 'kept' ? ' · gardée' : ''}</div><div class="chips"><button class="chip" data-act="ideaAct" data-id="${i.id}" data-v="todo">${icon('arrow', 'sm')} à faire</button><button class="chip" data-act="ideaAct" data-id="${i.id}" data-v="goal">${icon('arrow', 'sm')} objectif</button>${i.status === 'inbox' ? `<button class="chip" data-act="ideaAct" data-id="${i.id}" data-v="keep">garder</button>` : ''}<button class="chip" data-act="ideaAct" data-id="${i.id}" data-v="drop">jeter</button></div></div>`).join('')}</div>` : `<div class="muted">Aucune idée posée. Elles viendront.</div>`;
  return h;
}
function listRow(l) {
  const c = l.cat ? catOf(l.cat) : null;
  return swipeWrap('list', l.id, `<div class="list-item ${l.done ? 'done' : ''}"><button class="check" data-act="listToggle" data-id="${l.id}" aria-label="Fait">${l.done ? icon('check') : ''}</button><div class="t" data-act="listEdit" data-id="${l.id}">${c ? `<span class="dot" style="background:${c.couleur};display:inline-block;margin-right:6px"></span>` : ''}${esc(l.text)}</div>${l.due ? `<span class="due ${l.due < today ? 'past' : ''}">${l.due === today ? 'aujourd\'hui' : l.due === addDays(today, 1) ? 'demain' : new Date(l.due + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>` : ''}${l.done ? '' : `<button class="mini" data-act="listToday" data-id="${l.id}" aria-label="Faire aujourd'hui">${icon('sun')}</button>`}</div>`);
}
function listSheet(l) {
  if (!l) return;
  openSheet(`<h2>Cette entrée</h2><input id="liText" value="${esc(l.text)}">${chips(l.cat)}<div class="kv"><label>Date (facultative)</label><input type="date" id="liDue" value="${l.due || ''}"></div><button class="btn" id="liSave">Enregistrer</button><div class="btns"><button class="btn quiet" id="liToday">${icon('sun', 'sm')} Aujourd'hui</button><button class="btn quiet" id="liIdea">${icon('bulb', 'sm')} En idée</button><button class="btn danger" id="liDel">${icon('trash', 'sm')} Supprimer</button></div>`);
  const sh = $('#sheet'); bindChips(sh);
  $('#liSave').addEventListener('click', () => { l.text = $('#liText').value.trim() || l.text; l.cat = chipValue(sh, 'cat'); l.due = $('#liDue').value || null; save(); closeSheet(); render(); });
  $('#liToday').addEventListener('click', () => { const d = ensureDay(S, today); d.things.push({ id: uid(), title: l.text, cat: l.cat || 'perso', est: estimate(S, l.cat || 'perso'), slot: null, done: false, real: 0, fromList: l.id }); d.planned = true; save(); closeSheet(); switchTab('today'); });
  $('#liIdea').addEventListener('click', () => { S.ideas.push({ id: uid(), text: l.text, at: new Date().toISOString(), status: 'inbox' }); S.list = S.list.filter((x) => x.id !== l.id); save(); closeSheet(); render(); });
  $('#liDel').addEventListener('click', () => { closeSheet(); removeList(l.id); });
}

// ---------- Rituel du soir ----------
function ritualSheet() {
  materialize(S, addDays(today, 1));
  const tomorrow = addDays(today, 1), d = ensureDay(S, today), dt = ensureDay(S, tomorrow), e = ernestEnv(S, today, plantNames());
  const undone = d.things.filter((t) => !t.done);
  const sug = suggestions(S, tomorrow);
  const bridgeSug = Object.values(S.bridges).flatMap((b) => []); // les ponts créent déjà leurs choses pour le bon jour
  const rows = [0, 1, 2].map((i) => { const t = dt.things[i]; return { title: t ? t.title : '', cat: t ? t.cat : 'perso', est: t ? t.est : null, slot: t ? t.slot : null, id: t ? t.id : null, src: t ? t.src : null, link: t ? t.link : null }; });
  openSheet(`<div class="eyebrow">Le soir</div><h2>${esc(say(S, 'rituel.debut', e) || 'On prépare demain.')}</h2>
  <div class="kv"><label>Qu'est-ce qui a compté aujourd'hui ?</label><input id="rJournal" value="${esc(d.journal || '')}" placeholder="Une ligne suffit" autocomplete="off"></div>
  <div class="kv"><label>Et toi, aujourd'hui</label><div class="moods">${[0, 1, 2, 3, 4].map((i) => `<button data-mood="${i}" class="${d.mood === i ? 'on' : ''}" aria-label="${moodLabel(i)}">${icon('m' + i)}<small>${moodLabel(i)}</small></button>`).join('')}</div></div>
  ${undone.length ? `<div class="kv"><label>Pas fait aujourd'hui</label><div class="stack" id="rUndone">${undone.map((t) => `<div class="list-item" data-u="${t.id}"><div class="t">${esc(t.title)}</div><button class="chip" data-uact="tomorrow">demain</button><button class="chip" data-uact="idea">idée</button><button class="chip" data-uact="drop">laisser</button></div>`).join('')}</div></div>` : ''}
  <div class="kv"><label>Les 3 de demain, ${esc(fmtDay(tomorrow))}</label>${sug.length ? `<div class="chips" id="rSug">${sug.map((s, i) => `<button class="chip" data-s="${i}"><span class="dot" style="background:${catOf(s.cat).couleur}"></span>${esc(s.title)} <span class="muted">· ${esc(s.why)}</span></button>`).join('')}</div>` : ''}
  <div class="stack" id="rRows">${rows.map((r, i) => `<div class="card stack" data-r="${i}"><input class="rT" placeholder="${['La première, celle qui compte', 'La deuxième', 'La troisième (facultative)'][i]}" value="${esc(r.title)}" autocomplete="off">${chips(r.cat, 'cat' + i)}${blocksHtml(r.slot)}${r.src ? `<span class="muted small">${esc(r.src)}</span>` : ''}</div>`).join('')}</div></div>
  <button class="btn" id="rSave">Bonne nuit</button>`);
  const sh = $('#sheet'); bindChips(sh);
  sh.querySelectorAll('[data-mood]').forEach((b) => b.addEventListener('click', () => { setMood(d, Number(b.dataset.mood)); sh.querySelectorAll('[data-mood]').forEach((x) => x.classList.toggle('on', x === b)); }));
  const slots = rows.map((r) => r.slot);
  sh.querySelectorAll('[data-r]').forEach((row) => { const i = Number(row.dataset.r); row.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => { slots[i] = slots[i] === b.dataset.b ? null : b.dataset.b; row.querySelectorAll('[data-b]').forEach((x) => x.classList.toggle('on', x.dataset.b === slots[i])); })); });
  const uacts = {};
  sh.querySelectorAll('[data-u]').forEach((row) => row.querySelectorAll('[data-uact]').forEach((b) => b.addEventListener('click', () => { uacts[row.dataset.u] = b.dataset.uact; row.querySelectorAll('[data-uact]').forEach((x) => x.classList.toggle('on', x === b)); if (b.dataset.uact === 'tomorrow') fillRow(d.things.find((t) => t.id === row.dataset.u)); })));
  function fillRow(src) { const rs = [...sh.querySelectorAll('[data-r]')]; const free = rs.find((r) => !r.querySelector('.rT').value.trim()); if (!free) return; free.querySelector('.rT').value = src.title; const g = free.querySelector('[data-chips]'); g.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c.dataset.v === src.cat)); }
  sh.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { const s = sug[Number(b.dataset.s)]; fillRow({ title: s.title, cat: s.cat, est: estimate(S, s.cat) }); b.classList.add('on'); }));
  $('#rSave').addEventListener('click', () => {
    label('le rituel du soir');
    d.journal = $('#rJournal').value.trim();
    for (const [id, a] of Object.entries(uacts)) { const t = d.things.find((x) => x.id === id); if (!t) continue; if (a === 'idea') { S.ideas.push({ id: uid(), text: t.title, at: new Date().toISOString(), status: 'inbox' }); d.things = d.things.filter((x) => x !== t); } else if (a === 'drop') d.things = d.things.filter((x) => x !== t); }
    const kept = dt.things.filter((t) => !rows.some((r) => r.id === t.id));
    const news = [];
    sh.querySelectorAll('[data-r]').forEach((row, i) => { const title = row.querySelector('.rT').value.trim(); if (!title) return; const cat = chipValue(row, 'cat' + i) || 'perso'; const prev = rows[i].id ? dt.things.find((t) => t.id === rows[i].id) : null; news.push({ ...(prev || { id: uid(), done: false, real: 0 }), title, cat, est: null, slot: slots[i], src: prev ? prev.src : null, link: prev ? prev.link : (uacts && null) }); });
    for (const t of d.things.filter((x) => !x.done && uacts[x.id] === 'tomorrow')) { if (!news.some((n) => n.title === t.title)) news.push({ ...t, id: uid(), startedAt: null }); d.things = d.things.filter((x) => x !== t); }
    dt.things = [...news, ...kept]; dt.planned = true;
    const fin = say(S, 'rituel.fin', ernestEnv(S, today, plantNames()));
    save(); closeSheet(); render(); setErnest('dort'); setTimeout(() => setErnest(), 6000);
    const L = d.things.length && d.things.every((t) => t.done) ? drawLong(S, today) : null;
    if (L) { bubble(fin || 'Bonne nuit.'); setTimeout(() => cardSheet(L, true), 900); } else bubble(fin || 'Bonne nuit.');
    save();
  });
  setTimeout(() => $('#rJournal').focus(), 50);
}

// ---------- Semaine ----------
function viewSemaine() {
  const days = weekDays(today), wk = isoWeek(today), act = activeDays(S, days), counts = catCounts(S, days), max = Math.max(1, ...Object.values(counts));
  const minsOn = !S.settings.minimumsFrom || today >= S.settings.minimumsFrom, mins = minimums(S, days);
  const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  let h = `<div class="row spread"><h1>${act === 0 ? 'La semaine commence.' : act === 7 ? 'Sept jours sur sept.' : `${['Zéro', 'Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six'][act]} jour${act > 1 ? 's' : ''} sur sept.`}</h1><span class="muted small">${esc(wk)}</span></div>`;
  h += `<div class="week">${days.map((k, i) => `<div class="${isActive(S, k) ? 'on' : ''} ${k === today ? 'today' : ''} ${k > today ? 'dim' : ''}">${labels[i]}</div>`).join('')}</div>`;
  h += `<div class="lights" title="Lumière de la serre">${days.map((k) => { const m = dayOf(S, k).mood; return `<span style="background:${m === null || m === undefined ? 'var(--bg3)' : `rgba(242,178,61,${0.15 + m * 0.2})`}"></span>`; }).join('')}</div>`;
  const cats = CATS.filter((c) => counts[c.id] || mins.some((m) => m.cat === c.id));
  const tm = timeByCat(S, days), tTot = Object.values(tm).reduce((a, b) => a + b, 0);
  if (cats.length) h += `<div class="bars">${cats.map((c) => { const m = mins.find((x) => x.cat === c.id); const n = counts[c.id] || 0; return `<div><span>${c.nom}</span><i style="width:${Math.round((n / max) * 100)}%;background:${c.couleur}"></i><span class="muted">${n}${m && minsOn ? ` / ${m.min}` : ''}${tracking() && tm[c.id] ? ` · ${fmtMin(tm[c.id])}` : ''}</span></div>`; }).join('')}</div>`;
  if (tracking() && tTot) h += `<div class="card row spread"><span class="row">${icon('history')}<span>Temps mesuré cette semaine</span></span><b>${fmtMin(tTot)}</b></div>`;
  if (!minsOn) h += `<div class="muted small">Les minimums doux démarrent le ${new Date(S.settings.minimumsFrom + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}. D'ici là, seule la révision compte.</div>`;
  h += journalHtml();
  const reviewed = S.weeks[wk] && S.weeks[wk].reviewedAt;
  h += `<button class="btn ${dow(today) === 0 && !reviewed ? '' : 'ghost'}" data-act="review">${reviewed ? 'Revoir le point de la semaine' : 'Faire le point de la semaine'}</button>`;
  const goals = S.goals.filter((g) => g.status === 'active').sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1);
  h += `<div class="row spread" style="margin-top:6px"><h2>Objectifs</h2><button class="chip" data-act="addGoal">+ objectif</button></div>`;
  h += `<div class="muted small">Un cap et ses étapes. Coche une étape quand elle est faite : un bonsaï pousse dans la serre.</div>`;
  h += goals.length ? `<div class="stack">${goals.map((g) => { const c = catOf(g.cat), left = g.due ? Math.round((new Date(g.due) - new Date(today)) / 86400000) : null; const done = g.milestones.filter((m) => m.done).length; return `<div class="goal"><div class="row spread" data-act="goalEdit" data-id="${g.id}"><div class="row"><span class="dot" style="background:${c.couleur}"></span><b>${esc(g.title)}</b></div><span class="muted small">${g.due ? (left >= 0 ? `J-${left}` : 'passé') : g.horizon === 'week' ? 'semaine' : ''}</span></div>${g.milestones.map((m, i) => `<div class="ms ${m.done ? 'done' : ''}" data-act="goalMs" data-id="${g.id}" data-i="${i}"><span class="check">${m.done ? icon('check', 'sm') : ''}</span><span>${esc(m.text)}${m.due ? ` <span class="small">· ${new Date(m.due + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>` : ''}</span></div>`).join('')}${g.milestones.length ? `<div class="muted small">${done} / ${g.milestones.length} jalons${g.reviews && g.reviews[wk] ? ` · ${g.reviews[wk]}` : ''}</div>` : ''}</div>`; }).join('')}</div>` : `<div class="muted">Aucun objectif. Un court, un moyen, ça suffit.</div>`;
  if (Date.now() - (S.lastExportAt || 0) > 7 * 86400000 && totalDone(S) > 3) h += `<button class="card row spread" data-act="export" style="width:100%;text-align:left"><span>Sauvegarder la serre<br><span class="muted small">Tout est sur ce téléphone. Un export par semaine, par sécurité.</span></span><span style="color:var(--amber)">${icon('arrow')}</span></button>`;
  return h;
}
// Journal : les sept derniers jours, ce qui est fait et ce qui ne l'est pas.
function journalHtml(n = 7) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = addDays(today, -i), d = dayOf(S, k);
    const listDone = S.list.filter((l) => l.done && l.doneAt && l.doneAt.slice(0, 10) === k);
    if (!d.things.length && !listDone.length) continue;
    const done = d.things.filter((t) => t.done).length + listDone.length, open = d.things.filter((t) => !t.done).length;
    const dl = i === 0 ? "Aujourd'hui" : i === 1 ? 'Hier' : new Date(k + 'T12:00').toLocaleDateString('fr-FR', i < 7 ? { weekday: 'long', day: 'numeric' } : { weekday: 'long', day: 'numeric', month: 'long' });
    out.push(`<div class="jday"><div class="row spread"><b>${esc(dl.charAt(0).toUpperCase() + dl.slice(1))}</b><span class="muted small">${done} fait${done > 1 ? 's' : ''}${open ? ` · ${open} en suspens` : ''}</span></div>
    ${d.things.map((t) => `<div class="jrow ${t.done ? 'done' : ''}"><button class="check sm" data-act="jToggle" data-day="${k}" data-id="${t.id}" aria-label="${t.done ? 'Annuler' : 'Fait'}">${t.done ? icon('check') : ''}</button><span class="dot" style="background:${catOf(t.cat).couleur}"></span><span class="t">${esc(t.title)}</span>${t.done ? `<span class="muted small">${t.real ? `${t.real} min` : ''}</span><button class="mini" data-act="jDel" data-day="${k}" data-id="${t.id}" aria-label="Supprimer">${icon('trash')}</button>` : `${i ? `<button class="mini" data-act="jToday" data-day="${k}" data-id="${t.id}" aria-label="Remettre à aujourd'hui">${icon('sun')}</button>` : ''}<button class="mini" data-act="jDel" data-day="${k}" data-id="${t.id}" aria-label="Supprimer">${icon('trash')}</button>`}</div>`).join('')}
    ${listDone.map((l) => `<div class="jrow done"><button class="check sm" data-act="jListToggle" data-id="${l.id}" aria-label="Annuler">${icon('check')}</button><span class="dot" style="background:${l.cat ? catOf(l.cat).couleur : 'var(--fg2)'}"></span><span class="t">${esc(l.text)}</span><span class="muted small">liste</span><button class="mini" data-act="jListDel" data-id="${l.id}" aria-label="Supprimer">${icon('trash')}</button></div>`).join('')}</div>`);
  }
  if (n > 7) return out.length ? `<div class="stack">${out.join('')}</div>` : '<div class="muted">Rien encore.</div>';
  return out.length ? `<div class="row spread" style="margin-top:6px"><h2>Jour par jour</h2><button class="chip" data-act="history">${icon('history', 'sm')} Tout l'historique</button></div><div class="muted small">Ce qui est fait reste coché. Ce qui ne l'est pas : le soleil le remet à aujourd'hui, la corbeille le supprime. Une coche se retire d'un toucher.</div><div class="stack">${out.join('')}</div>` : '';
}
let historyOpen = false;
function historySheet() {
  const days = Object.keys(S.days).sort(), first = days[0] || today, n = Math.min(365, Math.max(7, Math.round((new Date(today) - new Date(first)) / 86400000) + 1));
  openSheet(`<div class="eyebrow">Historique</div><h2>Tout ce qui a été posé</h2><div class="muted small">Du plus récent au plus ancien. Le soleil remet une chose à aujourd'hui, la corbeille la supprime, une coche se retire d'un toucher.</div>${journalHtml(n)}`);
  historyOpen = true; bindView($('#sheet'));
}
function seriesSheet(se) {
  if (!se) return;
  openSheet(`<div class="eyebrow">Série</div><h2>${esc(se.title)}</h2><input id="seTitle" value="${esc(se.title)}" autocomplete="off">${chips(se.cat)}<div class="kv"><label>Quand dans la journée</label>${blocksHtml(se.slot)}</div>${repeatHtml(se.days)}<button class="btn" id="seSave">Enregistrer</button><button class="btn danger" id="seStop">${icon('trash', 'sm')} Arrêter la série</button><div class="muted small">Arrêter ne touche pas ce qui est déjà dans tes journées.</div>`);
  const sh = $('#sheet'); bindChips(sh); let slot = se.slot; const get = bindRepeat(sh, se.days);
  sh.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => { slot = slot === b.dataset.b ? null : b.dataset.b; sh.querySelectorAll('[data-b]').forEach((x) => x.classList.toggle('on', x.dataset.b === slot)); }));
  $('#seSave').addEventListener('click', () => { label('la série'); const days = get(); if (!days.length) { se.active = false; } else Object.assign(se, { title: $('#seTitle').value.trim() || se.title, cat: chipValue(sh, 'cat') || se.cat, slot, days }); save(); closeSheet(); render(); toast(days.length ? 'Série mise à jour.' : 'Série arrêtée.'); });
  $('#seStop').addEventListener('click', () => { label("l'arrêt de la série"); se.active = false; save(); closeSheet(); render(); toast('Série arrêtée.', 5000, () => { se.active = true; }); });
}
function goalSheet(g) {
  const isNew = !g; g = g || { id: uid(), title: '', cat: 'perso', due: null, horizon: 'month', milestones: [], status: 'active', reviews: {} };
  openSheet(`<h2>${isNew ? 'Un objectif' : 'Cet objectif'}</h2><input id="gTitle" value="${esc(g.title)}" placeholder="Quoi ?" autocomplete="off">${chips(g.cat)}<div class="row"><div class="kv" style="flex:1"><label>Échéance</label><input type="date" id="gDue" value="${g.due || ''}"></div><div class="kv"><label>Horizon</label><select id="gHor"><option value="week" ${g.horizon === 'week' ? 'selected' : ''}>Semaine</option><option value="month" ${g.horizon === 'month' ? 'selected' : ''}>Mois ou plus</option></select></div></div><div class="kv"><label>Jalons, un par ligne</label><textarea id="gMs">${esc(g.milestones.map((m) => m.text).join('\n'))}</textarea></div><button class="btn" id="gSave">${isNew ? 'Poser' : 'Enregistrer'}</button>${isNew ? '' : `<div class="btns"><button class="btn quiet" id="gDone">${icon('check', 'sm')} Atteint</button><button class="btn danger" id="gDel">${icon('trash', 'sm')} Supprimer</button></div>`}`);
  const sh = $('#sheet'); bindChips(sh);
  $('#gSave').addEventListener('click', () => { g.title = $('#gTitle').value.trim(); if (!g.title) return; g.cat = chipValue(sh, 'cat') || 'perso'; g.due = $('#gDue').value || null; g.horizon = $('#gHor').value; const lines = $('#gMs').value.split('\n').map((x) => x.trim()).filter(Boolean); g.milestones = lines.map((text) => g.milestones.find((m) => m.text === text) || { text, done: false }); if (isNew) S.goals.push(g); save(); closeSheet(); render(); });
  if (!isNew) { $('#gDone').addEventListener('click', () => { g.status = 'done'; g.doneAt = today; const c = drawRare(S, 'goal'); if (c) toast(`Carnet : « ${c.titre || ''} »`); save(); closeSheet(); render(); }); $('#gDel').addEventListener('click', () => { closeSheet(); removeGoal(g.id); }); }
}
function reviewSheet() {
  const wk = isoWeek(today), days = weekDays(today), goals = S.goals.filter((g) => g.status === 'active'), counts = catCounts(S, days), e = ernestEnv(S, today, plantNames());
  const inbox = S.ideas.filter((i) => i.status === 'inbox');
  openSheet(`<div class="eyebrow">Le point de la semaine</div><h2>${esc(say(S, 'dimanche', e) || 'On regarde ce qui a poussé.')}</h2>
  <div class="card stack"><div>${activeDays(S, days)} jour${activeDays(S, days) > 1 ? 's' : ''} actif${activeDays(S, days) > 1 ? 's' : ''}, ${Object.values(counts).reduce((a, b) => a + b, 0)} choses faites${(() => { const tm = timeByCat(S, days), tt = Object.values(tm).reduce((a, b) => a + b, 0); return tracking() && tt ? `, ${fmtMin(tt)} mesurées` : ''; })()}.</div><div class="muted small">${CATS.filter((c) => counts[c.id]).map((c) => `${c.nom} ${counts[c.id]}`).join(' · ') || 'Une semaine calme.'}</div></div>
  ${goals.length ? `<div class="kv"><label>Objectifs</label><div class="stack">${goals.map((g) => `<div class="card" data-g="${g.id}"><div><b>${esc(g.title)}</b></div><div class="chips" style="margin-top:6px">${['avancé', 'stable', 'à revoir'].map((v) => `<button class="chip ${g.reviews && g.reviews[wk] === v ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div></div>`).join('')}</div></div>` : ''}
  ${inbox.length ? `<div class="muted small">${inbox.length} idée${inbox.length > 1 ? 's' : ''} à trier dans la Liste, quand tu veux.</div>` : ''}
  <div class="kv"><label>Une ligne pour cette semaine</label><input id="wNote" value="${esc((S.weeks[wk] || {}).note || '')}" autocomplete="off"></div>
  <button class="btn" id="wSave">C'est vu</button>`);
  const sh = $('#sheet');
  sh.querySelectorAll('[data-g]').forEach((c) => c.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => { const g = S.goals.find((x) => x.id === c.dataset.g); g.reviews = g.reviews || {}; g.reviews[wk] = b.dataset.v; c.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b)); })));
  $('#wSave').addEventListener('click', () => {
    const first = !(S.weeks[wk] && S.weeks[wk].reviewedAt);
    S.weeks[wk] = { reviewedAt: new Date().toISOString(), note: $('#wNote').value.trim() };
    const n = Object.keys(S.weeks).length; if (n >= 10 && !S.milestones.d10) { S.milestones.d10 = today; drawRare(S, 'd10'); S.garden.objects.push({ kind: 'd10', day: today }); }
    save(); closeSheet(); render();
    const ep = first ? drawEpisode(S) : null; save();
    if (ep) setTimeout(() => cardSheet(ep, true), 400);
  });
}

// ---------- Carnet ----------
function viewCarnet() {
  const all = allCards(), log = S.cards.log || [], seen = Object.keys(S.cards.seen).length;
  const said = (S.ernest.log || []).filter((l) => l.at.slice(0, 10) === today).slice(0, 6);
  let h = `<h1>Le carnet.</h1><div class="muted small">${seen} carte${seen > 1 ? 's' : ''} sur ${all.length}. Elles arrivent avec ce que tu fais.</div>`;
  if (said.length) h += `<div class="card stack"><div class="eyebrow">Ernest, aujourd'hui</div>${said.map((l) => `<div class="small">${esc(l.t)}</div>`).join('')}</div>`;
  h += `<div class="chips"><button class="chip ${carnetFam === 'all' ? 'on' : ''}" data-act="fam" data-v="all">Tout</button>${FAMILLES.map((f) => `<button class="chip ${carnetFam === f.id ? 'on' : ''}" data-act="fam" data-v="${f.id}">${f.nom}</button>`).join('')}</div>`;
  const items = log.map((l) => ({ ...l, card: cardById(l.id) })).filter((x) => x.card && (carnetFam === 'all' || x.card.famille === carnetFam)).slice(0, 60);
  h += items.length ? `<div class="stack">${items.map((x) => cardHtml(x.card, x.at.slice(0, 10) === today)).join('')}</div>` : `<div class="muted">Rien encore ici. La première carte vient avec la première chose faite.</div>`;
  return h;
}
function cardHtml(c, isNew) {
  const fam = FAMILLES.find((f) => f.id === c.famille);
  return `<div class="carte ${isNew ? 'new' : ''}" data-act="openCard" data-id="${c.id}"><div class="fam">${esc(fam ? fam.nom : c.famille)}${c.ep ? ` · épisode ${c.ep}` : ''}${isNew ? ' · nouvelle' : ''}</div>${c.titre ? `<b>${esc(c.titre)}</b>` : ''}<p>${esc(c.rarete === 'courante' ? c.texte : c.texte.slice(0, 160) + (c.texte.length > 160 ? '…' : ''))}</p>${c.source ? `<div class="src">${esc(c.source).slice(0, 90)}</div>` : ''}</div>`;
}
function cardSheet(c, fresh = false) {
  const fam = FAMILLES.find((f) => f.id === c.famille);
  openSheet(`<div class="eyebrow">${esc(fam ? fam.nom : '')}${c.ep ? ` · épisode ${c.ep}` : ''}${fresh ? ' · nouvelle carte' : ''}</div>${c.titre ? `<h2>${esc(c.titre)}</h2>` : ''}<p style="white-space:pre-line;margin:0;line-height:1.55">${esc(c.texte)}</p>${c.source ? `<div class="muted small">${esc(c.source)}</div>` : ''}<div class="muted small">${c.fiabilite === 'sourcee' ? 'Sourcé.' : c.fiabilite === 'fiction' ? 'Fiction.' : 'Ernest ne garantit rien.'}</div><button class="btn quiet" id="cClose">Fermer</button>`);
  $('#cClose').addEventListener('click', closeSheet);
}

// ---------- Réglages ----------
function settingsSheet() {
  const s = S.settings;
  openSheet(`<h2>Réglages</h2>
  <div class="row"><div class="kv" style="flex:1"><label>Prénom</label><input id="sName" value="${esc(s.prenom)}"></div><div class="kv" style="flex:1"><label>Rituel du soir à partir de</label><input id="sHour" type="number" min="17" max="23" value="${s.ritualHour}"></div></div>
  <div class="row"><div class="kv" style="flex:1"><label>Prochain examen</label><input id="sExam" type="date" value="${s.exam || ''}"></div><div class="kv" style="flex:1"><label>Son nom</label><input id="sExamL" value="${esc(s.examLabel)}"></div></div>
  <div class="kv"><label>Minimums doux par semaine (0 = aucun), actifs à partir du</label><div class="row"><input id="sMinFrom" type="date" value="${s.minimumsFrom || ''}"></div><div class="chips">${CATS.map((c) => `<span class="chip"><span class="dot" style="background:${c.couleur}"></span>${c.nom} <input data-min="${c.id}" type="number" min="0" max="14" value="${s.minimums[c.id] || 0}" style="width:48px;padding:2px 6px;border-radius:8px"></span>`).join('')}</div></div>
  <label class="row" style="gap:10px"><input type="checkbox" id="sTrack" style="width:auto" ${s.trackTime !== false ? 'checked' : ''}> Mesurer le temps passé <span class="muted small">(Démarrer, Pause, bilan de la semaine)</span></label>
  <label class="row" style="gap:10px"><input type="checkbox" id="s3d" style="width:auto" ${s.garden3d !== false ? 'checked' : ''}> Serre en 3D <span class="muted small">(sinon la serre dessinée, plus légère)</span></label>
  <div class="muted small">Rappel du soir : iOS ne permet pas à Ernest d'envoyer une notification seul. Une alarme « ${s.ritualHour} h, Ernest » dans Horloge fait le travail.</div>
  <button class="btn" id="sSave">Enregistrer</button>
  <h3>Sauvegarde</h3><div class="btns"><button class="btn quiet" id="sExport">Exporter</button><button class="btn quiet" id="sImport">Importer</button></div>
  <div class="kv"><label>Pont (coller ce que Dec-Deonto, dec-revision ou le mémoire ont produit)</label><textarea id="sBridge" placeholder="#import=… ou JSON"></textarea><button class="btn quiet" id="sBridgeGo">Lire le pont</button></div>
  <div class="btns"><button class="btn quiet" id="sHelp">${icon('help', 'sm')} La visite</button><button class="btn quiet" id="sIntro">${icon('leaf', 'sm')} L'arrivée d'Ernest</button></div>
  <a class="btn quiet" href="./serre3d.html">${icon('cube', 'sm')} La serre à quatre stades (démonstration)</a>
  <button class="btn danger" id="sReset">${icon('trash', 'sm')} Tout effacer</button>
  <div class="muted small">Ernest ${VERSION} · ${totalDone(S)} choses faites · ${S.garden.plants.length} plantes</div>`);
  $('#sSave').addEventListener('click', () => { s.prenom = $('#sName').value.trim(); s.ritualHour = Number($('#sHour').value) || 21; s.exam = $('#sExam').value || null; s.examLabel = $('#sExamL').value.trim() || 'Examen'; s.minimumsFrom = $('#sMinFrom').value || null; s.trackTime = $('#sTrack').checked; const was3d = s.garden3d !== false; s.garden3d = $('#s3d').checked; if (was3d !== s.garden3d) { save(); location.reload(); return; } document.querySelectorAll('[data-min]').forEach((i) => { s.minimums[i.dataset.min] = Number(i.value) || 0; }); save(); closeSheet(); render(); });
  $('#sExport').addEventListener('click', exportSheet);
  $('#sImport').addEventListener('click', () => { openSheet(`<h2>Importer</h2><textarea id="impText" placeholder="Coller l'export JSON" style="min-height:140px"></textarea><button class="btn" id="impGo">Remplacer par cet export</button><div class="muted small">L'état actuel est gardé en copie.</div>`); $('#impGo').addEventListener('click', () => { const ns = store.importJSON($('#impText').value); if (!ns) { toast('Illisible.'); return; } store.snapshotPrev(S); S = ns; save(); closeSheet(); render(); toast('Importé.'); }); });
  $('#sBridgeGo').addEventListener('click', () => { const p = decode($('#sBridge').value); if (!p) { toast('Pont illisible.'); return; } importSheet(p); });
  $('#sIntro').addEventListener('click', () => { S.ernest.firstSeq = 0; save(); closeSheet(); greet(); });
  $('#sHelp').addEventListener('click', () => tourSheet(0));
  $('#sReset').addEventListener('click', () => { openSheet(`<h2>Tout effacer ?</h2><div class="muted">La serre, la liste, le carnet. Une copie de l'état actuel est gardée, récupérable depuis Réglages › Importer.</div><button class="btn" id="rsYes">Effacer</button><button class="btn quiet" id="rsNo">Non</button>`); $('#rsYes').addEventListener('click', () => { S = store.reset(S); save(); closeSheet(); render(); greet(); }); $('#rsNo').addEventListener('click', closeSheet); });
}
function exportSheet() {
  const text = store.exportJSON(S); S.lastExportAt = Date.now(); save();
  openSheet(`<h2>Exporter</h2><div class="muted small">Copie dans Notes, Fichiers ou un mail. Ce texte contient toute la serre.</div><div class="btns">${navigator.share ? '<button class="btn" id="exShare">Partager</button>' : ''}<button class="btn quiet" id="exCopy">Copier</button></div><textarea id="exText" style="min-height:120px;font-size:11px">${esc(text)}</textarea>`);
  if ($('#exShare')) $('#exShare').addEventListener('click', async () => { try { const f = new File([text], `ernest-${today}.json`, { type: 'application/json' }); if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'Ernest' }); else await navigator.share({ text, title: 'Ernest' }); } catch { /* annulé */ } });
  $('#exCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(text); toast('Copié.'); } catch { $('#exText').select(); } });
}

// ---------- Ponts ----------
function handleImport() {
  const p = decode(location.hash); if (!p) return;
  history.replaceState(null, '', location.pathname + location.search);
  importSheet(p);
}
function importSheet(p) {
  const names = { deonto: 'Dec-Deonto', revision: 'dec-revision', memoire: 'le mémoire' };
  openSheet(`<h2>${esc(names[p.src] || p.src)} propose</h2><div class="stack">${p.things.map((t) => `<div class="list-item"><span class="dot" style="background:${catOf(t.cat || 'revision').couleur}"></span><div class="t">${esc(t.title)}</div><span class="due">${t.day ? fmtDay(t.day).split(' ').slice(0, 2).join(' ') : 'aujourd\'hui'}${t.est ? ` · ${t.est} min` : ''}</span></div>`).join('')}${p.goals.map((g) => `<div class="list-item"><div class="t"><b>${esc(g.title)}</b> · ${(g.milestones || []).length} jalon${(g.milestones || []).length > 1 ? 's' : ''}</div></div>`).join('')}</div><button class="btn" id="impOk">Ajouter à la serre</button><button class="btn quiet" id="impNo">Ignorer</button>`);
  $('#impOk').addEventListener('click', () => {
    const r = merge(S, p, today);
    if (Array.isArray(p.history)) for (const hd of p.history) { if (!/^\d{4}-\d{2}-\d{2}$/.test(hd.day || '') || S.garden.plants.some((x) => x.day === hd.day && x.src === p.src)) continue; for (let i = 0; i < Math.min(3, Number(hd.n) || 0); i++) S.garden.plants.push({ id: uid(), cat: 'revision', day: hd.day, seed: Math.floor(Math.random() * 1e9), kind: 'plant', src: p.src }); if (!S.days[hd.day] && hd.n > 0) ensureDay(S, hd.day).things.push({ id: uid(), title: `Révision (${names[p.src] || p.src})`, cat: 'revision', est: 0, done: true, real: 0, src: p.src, doneAt: hd.day + 'T20:00:00' }); }
    save(); closeSheet(); render(); toast(`${r.things} chose${r.things > 1 ? 's' : ''}, ${r.goals} objectif${r.goals > 1 ? 's' : ''}, ${r.milestones} jalon${r.milestones > 1 ? 's' : ''} ajoutés.`, 3500);
  });
  $('#impNo').addEventListener('click', closeSheet);
}

init();
