import { atom, read, update } from 'claude-code'
import type { EngineInterface as Api, Register, SessionRateLimit } from 'claude-code'

import type { Snap, Week } from '../types'

const PANE = 'rythme-hebdo'
const TITLE = 'Crédit hebdo'
const HOUR = 3_600_000
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
const jour = (t: number) => JOURS[new Date(t).getDay()] ?? ''

const week = atom({ plugin: 'rythme-hebdo', key: 'week' } as const, null, {
  shape: 'week-1',
})
const clockNow = atom({ plugin: 'rythme-hebdo', key: 'now' } as const, 0)

type Pace = 'rapide' | 'avance' | 'ok' | 'marge'

type Analysis = {
  used: number
  expected: number
  delta: number
  pace: Pace
  projection: number | null
  emptyAt: number | null
  resetAt: number
  perDayLeft: number | null
  days: { label: string; pct: number | null; isToday: boolean }[]
  since: number | null
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const round1 = (x: number) => Math.round(x * 10) / 10
const sign = (x: number) => (x > 0 ? `+${round1(x)}` : `${round1(x)}`)

const fmtWhen = (t: number) => {
  const d = new Date(t)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${jour(t)} ${hh}:${mm}`
}

const resetKey = (resetsAt: string) =>
  String(Math.round(Date.parse(resetsAt) / HOUR))

function analyze(w: Week, now: number): Analysis {
  const resetAt = Date.parse(w.resetsAt)
  const start = resetAt - WEEK
  const elapsed = clamp((now - start) / WEEK, 0, 1)
  const expected = elapsed * 100
  const delta = w.used - expected
  const pace: Pace =
    delta > 10 ? 'rapide' : delta > 3 ? 'avance' : delta < -10 ? 'marge' : 'ok'

  const elapsedMs = now - start
  const projection = elapsed > 0.02 ? w.used / elapsed : null
  let emptyAt: number | null = null
  if (w.used > 0 && elapsedMs > 0 && w.used < 100) {
    const t = now + ((100 - w.used) / w.used) * elapsedMs
    if (t < resetAt) emptyAt = t
  }
  const daysLeft = (resetAt - now) / DAY
  const perDayLeft = daysLeft > 0.05 ? Math.max(0, 100 - w.used) / daysLeft : null

  // Consommation par jour de la fenêtre, à partir des relevés enregistrés.
  const snaps = w.history.filter(s => s.t >= start && s.t <= resetAt)
  const first = snaps[0]
  const since = first ? first.t : null
  const days: Analysis['days'] = []
  let prevEnd: number | null = null
  for (let i = 0; i < 7; i++) {
    const dStart = start + i * DAY
    const dEnd = dStart + DAY
    const label = jour(dStart)
    const isToday = now >= dStart && now < dEnd
    if (dStart > now) {
      days.push({ label, pct: null, isToday })
      continue
    }
    const inDay = snaps.filter(s => s.t < dEnd)
    const lastIn = inDay[inDay.length - 1]
    if (!lastIn || !first) {
      days.push({ label, pct: null, isToday })
      continue
    }
    const end = lastIn.pct
    const base = prevEnd ?? (first.t <= dStart + HOUR ? 0 : first.pct)
    days.push({ label, pct: Math.max(0, round1(end - base)), isToday })
    prevEnd = end
  }

  return {
    used: w.used,
    expected,
    delta,
    pace,
    projection,
    emptyAt,
    resetAt,
    perDayLeft,
    days,
    since,
  }
}

const PACE_TEXT: Record<Pace, string> = {
  rapide: 'Trop rapide',
  avance: 'Légèrement en avance',
  ok: 'Dans le rythme',
  marge: 'Sous-utilisé (marge dispo)',
}
const PACE_COLOR: Record<Pace, 'error' | 'warning' | 'success' | 'suggestion'> = {
  rapide: 'error',
  avance: 'warning',
  ok: 'success',
  marge: 'suggestion',
}

function bar(used: number, expected: number, width: number) {
  const cells: string[] = []
  const filled = Math.round((clamp(used, 0, 100) / 100) * width)
  const mark = clamp(Math.round((expected / 100) * width), 0, width - 1)
  for (let i = 0; i < width; i++) cells.push(i < filled ? '█' : '░')
  cells[mark] = '┃'
  return cells.join('')
}

function statusText(a: Analysis) {
  const proj = a.projection === null ? '' : ` · proj. ${Math.round(a.projection)}%`
  return `Hebdo ${round1(a.used)}% · rythme ${Math.round(a.expected)}% (${sign(a.delta)} pts)${proj}`
}

// Rapport texte : seul affichage disponible sur les interfaces web/mobile.
function report(w: Week, a: Analysis, lastWeek: number | undefined, now: number) {
  const pct = (x: number) => `${Math.round(x)} %`
  const gap = Math.abs(Math.round(a.delta))
  const verdict: Record<Pace, string> = {
    rapide: `🔴 Tu consommes trop vite : ${gap} points d'avance sur un rythme régulier.`,
    avance: `🟠 Un peu rapide : ${gap} points d'avance sur un rythme régulier.`,
    ok: `🟢 Tu es dans le rythme (écart de ${gap} point${gap > 1 ? 's' : ''}).`,
    marge: `🔵 Tu as de la marge : ${gap} points de moins qu'un rythme régulier.`,
  }
  const daysLeft = Math.max(0, (a.resetAt - now) / DAY)
  const lines = [
    `Crédit de la semaine : ${pct(a.used)} utilisé — ${pct(a.expected)} de la semaine écoulée.`,
    `${bar(a.used, a.expected, 20)}   (┃ = où tu devrais en être)`,
    verdict[a.pace],
    '',
  ]
  if (a.emptyAt !== null) {
    lines.push(`⚠ À ce rythme, plus de crédit vers ${fmtWhen(a.emptyAt)}, avant la remise à zéro.`)
  } else if (a.projection !== null) {
    lines.push(`À ce rythme, tu finiras la semaine à ${pct(a.projection)}.`)
  }
  if (a.perDayLeft !== null) {
    const jours = daysLeft.toFixed(1).replace('.', ',')
    lines.push(
      `Il te reste ${pct(100 - a.used)} pour ${jours} jours : environ ${pct(a.perDayLeft)} par jour (rythme régulier : 14 % par jour).`,
    )
  }
  lines.push(`Remise à zéro : ${fmtWhen(a.resetAt)}.`)
  const known = a.days.filter(d => d.pct !== null)
  if (known.length >= 2) {
    lines.push('Consommé par jour : ' + known.map(d => `${d.label} ${pct(d.pct ?? 0)}`).join(' · '))
  }
  if (typeof lastWeek === 'number') lines.push(`Semaine précédente : ${pct(lastWeek)}.`)
  if (w.fiveHour !== null) {
    const reset = w.fiveHourResetsAt ? `, remise à zéro ${fmtWhen(Date.parse(w.fiveHourResetsAt))}` : ''
    lines.push(`Limite courte (sur 5 h) : ${pct(w.fiveHour)} utilisé${reset}.`)
  }
  return lines.join('\n')
}

function pick(limits: SessionRateLimit[], kind: string) {
  return limits.find(l => l.kind === kind)
}

async function record($: Api, limits: SessionRateLimit[]) {
  const seven = pick(limits, 'seven_day')
  if (!seven?.resetsAt) return
  const now = await $.clock.now()
  const five = pick(limits, 'five_hour')
  const key = resetKey(seven.resetsAt)

  type Stored = { key: string; snaps: Snap[] }
  const stored = ((await $.store.get('history')) ?? null) as Stored | null
  let snaps: Snap[] = []
  if (stored && stored.key === key) {
    snaps = stored.snaps
  } else {
    const prev = stored?.snaps[stored.snaps.length - 1]
    if (prev) await $.store.set('lastWeek', prev.pct)
  }
  const last = snaps[snaps.length - 1]
  if (!last || last.pct !== seven.percentUsed || now - last.t > 30 * 60_000) {
    snaps = [...snaps, { t: now, pct: seven.percentUsed }].slice(-2000)
    await $.store.set('history', { key, snaps })
  }

  const w: Week = {
    used: seven.percentUsed,
    resetsAt: seven.resetsAt,
    fiveHour: five ? five.percentUsed : null,
    fiveHourResetsAt: five?.resetsAt ?? null,
    history: snaps,
  }
  await update($, week, () => w)
  await update($, clockNow, () => now)
  await refreshStatus($, w, now, key)
}

// Le bandeau au-dessus du prompt n'existe que sur le terminal et le desktop.
async function hasBand($: Api) {
  const surfaces = await $.session.surfaces()
  return surfaces.some(s => s === 'terminal' || s === 'desktop')
}

let paneOpened = false

async function refreshStatus($: Api, w: Week, now: number, key: string) {
  const a = analyze(w, now)
  // Ligne de statut compacte : visible sur les surfaces sans bandeau.
  $.ui.status(`● ${statusText(a)}`)
  if (!paneOpened && !(await hasBand($))) {
    paneOpened = true
    const opened = await $.ui.open({ id: PANE, title: TITLE })
    await $.store.set('diag', {
      surfaces: await $.session.surfaces(),
      open: opened,
    })
  }
  if (a.pace === 'rapide') {
    const warnedKey = `warned:${key}`
    if (!(await $.store.get(warnedKey))) {
      await $.store.set(warnedKey, true)
      const fin = a.emptyAt ? ` — épuisé vers ${fmtWhen(a.emptyAt)}` : ''
      $.ui.toast(`Crédit hebdo : ${sign(a.delta)} pts au-dessus du rythme${fin}`, {
        timeoutMs: 8000,
      })
    }
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    await $.command.register({
      name: 'hebdo',
      description: 'Afficher le suivi du crédit hebdomadaire (rythme, projection)',
    })
    const usage = await $.session.usage()
    await $.store.set('diag', { surfaces: await $.session.surfaces(), at: 'start' })
    await record($, usage.rateLimits)
    // Le rythme attendu avance avec le temps, même sans requête.
    $.clock.every(5 * 60_000, () => {
      void (async () => {
        const now = await $.clock.now()
        await update($, clockNow, () => now)
        const w = await read($, week)
        if (w) await refreshStatus($, w, now, resetKey(w.resetsAt))
      })()
    })
    return ran
  })

  on('session.attach', async ($, e, next) => {
    const ran = await next(e)
    paneOpened = false
    const w = await read($, week)
    if (w) await refreshStatus($, w, await $.clock.now(), resetKey(w.resetsAt))
    return ran
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await record($, e.rateLimits)
    return next(e)
  })

  on('command.run', { command: 'hebdo' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    const w = await read($, week)
    if (!w) {
      return {
        text: "Pas encore de relevé hebdomadaire (envoie un message ; disponible uniquement avec un abonnement Pro/Max).",
      }
    }
    const lastWeek = (await $.store.get('lastWeek')) as number | undefined
    const now = await $.clock.now()
    return { text: report(w, analyze(w, now), lastWeek, now) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const w = await read($, week)
    if (!w || e.props.hasSurvey) return next(e)
    const now = (await read($, clockNow)) || (await $.clock.now())
    const a = analyze(w, now)
    const { Box, Text, Button } = $.ui.resolve(e)
    // Une seule ligne discrète ; un clic ouvre le panneau de détail.
    return (
      <Box flexDirection="row">
        <Button
          key="hebdo"
          plain
          dimColor
          onPress={() => void $.ui.open({ id: PANE, title: TITLE })}
        >
          <Text color={PACE_COLOR[a.pace]}>●</Text> Semaine {Math.round(a.used)}%
          <Text dimColor> · rythme {Math.round(a.expected)}% ({sign(Math.round(a.delta))})</Text>
        </Button>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const w = await read($, week)
    if (!w) {
      return (
        <Box flexDirection="column">
          <Text dimColor>
            En attente du premier relevé de la fenêtre de 7 jours (envoie un message).
          </Text>
          <Text dimColor>Les limites hebdomadaires ne sont données qu'avec un abonnement.</Text>
        </Box>
      )
    }
    const now = (await read($, clockNow)) || (await $.clock.now())
    const a = analyze(w, now)
    const lastWeek = (await $.store.get('lastWeek')) as number | undefined
    const width = clamp((e.props.bodyColumns ?? 40) - 8, 10, 40)
    const maxDay = Math.max(1, ...a.days.map(d => d.pct ?? 0))
    const daily = 100 / 7

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text weight="bold">Semaine en cours</Text>
          <Text color={PACE_COLOR[a.pace]}>{bar(a.used, a.expected, width)}</Text>
          <Text>
            Utilisé <Text weight="bold">{round1(a.used)}%</Text>
            <Text dimColor> · attendu à ce stade {Math.round(a.expected)}% (┃)</Text>
          </Text>
          <Text color={PACE_COLOR[a.pace]} weight="bold">
            {PACE_TEXT[a.pace]} : {sign(a.delta)} pts
          </Text>
        </Box>

        <Box flexDirection="column">
          <Text weight="bold">Projection</Text>
          {a.projection !== null && (
            <Text>
              À ce rythme : <Text weight="bold">{Math.round(a.projection)}%</Text> au reset
            </Text>
          )}
          {a.emptyAt !== null && (
            <Text color="error">Crédit épuisé vers {fmtWhen(a.emptyAt)}</Text>
          )}
          {a.perDayLeft !== null && (
            <Text>
              Budget restant : <Text weight="bold">{round1(a.perDayLeft)}%/jour</Text>
              <Text dimColor> (régulier : {round1(daily)}%/jour)</Text>
            </Text>
          )}
          <Text dimColor>Reset : {fmtWhen(a.resetAt)}</Text>
          {typeof lastWeek === 'number' && (
            <Text dimColor>Semaine précédente : {round1(lastWeek)}%</Text>
          )}
        </Box>

        <Box flexDirection="column">
          <Text weight="bold">Par jour</Text>
          {a.days.map(d => {
            const n = d.pct === null ? 0 : Math.round((d.pct / maxDay) * (width - 12))
            const over = d.pct !== null && d.pct > daily * 1.3
            return (
              <Text dimColor={d.pct === null}>
                {d.isToday ? '›' : ' '} {d.label}{' '}
                <Text color={over ? 'warning' : 'success'}>{'▇'.repeat(n)}</Text>
                {d.pct === null ? ' —' : ` ${d.pct}%`}
              </Text>
            )
          })}
          {a.since !== null && (
            <Text dimColor>Relevés depuis {fmtWhen(a.since)} · repère {round1(daily)}%/jour</Text>
          )}
        </Box>

        {w.fiveHour !== null && (
          <Box flexDirection="column">
            <Text weight="bold">Fenêtre 5 h</Text>
            <Text>
              {round1(w.fiveHour)}%
              {w.fiveHourResetsAt && (
                <Text dimColor> · reset {fmtWhen(Date.parse(w.fiveHourResetsAt))}</Text>
              )}
            </Text>
          </Box>
        )}
      </Box>
    )
  })
}
