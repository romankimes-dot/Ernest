import { expect, test } from 'claude-code/testing'

const DAY = 86_400_000

test('le bandeau et le panneau montrent le rythme hebdo', async ($, on) => {
  const now = Date.UTC(2026, 10, 5, 12)
  on('clock.now', () => ({ value: now }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('ui.status', () => ({ value: undefined }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.surfaces', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'no-surface' } }))

  // Moitié de la fenêtre écoulée, 70 % utilisé : 20 pts d'avance.
  await $.session.measure({
    context: { contextWindowSize: 200000 } as never,
    rateLimits: [
      { kind: 'seven_day', percentUsed: 70, resetsAt: new Date(now + 3.5 * DAY).toISOString() },
      { kind: 'five_hour', percentUsed: 12 },
    ],
    changed: ['rateLimits'],
  })

  const out = await $.command.run({ command: 'hebdo', args: '' } as never)
  expect((out as { text: string }).text).toMatch(/Projection au reset : 140%/)

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const band = await $.ui.mount({ plugin: 'rythme-hebdo', surface, component: 'AbovePrompt', props: { hasSurvey: false } } as never)
    expect((await band.find({ key: 'hebdo' }))?.text).toMatch(/Semaine 70%.*rythme 50% \(\+20\)/)
    await band.unmount()

    const pane = await $.ui.mount({
      plugin: 'rythme-hebdo', surface, component: 'Pane', requestId: 'rythme-hebdo',
      props: { title: 'Crédit hebdo', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    } as never)
    expect(await pane.find({ type: 'Text', text: /140%/ })).toBeDefined()
    expect(await pane.find({ type: 'Text', text: /8\.6%\/jour/ })).toBeDefined()
    await pane.unmount()
  }
})
