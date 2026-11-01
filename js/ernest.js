// Ernest : le gobelin (SVG), ses états, sa bulle, et le moteur de répliques.
import { chooseLine, fillLine, jMinus, moodAvg, dayOf, addDays, dow, totalDone, catOf } from './model.js';

let LINES = [];
export async function loadLines() {
  try { LINES = await (await fetch('./data/ernest/repliques.json')).json(); } catch { LINES = []; }
  return LINES.length;
}
export const linesLoaded = () => LINES.length;

// Environnement du moment, pour les conditions des répliques et les variables.
export function env(state, today, plantsNames = []) {
  const yesterday = addDays(today, -1);
  const d = parseInt(today.slice(0, 4), 10);
  const first = Object.keys(state.days).sort()[0];
  const idea = [...state.ideas].reverse().find((i) => i.status === 'inbox');
  const doneY = dayOf(state, yesterday).things.some((t) => t.done);
  const dim = Object.keys(state.weeks).length;
  const week = (() => { const ws = []; for (let i = 0; i < 7; i++) { const k = addDays(today, -i); if (dayOf(state, k).things.some((t) => t.done)) ws.push(k); } return ws.length; })();
  return {
    j: jMinus(state.settings.exam, today), dow: dow(today), mood: moodAvg(state, today),
    doneYesterday: doneY, hasIdea: !!idea, firstWeek: !first || (Number(today.replace(/-/g, '')) - Number(first.replace(/-/g, '')) < 7),
    month: parseInt(today.slice(5, 7), 10), n: totalDone(state), year: d,
    vars: {
      plante: plantsNames[Math.floor(Math.random() * plantsNames.length)] || 'le thym',
      jours: week, idee: idea ? idea.text : '', j: jMinus(state.settings.exam, today), n: totalDone(state), dimanches: dim, prenom: state.settings.prenom || '',
    },
  };
}

// Une réplique pour un contexte ; mémorise ce qui a été dit (index de ligne -> timestamp).
export function say(state, ctx, e, extra = {}) {
  const l = chooseLine(LINES, ctx, { ...e, seq: extra.seq }, state.ernest.said);
  if (!l) return null;
  state.ernest.said[l._i] = Date.now();
  return fillLine(l.t, { ...e.vars, ...extra });
}

export const hourCtx = (h) => (h >= 5 && h < 11 ? 'ouverture.matin' : h >= 11 && h < 17 ? 'ouverture.midi' : h >= 17 && h < 21 ? 'ouverture.soir' : 'ouverture.nuit');

// ----- Le dessin -----
// États : attend | arrose | assis | dort | salue | lanterne
export function svg(state = 'attend') {
  const arm = {
    attend: '<path d="M150 150l20-70" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"/><path d="M166 82l6-14 8 4-6 14z" fill="#b7b7b7"/>',
    arrose: '<g class="e-arm"><path d="M148 150l30-40" stroke="#4a8a5a" stroke-width="10" stroke-linecap="round"/><path d="M170 96l26-6 4 14-24 8z" fill="#5f87a8"/><path d="M196 92l12-8" stroke="#5f87a8" stroke-width="5" stroke-linecap="round"/><g class="e-drops"><circle cx="212" cy="96" r="2" fill="#8fd3f4"/><circle cx="218" cy="108" r="2" fill="#8fd3f4"/><circle cx="210" cy="118" r="2" fill="#8fd3f4"/></g></g>',
    assis: '',
    dort: '<text x="150" y="60" font-family="Georgia,serif" font-size="18" fill="#efe6d2" class="e-zzz">z z</text>',
    salue: '<path d="M148 146l24-60" stroke="#4a8a5a" stroke-width="10" stroke-linecap="round" class="e-wave"/>',
    lanterne: '<path d="M150 150l20-70" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"/><rect x="160" y="60" width="20" height="26" rx="4" fill="#3b2a12"/><rect x="164" y="64" width="12" height="18" rx="2" fill="#f2b23d" class="e-glow"/>',
  }[state] || '';
  const eyes = state === 'dort'
    ? '<path d="M77 100q7 4 14 0M111 100q7 4 14 0" stroke="#0b1511" stroke-width="3" fill="none" stroke-linecap="round"/>'
    : '<circle cx="84" cy="100" r="7" fill="#0b1511"/><circle cx="118" cy="100" r="7" fill="#0b1511"/><circle cx="86" cy="98" r="2.2" fill="#fff"/><circle cx="120" cy="98" r="2.2" fill="#fff"/>';
  const mouth = state === 'dort' ? '<circle cx="100" cy="124" r="3" fill="#0b1511"/>' : state === 'salue' ? '<path d="M84 120c8 12 24 12 32 0" stroke="#0b1511" stroke-width="3" fill="none" stroke-linecap="round"/>' : '<path d="M86 122c8 8 20 8 28 0" stroke="#0b1511" stroke-width="3" fill="none" stroke-linecap="round"/>';
  const body = state === 'assis'
    ? '<path d="M66 150h68l6 46H60z" fill="#2f6b48"/><path d="M66 150h68v18H66z" fill="#3f8a5c"/><path d="M40 196h120v10H40z" fill="#8a5a2b"/><path d="M60 190l-24 6v10l24-4z" fill="#5fae6d"/><path d="M140 190l24 6v10l-24-4z" fill="#5fae6d"/>'
    : '<path d="M70 140h60l10 70H60z" fill="#2f6b48"/><path d="M70 140h60v18H70z" fill="#3f8a5c"/><path d="M62 150l-26 40 10 6 26-36z" fill="#5fae6d"/><path d="M138 150l26 40-10 6-26-36z" fill="#5fae6d"/><path d="M36 190l-8 10 9 4z" fill="#8fc98f"/><path d="M164 190l8 10-9 4z" fill="#8fc98f"/>';
  return `<svg viewBox="0 0 230 240" class="ernest e-${state}" aria-label="Ernest">
  <ellipse cx="100" cy="226" rx="60" ry="8" fill="#000" opacity=".35"/>
  ${body}
  <g class="e-head">
  <ellipse cx="100" cy="100" rx="46" ry="42" fill="#6cbb74"/>
  <path d="M54 98c-20-6-34-2-44 8 14 2 26 6 44 4z" fill="#6cbb74"/><path d="M146 98c20-6 34-2 44 8-14 2-26 6-44 4z" fill="#6cbb74"/>
  <path d="M58 70c6-30 30-46 44-52-2 20 12 30 42 40-20 4-60 10-86 12z" fill="#c7772a"/>
  <path d="M40 76c30 10 100 8 124-2l6 10c-40 12-96 14-136 4z" fill="#a85f1f"/>
  ${eyes}<path d="M100 108c-6 6-4 12 0 14 4-2 6-8 0-14z" fill="#3f8a5c"/>${mouth}
  </g>
  ${arm}
  <rect x="54" y="186" width="26" height="22" rx="4" fill="#c7772a"/><path d="M58 186c6-14 10-20 16-22 2 6 0 14-2 22z" fill="#5fae6d"/>
</svg>`;
}

// État d'Ernest selon l'heure et la journée.
export function stateFor(hour, { allDone = false, justDid = false, sunday = false } = {}) {
  if (hour >= 22 || hour < 6) return 'dort';
  if (justDid) return 'arrose';
  if (sunday) return 'assis';
  if (allDone) return 'assis';
  if (hour >= 19) return 'lanterne';
  return 'attend';
}
export const plantName = (p) => ({ revision: 'la lavande', corps: 'le cactus', esprit: 'la fougère', cuisine: 'le basilic', boulot: 'le ficus', perso: 'la menthe' }[p.cat] || catOf(p.cat).nom.toLowerCase());
