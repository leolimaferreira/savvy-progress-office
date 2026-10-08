import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PLUGIN = 'savvy-progress'
const SURFACES = ['terminal', 'desktop'] as const
const scroll = { offset: 0, bodyRows: 40 }
const view = {}
const BAND = { component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll, view: {} } } as const
const PANE = {
  component: 'Pane',
  requestId: 'savvy-agents',
  props: { title: 'Office', isFocused: true, bodyColumns: 80, placement: 'dock', scroll, view },
} as const

// The engine beneath the plugin: each event answered as the session would.
const engine = (on: On) => {
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('session.start', async (_$, e) => ({ cwd: e.cwd }))
  on('tool.register', async (_$, e) => ({ value: { tool: e.name } }))
  on('command.register', async (_$, e) => ({ value: { command: e.name } }))
  on('settings.read', async () => ({ value: {} }) as never)
  on('session.model', async () => ({ value: 'claude-opus-5-5' }))
  on('session.usage', async () => ({ value: { startedAt: 0, context: { window: 1_000_000 }, rateLimits: [] } }))
  on('process.run', async () => ({ value: { exitCode: 1, stdout: '', stderr: '' } }) as never)
  // The office is the pane this test tracks; the engine's own drawings are empty.
  const panes: { id: string; title: string }[] = []
  on('ui.open', async (_$, e) => {
    if (!panes.some(p => p.id === e.id)) panes.push({ id: e.id, title: e.title ?? '' })
    return { value: { isPlaced: true } } as never
  })
  on('ui.close', async (_$, e) => {
    panes.splice(panes.findIndex(p => p.id === e.id), 1)
    return { value: undefined }
  })
  on('ui.panes', async () => ({ value: [...panes] }) as never)
  on('ui.render', async ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box />
  })
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', async (_$, e) => ({ text: e.answer }))
  on('turn.step', async function* (_$, e) {
    return {
      turnId: e.turnId,
      index: e.index,
      answer: 'ok',
      toolUses: [],
      stopReason: 'end_turn',
      usage: { model: 'claude-opus-5-5', input_tokens: 1000, output_tokens: 500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    }
  })
}

// One main-loop turn: a prompt, one model request, the answer.
const turn = async ($: Engine, clock: { advance: (ms: number) => Promise<void> }, text: string) => {
  await $.turn.start({ text, turnId: 't1' })
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', effort: 'high', messageCount: 1 })
  for await (const _ of stream);
  await clock.advance(4000)
  await $.turn.complete({ answer: 'ok', durationMs: 4000, isAborted: false, turnId: 't1', reason: 'answer' })
}

test('the main session is counted with no subagent at all', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await turn($, clock, 'Refactor the auth module')

  // 1,500 tokens; Opus 5.5 at $4 in and $20 out per million is $0.014; 4 s.
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...PANE })
  expect(await pane.find({ type: 'Text', text: /Main session: ≈\$0\.01 · 2k · 0:04/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Subagents: ≈\$0\.00 · 0 · 0:00/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Total: ≈\$0\.01 · 2k · 0:04/ })).toBeDefined()
  await pane.unmount()
})

test('the band shows the main session, opens the office and can be dismissed', async ($, on) => {
  engine(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await turn($, clock, 'Write the tests')

  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: PLUGIN, surface, ...BAND })
    expect(await band.find({ key: 'savvy-agents' })).toBeDefined()
    await band.unmount()

    const pane = await $.ui.mount({ plugin: PLUGIN, surface, ...PANE })
    if (surface === 'desktop') expect(await pane.find({ type: 'Svg' })).toBeDefined()
    else expect(await pane.find({ type: 'Text', text: /Main session/ })).toBeDefined()
    await pane.press({ key: 'compact' })
    expect(await pane.find({ type: 'Text', text: /Total: ≈\$0\.01/ })).toBeDefined()
    await pane.press({ key: 'compact' })
    await pane.unmount()
  }

  const band = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  await band.press({ key: 'savvy-dismiss' })
  await band.unmount()
  const again = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...BAND })
  expect(await again.find({ key: 'savvy-agents' })).toBeUndefined()
  await again.unmount()
})

test('a flow fills the office with planned desks', async ($, on) => {
  engine(on)
  mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'desktop', isInteractive: true })
  await $.tool.call({
    tool: 'mcp__savvy-progress__progress',
    title: 'Office redesign',
    total: 2,
    phase: 'delegate',
    tasks: [
      { title: 'Count the main session', tier: 'careful' },
      { title: 'Draw the office', tier: 'medium', after: [1] },
    ],
  } as never)
  for (const surface of SURFACES) {
    const band = await $.ui.mount({ plugin: PLUGIN, surface, ...BAND })
    const button = await band.find({ key: 'savvy-agents' })
    expect(button?.text ?? '').toMatch(/×2/)
    await band.unmount()
    const pane = await $.ui.mount({ plugin: PLUGIN, surface, ...PANE })
    expect(await pane.find({ type: 'Text', text: /Office redesign/ })).toBeDefined()
    await pane.unmount()
  }
})

test('Portuguese', { options: { language: 'pt' } }, async ($, on) => {
  engine(on)
  const clock = mock.clock(on)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
  await turn($, clock, 'Traduzir')
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...PANE })
  expect(await pane.find({ type: 'Text', text: /Sessão principal/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /Subagentes/ })).toBeDefined()
  await pane.unmount()
})
