// Synchronisation en ligne d'Ernest, via le Worker Cloudflare de Dec-Deonto (cloudflare/worker.js de ce dépôt-là).
// État : une seule copie en ligne (casier /ernest), versionnée (X-Rev). L'appareil retient la version dont il part et
// s'il a des changements non envoyés. Version en ligne inchangée : on envoie. Changée ailleurs et rien de neuf ici : on la
// reprend. Changée des deux côtés : la plus récente l'emporte, l'autre reste récupérable (état précédent gardé sur
// l'appareil, copie du jour sur le serveur).
// Ponts : les apps de révision déposent leur plan (casier /pont/<src>) ; il est ajouté tout seul, une fois par version.
import { importJSON, snapshotPrev } from './store.js';
import { decode, merge as mergeBridge, plantHistory } from './bridge.js';

const CFG_KEY = 'ernest.sync';
const DEC_CFG_KEY = 'dec1.sync'; // même origine que Dec-Deonto dans un navigateur : réglage repris s'il existe
const META_KEY = 'ernest.sync.meta';

const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const writeJSON = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const okCfg = (c) => (c && typeof c.url === 'string' && typeof c.token === 'string' && c.url && c.token ? c : null);

export function config() { return okCfg(readJSON(CFG_KEY)); }
// Réglage de Dec-Deonto sur le même navigateur, proposé pour pré-remplir
export function decConfig() { return okCfg(readJSON(DEC_CFG_KEY)); }
export function normalizeUrl(u) {
  const s = String(u || '').trim().replace(/\/+$/, '').replace(/\/(ernest|progress)$/, '');
  try { return new URL(s).protocol === 'https:' ? s : null; } catch { return null; }
}
export function setConfig(c) {
  if (!c) { writeJSON(META_KEY, null); return writeJSON(CFG_KEY, null); }
  const url = normalizeUrl(c.url); const token = String(c.token || '').trim();
  if (!url || !token) return false;
  writeJSON(META_KEY, { ...meta(), rev: null, dirty: true }); // nouvel appareil ou nouveau serveur : tout est à envoyer
  return writeJSON(CFG_KEY, { url, token });
}
// { rev (version en ligne dont part l'appareil), dirty (changements non envoyés), at (dernière synchro), error }
export function meta() { return { rev: null, dirty: true, at: 0, error: null, ...(readJSON(META_KEY) || {}) }; }
export function setMeta(m) { writeJSON(META_KEY, { ...meta(), ...m }); }
export function markDirty() { const m = meta(); if (!m.dirty) setMeta({ dirty: true }); }

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
// Empreinte courte d'un plan (pour ne l'ajouter qu'une fois par version)
export function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

async function call(f, url, opts, timeout) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeout) : null;
  try { return await f(url, { ...opts, cache: 'no-store', signal: ctl?.signal }); } catch { throw new Error('serveur injoignable (hors ligne ou adresse incorrecte)'); } finally { clearTimeout(timer); }
}
function fail(res) {
  const e = new Error(res.status === 401 ? 'code secret refusé' : res.status === 404 ? 'adresse incorrecte (Worker introuvable)' : res.status === 412 ? 'modifié ailleurs entre-temps' : `erreur du serveur (${res.status})`);
  e.status = res.status; return e;
}
const auth = (cfg) => ({ Authorization: `Bearer ${cfg.token}` });

// Lecture seule : version en ligne et plans déposés. `local` n'est jamais modifié.
// → { state (nouvel objet, ou local si rien ne change), rev, adopted, conflict, first, bridged: [{ src, things, goals, milestones }], needPush }
export async function pull(cfg, local, m, today, { fetch: f = globalThis.fetch, timeout = 15000 } = {}) {
  const res = await call(f, `${cfg.url}/ernest`, { headers: auth(cfg) }, timeout);
  let rev = null; let base = local; let adopted = false; let conflict = false;
  if (res.status === 200) {
    rev = res.headers.get('X-Rev') || '';
    const remote = importJSON(await res.text());
    if (!remote) throw new Error('copie en ligne illisible : rien n’a été écrasé');
    // Premier contact de cet appareil avec un serveur déjà rempli : la version en ligne l'emporte (celle d'ici est gardée).
    if (m.rev === null || (rev !== m.rev && (!m.dirty || num(remote.updatedAt) >= num(local.updatedAt)))) { base = remote; adopted = true; conflict = !!m.dirty; }
  } else if (res.status !== 204) throw fail(res);

  let ponts = {};
  const pr = await call(f, `${cfg.url}/ponts`, { headers: auth(cfg) }, timeout);
  if (pr.ok) { try { ponts = await pr.json(); } catch { ponts = {}; } }
  const st = JSON.parse(JSON.stringify(base));
  const bridged = [];
  for (const raw of Object.values(ponts || {})) {
    const p = decode(JSON.stringify(raw)); if (!p) continue;
    const h = hash(JSON.stringify(raw));
    if (st.bridges[p.src] && st.bridges[p.src].hash === h) continue;
    const r = mergeBridge(st, p, today); plantHistory(st, p);
    st.bridges[p.src].hash = h;
    bridged.push({ src: p.src, ...r });
  }
  const needPush = rev === null || bridged.length > 0 || (!adopted && (m.dirty || rev !== m.rev));
  return { state: adopted || bridged.length ? st : local, rev, adopted, conflict, first: m.rev === null, bridged, needPush };
}

// Envoi, à condition que la version en ligne soit toujours `rev` (sinon erreur 412). → nouvelle version
export async function push(cfg, state, rev, { fetch: f = globalThis.fetch, timeout = 15000 } = {}) {
  const res = await call(f, `${cfg.url}/ernest`, { method: 'PUT', headers: { ...auth(cfg), 'Content-Type': 'application/json', 'If-Match': rev || '' }, body: JSON.stringify(state) }, timeout);
  if (!res.ok) throw fail(res);
  return res.headers.get('X-Rev') || (await res.json()).rev;
}

// Avant de remplacer l'état local par la version en ligne quand les deux ont changé
export const keepLocal = (local) => snapshotPrev(local);
