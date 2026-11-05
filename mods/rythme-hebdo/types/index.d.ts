export type Snap = { t: number; pct: number }

export type Week = {
  used: number
  resetsAt: string
  fiveHour: number | null
  fiveHourResetsAt: string | null
  history: Snap[]
}

declare module 'claude-code' {
  interface PluginState {
    'rythme-hebdo': { week: Shaped<Week | null>; now: number }
  }
}
