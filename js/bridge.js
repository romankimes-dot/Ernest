// Ponts avec les apps de révision et le dépôt du mémoire.
// Format unique : { v: 1, src, things: [{ title, cat, est, link, day, note }], goals: [{ title, cat, due, milestones: [text|{text,done}] }] }
// transporté dans l'adresse (#import=<base64url(JSON UTF-8)>) ou collé dans Réglages.
import { uid, ensureDay } from './model.js';

const b64 = {
  enc: (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};
export const encode = (payload) => b64.enc(JSON.stringify(payload));
export function decode(text) {
  if (!text) return null;
  let s = String(text).trim();
  const m = s.match(/#import=([A-Za-z0-9_\-=]+)/); if (m) s = m[1];
  try { return valid(JSON.parse(s)); } catch { /* pas du JSON brut */ }
  try { return valid(JSON.parse(b64.dec(s))); } catch { return null; }
}
function valid(p) {
  if (!p || typeof p !== 'object' || !p.src) return null;
  return { v: 1, src: String(p.src), things: Array.isArray(p.things) ? p.things : [], goals: Array.isArray(p.goals) ? p.goals : [], ...(Array.isArray(p.history) ? { history: p.history } : {}) };
}
export const linkFor = (payload, base = 'https://romankimes-dot.github.io/Ernest/') => `${base}#import=${encode(payload)}`;

// Fusion sans doublon. Retourne { things: n, goals: n, milestones: n }.
export function merge(state, payload, today) {
  const r = { things: 0, goals: 0, milestones: 0 };
  const br = state.bridges[payload.src] || (state.bridges[payload.src] = { last: null, days: {} });
  br.last = new Date().toISOString();
  for (const t of payload.things) {
    if (!t || !t.title) continue;
    const day = /^\d{4}-\d{2}-\d{2}$/.test(t.day || '') ? t.day : today;
    const d = ensureDay(state, day);
    // déjà reçue une fois pour ce jour (même supprimée depuis) : jamais remise
    if (d.things.some((x) => x.title === t.title && x.src === payload.src) || (br.days[day] || []).includes(t.title)) continue;
    d.things.push({ id: uid(), title: String(t.title).slice(0, 120), cat: t.cat || 'revision', est: Number(t.est) || 30, slot: t.slot || null, src: payload.src, link: t.link || null, note: t.note || null, done: false, real: 0 });
    (br.days[day] = br.days[day] || []).push(t.title);
    r.things++;
  }
  for (const g of payload.goals) {
    if (!g || !g.title) continue;
    let goal = state.goals.find((x) => x.title === g.title && x.src === payload.src);
    if (!goal) {
      goal = { id: uid(), title: String(g.title).slice(0, 120), cat: g.cat || 'revision', due: g.due || null, horizon: 'month', milestones: [], status: 'active', src: payload.src, reviews: {} };
      state.goals.push(goal); r.goals++;
    } else if (g.due) goal.due = g.due;
    for (const m of g.milestones || []) {
      const text = typeof m === 'string' ? m : m && m.text; if (!text) continue;
      const ex = goal.milestones.find((x) => x.text === text);
      if (ex) { if (m && m.done) ex.done = true; continue; }
      goal.milestones.push({ text: String(text).slice(0, 160), done: !!(m && m.done), due: (m && m.due) || null }); r.milestones++;
    }
  }
  return r;
}

export const SRC_NAMES = { deonto: 'Dec-Deonto', revision: 'dec-revision', memoire: 'le mémoire' };
// Jours déjà travaillés dans l'app de révision : des plantes dans la serre (trois au plus par jour), une fois par jour.
export function plantHistory(state, payload) {
  if (!Array.isArray(payload.history)) return 0;
  let n = 0;
  for (const hd of payload.history) {
    if (!hd || !/^\d{4}-\d{2}-\d{2}$/.test(hd.day || '') || state.garden.plants.some((x) => x.day === hd.day && x.src === payload.src)) continue;
    for (let i = 0; i < Math.min(3, Number(hd.n) || 0); i++) { state.garden.plants.push({ id: uid(), cat: 'revision', day: hd.day, seed: Math.floor(Math.random() * 1e9), kind: 'plant', src: payload.src }); n++; }
    if (!state.days[hd.day] && hd.n > 0) ensureDay(state, hd.day).things.push({ id: uid(), title: `Révision (${SRC_NAMES[payload.src] || payload.src})`, cat: 'revision', est: 0, done: true, real: 0, src: payload.src, doneAt: hd.day + 'T20:00:00' });
  }
  return n;
}

// « Recevoir à nouveau » : oublie ce qui a été reçu ce jour-là (et la dernière version du plan), pour tout reprendre.
export function forgetDay(state, day) {
  let n = 0;
  for (const br of Object.values(state.bridges || {})) { if (br.days && br.days[day]) { delete br.days[day]; n++; } delete br.hash; }
  return n;
}
