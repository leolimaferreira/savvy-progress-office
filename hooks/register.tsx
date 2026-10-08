import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRun, Flow, MainRun, Panel, Phase, PlannedTask } from '../types'
import { BAND_H, SCORE_H, bandSvg, colorOfFamily, familyOf, officeSvg, scoreSvg } from './office'
import type { Band, Desk, Part as OfficePart, Words } from './office'

const flow = atom({ plugin: 'savvy-progress', key: 'flow' } as const, null)
const agents = atom({ plugin: 'savvy-progress', key: 'agents' } as const, [])
const panel = atom({ plugin: 'savvy-progress', key: 'panel' } as const, {
  isCompact: false,
  isDoneCollapsed: false,
  autoOpenedFor: '',
  isBandHidden: false,
})
const main = atom({ plugin: 'savvy-progress', key: 'main' } as const, {
  model: '',
  status: 'idle',
  task: '',
  activeMs: 0,
  tokens: 0,
  costUsd: 0,
  contextTokens: 0,
  contextMax: 0,
  steps: 0,
  turns: 0,
} as MainRun)
const now = atom({ plugin: 'savvy-progress', key: 'now' } as const, 0)

const TOOL = 'mcp__savvy-progress__progress'
const STEP_TOOL = 'mcp__savvy-progress__step'
const PANE = 'savvy-agents'
const PHASES: readonly Phase[] = ['plan', 'design', 'delegate', 'review', 'close']
const DONE = '#5fbf8f'

type ProgressInput = {
  title?: string
  total?: number
  done?: number
  phase?: Phase
  finished?: boolean
  tasks?: { title?: string; tier?: string; after?: number[] }[]
}

// ---------------------------------------------------------------------------
// Language: the `language` option, else Claude Code's `language` setting, else the
// process locale; English when nothing says Portuguese or Russian.

type Lang = 'en' | 'pt' | 'ru'

const STRINGS = {
  en: {
    pane: 'Office',
    cost: 'Cost',
    tokens: 'Tokens',
    time: 'Time',
    collapse: 'Collapse',
    expand: 'Expand',
    running: 'Running',
    finished: 'Finished',
    planned: 'Planned',
    empty: 'No subagents yet.',
    round: 'round',
    failed: 'error',
    after: 'after',
    tokensWord: 'tokens',
    agentsCount: 'agents',
    isRunning: 'running',
    isFinished: 'finished',
    isPlanned: 'planned',
    opened: 'Office opened.',
    closed: 'Office closed.',
    done: 'Done',
    plan: 'Plan',
    design: 'Design',
    tasks: 'Tasks',
    review: 'Review',
    busy: 'running',
    main: 'Main session',
    subagents: 'Subagents',
    total: 'Total',
    idle: 'waiting',
    pantry: 'Pantry',
    floor: 'Floor {n}',
    mainShort: 'Boss',
    subsShort: 'Team',
  },
  pt: {
    pane: 'Escritório',
    cost: 'Custo',
    tokens: 'Tokens',
    time: 'Tempo',
    collapse: 'Recolher',
    expand: 'Expandir',
    running: 'Trabalhando',
    finished: 'Concluídos',
    planned: 'Planejados',
    empty: 'Nenhum subagente ainda.',
    round: 'rodada',
    failed: 'erro',
    after: 'depois de',
    tokensWord: 'tokens',
    agentsCount: 'agentes',
    isRunning: 'trabalhando',
    isFinished: 'concluído',
    isPlanned: 'planejada',
    opened: 'Escritório aberto.',
    closed: 'Escritório fechado.',
    done: 'Concluído',
    plan: 'Plano',
    design: 'Design',
    tasks: 'Tarefas',
    review: 'Revisão',
    busy: 'em andamento',
    main: 'Sessão principal',
    subagents: 'Subagentes',
    total: 'Total',
    idle: 'aguardando',
    pantry: 'Copa',
    floor: '{n}º andar',
    mainShort: 'Chefe',
    subsShort: 'Equipe',
  },
  ru: {
    pane: 'Офис',
    cost: 'Стоимость',
    tokens: 'Токены',
    time: 'Время',
    collapse: 'Свернуть',
    expand: 'Развернуть',
    running: 'Работают',
    finished: 'Завершены',
    planned: 'Запланированы',
    empty: 'Субагентов пока нет.',
    round: 'раунд',
    failed: 'ошибка',
    after: 'после',
    tokensWord: 'токенов',
    agentsCount: 'агентов',
    isRunning: 'работает',
    isFinished: 'завершён',
    isPlanned: 'запланирована',
    opened: 'Офис открыт.',
    closed: 'Офис закрыт.',
    done: 'Готово',
    plan: 'План',
    design: 'Дизайн',
    tasks: 'Задачи',
    review: 'Ревью',
    busy: 'в работе',
    main: 'Основная сессия',
    subagents: 'Субагенты',
    total: 'Итого',
    idle: 'ожидает',
    pantry: 'Кухня',
    floor: 'Этаж {n}',
    mainShort: 'Шеф',
    subsShort: 'Команда',
  },
} as const

// Module scope is fine here: session.start sets it again on every (re)load.
let lang: Lang = 'en'
const tr = () => STRINGS[lang]

// `pt`, `pt_BR.UTF-8`, `Portuguese`, `português`; `ru`, `Russian`, `русский`.
const langOf = (v: unknown): Lang => {
  if (typeof v !== 'string') return 'en'
  const t = v.trim()
  if (/^(pt|portug)/i.test(t)) return 'pt'
  if (/^(ru|russian|рус)/i.test(t)) return 'ru'
  return 'en'
}

async function detectLang($: EngineInterface, option: unknown): Promise<Lang> {
  if (option === 'en' || option === 'pt' || option === 'ru') return option
  try {
    const settings = (await $.settings.read()) as Record<string, unknown>
    if (typeof settings.language === 'string' && settings.language.trim()) return langOf(settings.language)
  } catch {
    // No settings: fall through to the locale.
  }
  // "C" and "POSIX" say nothing; the next variable may.
  const vars = [await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG')]
  const locale = vars.find(v => v && !/^(C|POSIX)(\.|$)/.test(v))
  if (locale) return langOf(locale)
  // macOS keeps the system language out of the environment: the first of
  // AppleLanguages, `("pt-BR", "en-US")`, is the one the system shows.
  try {
    const { exitCode, stdout } = await $.process.run(['defaults', 'read', '-g', 'AppleLanguages'], { timeoutMs: 2000 })
    if (exitCode === 0) return langOf(/"?([A-Za-z-]+)"?/.exec(stdout.replace(/^\s*\(/, ''))?.[1])
  } catch {
    // Not macOS, or no answer: English.
  }
  return 'en'
}

const blank = (): Flow => ({
  title: 'savvy-flow',
  total: 0,
  done: 0,
  running: 0,
  phase: 'plan',
  isFinished: false,
  tasks: [],
})

const isNewFlow = (prev: Flow | null, input: ProgressInput): boolean =>
  !prev || prev.isFinished || (input.title !== undefined && input.title.trim() !== prev.title)

const cleanTasks = (tasks: ProgressInput['tasks']): PlannedTask[] | undefined =>
  tasks
    ?.filter(t => t.title?.trim())
    .map(t => ({
      title: (t.title ?? '').trim(),
      tier: (t.tier ?? '').replace(/^savvy-/, '').trim().toLowerCase(),
      after: (t.after ?? []).filter(n => Number.isInteger(n) && n > 0),
    }))

const merge = (prev: Flow | null, input: ProgressInput): Flow => {
  // A new title means a new flow: never carry counters over from an earlier one.
  const base = isNewFlow(prev, input) || !prev ? blank() : { ...blank(), ...prev }
  const tasks = cleanTasks(input.tasks) ?? base.tasks
  const total = Math.max(0, Math.round(input.total ?? (input.tasks ? tasks.length : base.total)))
  const done = Math.min(total || Infinity, Math.max(0, Math.round(input.done ?? base.done)))
  const phase = input.phase && PHASES.includes(input.phase) ? input.phase : base.phase
  return {
    ...base,
    title: input.title?.trim() || base.title,
    total,
    done,
    phase: input.finished ? 'close' : phase,
    isFinished: input.finished === true,
    tasks,
  }
}

const label = (f: Flow): string => {
  const s = tr()
  if (f.isFinished) return s.done
  if (f.phase === 'plan') return s.plan
  if (f.phase === 'design') return s.design
  const count = f.total ? `${f.done}/${f.total}` : `${f.running} ${s.busy}`
  return `${f.phase === 'review' ? s.review : s.tasks} ${count}`
}

const ratio = (f: Flow): number => (f.isFinished ? 1 : f.total ? f.done / f.total : 0)
const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s)

const barText = (f: Flow, width: number): string => {
  const filled = Math.round(width * ratio(f))
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}
// ---------------------------------------------------------------------------
// Agents panel: every subagent of the session, plus the tasks the flow planned.

const TIER_COLOR: Record<string, string> = {
  fable: '#7F77DD',
  heavy: '#D85A30',
  careful: '#BA7517',
  medium: '#378ADD',
  light: '#1D9E75',
  other: '#888780',
}


const TIER_MODEL: Record<string, string> = {
  fable: 'Fable · high',
  heavy: 'Opus · xhigh',
  careful: 'Opus · high',
  medium: 'Opus · medium',
  light: 'Opus · low',
}

// USD per million tokens: input, output, cache read, cache write (5-minute TTL).
// The engine reports tokens, not money, so the panel's cost is an estimate.
const PRICES: [RegExp, [number, number, number, number]][] = [
  [/fable|mythos/, [10, 50, 0.25, 12.5]],
  [/opus-5-5/, [4, 20, 0.2, 5]],
  [/opus/, [5, 25, 0.5, 6.25]],
  [/sonnet/, [2, 10, 0.2, 2.5]],
  [/haiku/, [1, 5, 0.1, 1.25]],
]

type Usage = {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

const priceOf = (model: string): [number, number, number, number] =>
  PRICES.find(([re]) => re.test(model.toLowerCase()))?.[1] ?? [4, 20, 0.2, 5]

const costOf = (model: string, u: Usage): number => {
  const [i, o, r, w] = priceOf(model)
  return (
    ((u.input_tokens || 0) * i +
      (u.output_tokens || 0) * o +
      (u.cache_read_input_tokens || 0) * r +
      (u.cache_creation_input_tokens || 0) * w) /
    1e6
  )
}

const windowOf = (model: string): number => (/haiku/i.test(model) ? 200_000 : 1_000_000)

// `savvy-careful`, or `savvy-flow:savvy-careful` when the agents ship in a plugin.
const tierOf = (type: string): string => {
  const bare = type.replace(/^[^:]*:/, '')
  const t = bare.replace(/^savvy-/, '').toLowerCase()
  return t in TIER_COLOR && bare.startsWith('savvy-') ? t : 'other'
}

const modelName = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  const [, family = '', major = '', minor] = m ?? []
  if (!family) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? '.' + minor : ''}`
}

const norm = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

const fmtTokens = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`

const fmtCost = (usd: number): string => `$${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}`

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const elapsed = (a: AgentRun, at: number): number => (a.endedAt ?? Math.max(at, a.startedAt)) - a.startedAt

type Planned = PlannedTask & { n: number }

const plannedOf = (f: Flow | null, list: AgentRun[]): Planned[] => {
  if (!f || f.isFinished) return []
  const started = new Set(list.map(a => norm(a.description)))
  return (f.tasks ?? []).map((t, i) => ({ ...t, n: i + 1 })).filter(t => !started.has(norm(t.title)))
}

const mainTime = (m: MainRun, at: number): number =>
  m.activeMs + (m.status === 'working' && m.turnStartedAt ? Math.max(0, at - m.turnStartedAt) : 0)

type Part = { cost: number; tokens: number; time: number }

// The main session and the subagents apart, and together. Subagents mostly run
// inside a main turn, so the total time is the longer of the two, not the sum.
const totals = (list: AgentRun[], at: number, m: MainRun): Part & { main: Part; subs: Part } => {
  const start = Math.min(...list.map(a => a.startedAt))
  const end = Math.max(...list.map(a => a.endedAt ?? Math.max(at, a.startedAt)))
  const subs = {
    cost: list.reduce((s, a) => s + a.costUsd, 0),
    tokens: list.reduce((s, a) => s + a.tokens, 0),
    time: list.length ? end - start : 0,
  }
  const own = { cost: m.costUsd, tokens: m.tokens, time: mainTime(m, at) }
  return { cost: own.cost + subs.cost, tokens: own.tokens + subs.tokens, time: Math.max(own.time, subs.time), main: own, subs }
}

const usageTokens = (u: Usage): number =>
  (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)

const hasMain = (m: MainRun): boolean => m.tokens > 0 || m.costUsd > 0 || m.status === 'working'
// The task's own progress when the worker reports steps; a finished run is full.
const progressOf = (a: AgentRun): number | null => {
  if (a.status === 'done') return 1
  if (a.stepTotal) return Math.min(1, (a.stepDone ?? 0) / a.stepTotal)
  return null
}

const ctxOf = (a: { contextTokens: number; contextMax: number }): number =>
  a.contextMax ? Math.min(100, Math.round((a.contextTokens / a.contextMax) * 100)) : 0

const modelLabel = (model: string, effort?: string): string =>
  effort ? `${modelName(model)} · ${effort}` : modelName(model)

// A desk nobody sits at yet takes the chair of what its tier runs on.
const tierFamily = (tier: string): string => (tier === 'fable' ? 'fable' : tier in TIER_MODEL ? 'opus' : 'other')

// At most this many desks; the oldest finished runs give theirs up first.
const MAX_DESKS = 40

const desksOf = (list: AgentRun[], planned: Planned[]): Desk[] => {
  const running = list.filter(a => a.status === 'running')
  const finished = list.filter(a => a.status !== 'running')
  const room = Math.max(0, MAX_DESKS - running.length - planned.length)
  const toDesk = (a: AgentRun): Desk => ({
    key: a.id,
    title: a.description || a.type,
    family: familyOf(a.model),
    model: a.model ? modelLabel(a.model, a.effort) : tierOf(a.type),
    status: a.status,
    progress: progressOf(a),
    steps: a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' · ' + a.stepNote : ''}` : '',
  })
  return [
    ...running.map(toDesk),
    ...(room ? finished.slice(-room) : []).map(toDesk),
    ...planned.map(p => ({
      key: `plan-${p.n}`,
      title: p.title,
      family: tierFamily(p.tier),
      model: TIER_MODEL[p.tier] ?? p.tier,
      status: 'planned' as const,
      progress: null,
      steps: '',
      n: p.n,
      after: p.after,
    })),
  ]
}

const fmtPart = (p: Part): OfficePart => ({ cost: '≈' + fmtCost(p.cost), tokens: fmtTokens(p.tokens), time: fmtTime(p.time) })

const words = (): Words => {
  const s = tr()
  return { main: s.main, subagents: s.subagents, total: s.total, cost: s.cost, tokens: s.tokens, time: s.time, idle: s.idle, pantry: s.pantry, floor: s.floor, after: s.after, mainShort: s.mainShort, subsShort: s.subsShort }
}

const mainLabel = (m: MainRun): string =>
  `${m.status === 'working' ? tr().isRunning : tr().idle} · ${fmtTokens(m.tokens)} ${tr().tokensWord}`

const partLine = (p: Part): string => `≈${fmtCost(p.cost)} · ${fmtTokens(p.tokens)} · ${fmtTime(p.time)}`

const ctxBar = (pct: number, width: number): string => {
  const filled = Math.round((width * pct) / 100)
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled))
}

const STATUS_GLYPH: Record<string, string> = { running: '●', done: '✓', failed: '✗', planned: '◷' }

// Opens the office, or closes it when it is up; true when it ends up open.
// Opening it brings back a band the person dismissed.
async function togglePane($: EngineInterface): Promise<boolean> {
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen) {
    await $.ui.close({ id: PANE })
    return false
  }
  const at = await $.clock.now()
  await update($, now, () => at)
  await update($, panel, prev => ({ ...prev, isBandHidden: false }))
  await $.ui.open({ id: PANE, title: tr().pane })
  return true
}

async function autoOpen($: EngineInterface, key: string): Promise<void> {
  const p = await read($, panel)
  if (p.autoOpenedFor === key) return
  await update($, panel, prev => ({ ...prev, autoOpenedFor: key }))
  void $.ui.open({ id: PANE, title: tr().pane })
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    lang = await detectLang($, options.language)
    await $.tool.register({
      name: 'progress',
      description:
        'Report /savvy-flow progress to the progress bar above the prompt and the agents panel. ' +
        'Call it after presenting the plan (title, total, tasks, phase "delegate"), each time a task is accepted (done), ' +
        'when switching phase or re-planning (tasks), and once at the end with finished: true. Fields left out keep their previous value.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short name of the overall task, a few words.' },
          total: { type: 'integer', minimum: 0, description: 'Number of planned worker tasks.' },
          done: { type: 'integer', minimum: 0, description: 'Number of tasks accepted after review.' },
          phase: { type: 'string', enum: [...PHASES] },
          finished: { type: 'boolean', description: 'True once the flow is closed.' },
          tasks: {
            type: 'array',
            description:
              'The planned worker tasks in order, numbered from 1. Each title must equal the Agent tool `description` the task will be delegated with, so the panel can match runs to tasks.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'A few words; reused verbatim as the Agent description.' },
                tier: { type: 'string', enum: ['fable', 'heavy', 'careful', 'medium', 'light'] },
                after: { type: 'array', items: { type: 'integer' }, description: 'Numbers of the tasks this one waits for.' },
              },
              required: ['title', 'tier'],
            },
          },
        },
      },
    })
    await $.tool.register({
      name: 'step',
      description:
        'For savvy-flow workers: report progress on your own task to the agents panel. ' +
        'Right after reading the brief, call it with `total` (your plan in 3-8 steps) and `done: 0`; ' +
        'call it again as each step finishes. Cheap and silent: it only draws a bar.',
      inputSchema: {
        type: 'object',
        properties: {
          done: { type: 'integer', minimum: 0, description: 'Steps finished so far.' },
          total: { type: 'integer', minimum: 1, description: 'Steps planned; may change if the plan changes.' },
          note: { type: 'string', description: 'The step in progress, a few words.' },
        },
        required: ['done'],
      },
    })
    await $.command.register({
      name: 'agents-info',
      description: 'Show or hide the office: the main session and every subagent at their desks, with model, progress, cost, tokens and time',
    })

    // Loaded into a session already under way: what it spent before is in the
    // session's own ledger (/cost), minus what the subagents here account for.
    try {
      const m = await read($, main)
      if (m.turns === 0 && m.costUsd === 0) {
        const usage = await $.session.usage()
        const model = await $.session.model()
        const list = await read($, agents)
        const subs = list.reduce((s, a) => s + a.costUsd, 0)
        await update($, main, prev => ({
          ...prev,
          costUsd: Math.max(0, (usage.cost?.usd ?? 0) - subs),
          model: prev.model || model,
          contextTokens: usage.context.tokens ?? prev.contextTokens,
          contextMax: usage.context.window || prev.contextMax,
        }))
      }
    } catch {
      // No ledger here: the count starts with the next turn.
    }

    // Ticks the running clocks; quiet when nothing runs.
    $.clock.every(1000, () => {
      void (async () => {
        const list = await read($, agents)
        const m = await read($, main)
        if (!list.some(a => a.status === 'running') && m.status !== 'working') return
        const at = await $.clock.now()
        await update($, now, () => at)
      })()
    })
    return started
  })

  on('command.run', { command: 'agents-info' }, async $ => {
    const isOpen = await togglePane($)
    return { text: isOpen ? tr().opened : tr().closed }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const input = e as unknown as ProgressInput
    const prev = await read($, flow)
    if (isNewFlow(prev, input) && input.title !== undefined) {
      // A new flow starts with a clean list; agents still running stay.
      await update($, agents, list => list.filter(a => a.status === 'running'))
      await update($, panel, prev => ({ ...prev, isBandHidden: false }))
    }
    const next = await update($, flow, p => merge(p, input))
    if (next && input.tasks?.length) await autoOpen($, next.title)
    return { result: `ok: ${label(next ?? blank())}` }
  })

  // A worker's own progress: the call runs in the worker's loop, so agentId names it.
  on('tool.call', { tool: STEP_TOOL }, async ($, e) => {
    const input = e as unknown as { done?: number; total?: number; note?: string }
    const agentId = e.agentId
    if (!agentId) return { result: 'ignored: only subagents report steps' }
    await update($, agents, list =>
      list.map(a => {
        if (a.agentId !== agentId) return a
        const total = Math.max(0, Math.round(input.total ?? a.stepTotal ?? 0))
        const done = Math.max(0, Math.round(input.done ?? a.stepDone ?? 0))
        return { ...a, stepTotal: total, stepDone: total ? Math.min(total, done) : done, stepNote: input.note?.trim() || undefined }
      }),
    )
    return { result: 'ok' }
  })

  // Safety net: worker launches move the faint layer even if the orchestrator forgets to report.
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const type = String(e.subagent_type ?? '')
    if (!type.startsWith('savvy-')) return next(e)

    await update($, flow, prev => {
      const base = prev && !prev.isFinished ? { ...blank(), ...prev } : blank()
      return { ...base, running: base.running + 1, phase: base.phase === 'plan' ? 'delegate' : base.phase }
    })
    try {
      return await next(e)
    } finally {
      await update($, flow, prev => (prev ? { ...prev, running: Math.max(0, prev.running - 1) } : prev))
    }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started

    const at = await $.clock.now()
    await update($, agents, list => {
      const round = 1 + list.filter(a => norm(a.description) === norm(e.description) && e.description).length
      const run: AgentRun = {
        id: started.agentId ?? e.tool_use_id,
        agentId: started.agentId,
        type: e.subagentType,
        description: e.description,
        model: started.model,
        status: 'running',
        startedAt: at,
        contextTokens: 0,
        contextMax: windowOf(started.model),
        tokens: 0,
        costUsd: 0,
        steps: 0,
        round,
      }
      return [...list.filter(a => a.id !== run.id), run].slice(-200)
    })
    await update($, now, () => at)
    if (e.subagentType.startsWith('savvy-')) {
      const f = await read($, flow)
      await autoOpen($, f && !f.isFinished ? f.title : 'savvy-flow')
    }
    return started
  })

  // Each model request of a subagent: live context, tokens and cost.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const agentId = e.agentId
    const usage = result.usage
    if (!usage) return result

    const model = usage.model || e.model
    if (!agentId) {
      await update($, main, m => ({
        ...m,
        model,
        effort: typeof e.effort === 'string' ? e.effort : m.effort,
        contextTokens: usageTokens(usage),
        contextMax: windowOf(model),
        tokens: m.tokens + usageTokens(usage),
        costUsd: m.costUsd + costOf(model, usage),
        steps: m.steps + 1,
      }))
      return result
    }
    await update($, agents, list =>
      list.map(a =>
        a.agentId !== agentId
          ? a
          : {
              ...a,
              model,
              effort: typeof e.effort === 'string' ? e.effort : a.effort,
              status: 'running' as const,
              endedAt: undefined,
              contextTokens:
                (usage.input_tokens || 0) +
                (usage.cache_read_input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0) +
                (usage.output_tokens || 0),
              contextMax: windowOf(model),
              tokens:
                a.tokens +
                (usage.input_tokens || 0) +
                (usage.output_tokens || 0) +
                (usage.cache_read_input_tokens || 0) +
                (usage.cache_creation_input_tokens || 0),
              costUsd: a.costUsd + costOf(model, usage),
              steps: a.steps + 1,
            },
      ),
    )
    return result
  })

  // The main loop's turns: what it works on, and for how long.
  on('turn.start', async ($, e, next) => {
    const at = await $.clock.now()
    const task = e.text.replace(/\s+/g, ' ').trim()
    await update($, main, m => ({ ...m, status: 'working' as const, turnStartedAt: at, task: task ? clip(task, 80) : m.task }))
    await update($, now, () => at)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (!agentId) {
      const at = await $.clock.now()
      await update($, main, m => ({
        ...m,
        status: 'idle' as const,
        turnStartedAt: undefined,
        activeMs: m.activeMs + (e.durationMs || (m.turnStartedAt ? at - m.turnStartedAt : 0)),
        turns: m.turns + 1,
      }))
      await update($, now, () => at)
    }
    if (agentId) {
      const at = await $.clock.now()
      await update($, agents, list =>
        list.map(a => {
          if (a.agentId !== agentId) return a
          // A run whose steps went unseen still gets the turn's own sum.
          const fallback = a.steps === 0 && e.usage
          return {
            ...a,
            status: (e.reason === 'answer' ? 'done' : 'failed') as AgentRun['status'],
            endedAt: at,
            ...(fallback && e.usage
              ? {
                  model: e.usage.model || a.model,
                  tokens: usageTokens(e.usage),
                  costUsd: costOf(e.usage.model || a.model, e.usage),
                }
              : {}),
          }
        }),
      )
      await update($, now, () => at)
    }
    return next(e)
  })
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const s = tr()
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const list = await read($, agents)
    const f = await read($, flow)
    const p: Panel = await read($, panel)
    const m = await read($, main)
    const at = Math.max(await read($, now), ...list.map(a => a.startedAt), m.turnStartedAt ?? 0, 0)

    const running = list.filter(a => a.status === 'running').reverse()
    const finished = list.filter(a => a.status !== 'running').reverse()
    const planned = plannedOf(f, list)
    const t = totals(list, at, m)
    const title = f && !f.isFinished ? f.title : ''

    const toggleCompact = (
      <Button
        key="compact"
        label={p.isCompact ? s.expand : s.collapse}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isCompact: !prev.isCompact }))}
      />
    )
    const parts = (
      <Box key="parts" flexDirection="column">
        <Text dimColor wrap="truncate-end">
          {s.main}: {partLine(t.main)}
        </Text>
        <Text dimColor wrap="truncate-end">
          {s.subagents}: {partLine(t.subs)}
        </Text>
        <Text bold wrap="truncate-end">
          {s.total}: {partLine(t)}
        </Text>
      </Box>
    )

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(240, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      const score = (
        <Svg
          key="score"
          source={scoreSvg(W, { main: fmtPart(t.main), subs: fmtPart(t.subs), total: fmtPart(t) }, words(), familyOf(m.model))}
          alt={`${s.main}: ${partLine(t.main)}. ${s.subagents}: ${partLine(t.subs)}. ${s.total}: ${partLine(t)}`}
          width={W}
          height={SCORE_H}
        />
      )
      if (p.isCompact) {
        return (
          <Box flexDirection="column" gap={1}>
            {title ? <Text bold>{title}</Text> : null}
            {score}
            {toggleCompact}
          </Box>
        )
      }
      const drawn = officeSvg(W, {
        boss: {
          status: m.status,
          task: m.task,
          family: familyOf(m.model),
          model: m.model ? modelLabel(m.model, m.effort) : '—',
          ctx: ctxOf(m),
        },
        desks: desksOf(list, planned),
        words: words(),
      })
      const alt =
        `${s.main}: ${m.status === 'working' ? s.isRunning : s.idle}. ` +
        `${running.length} ${s.isRunning}, ${finished.length} ${s.isFinished}, ${planned.length} ${s.isPlanned}.`
      return (
        <Box flexDirection="column" gap={1}>
          {title ? <Text bold>{title}</Text> : null}
          {score}
          <Svg source={drawn.svg} alt={alt} width={W} height={drawn.height} />
          {toggleCompact}
        </Box>
      )
    }

    // Terminal: the same office as text rows.
    const cols = Math.max(24, e.props.bodyColumns || 40)
    const barW = Math.max(6, Math.min(20, cols - 34))
    const toggleDone = (
      <Button
        key="done"
        label={`${p.isDoneCollapsed ? '▸' : '▾'} ${s.finished} · ${finished.length}`}
        plain
        onPress={() => update($, panel, prev => ({ ...prev, isDoneCollapsed: !prev.isDoneCollapsed }))}
      />
    )
    const row = (a: AgentRun) => {
      const color = colorOfFamily(familyOf(a.model))
      const ctx = ctxOf(a)
      const progress = progressOf(a)
      const steps = a.stepTotal ? `${a.stepDone ?? 0}/${a.stepTotal}${a.stepNote ? ' ' + a.stepNote : ''} · ` : ''
      return (
        <Box key={a.id} flexDirection="column" marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Text color={color}>▣</Text>
            <Text bold wrap="truncate-end">
              {a.description || a.type}
            </Text>
            <Text color={a.status === 'failed' ? 'red' : a.status === 'done' ? 'green' : color}>{STATUS_GLYPH[a.status]}</Text>
          </Box>
          <Text dimColor wrap="truncate-end">
            {'  '}
            {a.model ? modelLabel(a.model, a.effort) : a.type}
            {a.round > 1 ? ` · ${s.round} ${a.round}` : ''}
          </Text>
          <Text wrap="truncate-end">
            {'  '}
            {progress === null ? <Text dimColor>{ctxBar(ctx, barW)}</Text> : <Text color={color}>{ctxBar(progress * 100, barW)}</Text>}
            <Text dimColor>
              {' '}
              {steps}ctx {ctx}% · {fmtTokens(a.contextTokens)} ≈{fmtCost(a.costUsd)} {fmtTime(elapsed(a, at))}
            </Text>
          </Text>
        </Box>
      )
    }
    const mainColor = colorOfFamily(familyOf(m.model))

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" justifyContent="space-between">
          <Text bold wrap="truncate-end">
            {title}
          </Text>
          {toggleCompact}
        </Box>
        {parts}
        {p.isCompact ? (
          <Text wrap="truncate-end">
            <Text color={mainColor}>{m.status === 'working' ? '●' : '○'} </Text>
            {[...running, ...finished].map(a => (
              <Text key={a.id} color={colorOfFamily(familyOf(a.model))}>
                {STATUS_GLYPH[a.status]}{' '}
              </Text>
            ))}
            {planned.map(pl => (
              <Text key={`plan-${pl.n}`} dimColor>
                ◷{' '}
              </Text>
            ))}
          </Text>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            <Box flexDirection="column" marginBottom={1}>
              <Box flexDirection="row" gap={1}>
                <Text color={mainColor}>▣</Text>
                <Text bold>{s.main}</Text>
                <Text color={mainColor}>{m.status === 'working' ? '●' : '○'}</Text>
              </Box>
              <Text dimColor wrap="truncate-end">
                {'  '}
                {m.status === 'working' ? m.task || '…' : s.idle}
              </Text>
              <Text wrap="truncate-end">
                {'  '}
                <Text dimColor>{ctxBar(ctxOf(m), barW)}</Text>
                <Text dimColor>
                  {' '}
                  {m.model ? modelLabel(m.model, m.effort) + ' · ' : ''}ctx {ctxOf(m)}%
                </Text>
              </Text>
            </Box>
            {running.length > 0 && <Text dimColor>{s.running} · {running.length}</Text>}
            {running.map(row)}
            {finished.length > 0 && toggleDone}
            {!p.isDoneCollapsed && finished.map(row)}
            {planned.length > 0 && <Text dimColor>{s.planned} · {planned.length}</Text>}
            {planned.map(pl => (
              <Box key={`plan-${pl.n}`} flexDirection="column" marginBottom={1}>
                <Text dimColor wrap="truncate-end">
                  <Text color={colorOfFamily(tierFamily(pl.tier))}>▢</Text> {pl.n}. {pl.title} ◷
                </Text>
                <Text dimColor wrap="truncate-end">
                  {'  '}
                  {TIER_MODEL[pl.tier] ?? pl.tier}
                  {pl.after.length ? ` · ${s.after} ${pl.after.join(', ')}` : ''}
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    )
  })

  // The band above the prompt: the flow when one runs, else the main session
  // once it has spent anything.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const f = await read($, flow)
    const m = await read($, main)
    const p: Panel = await read($, panel)
    if (e.props.hasSurvey || p.isBandHidden || (f === null && !hasMain(m))) return next(e)

    const s = tr()
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const list = await read($, agents)
    const at = Math.max(await read($, now), m.turnStartedAt ?? 0)
    const t = totals(list, at, m)
    const crew = list.length + plannedOf(f, list).length
    const isWorking = m.status === 'working' || list.some(a => a.status === 'running')
    const band: Band = f
      ? { title: f.title, label: label(f), progress: ratio(f), cost: `≈${fmtCost(t.cost)}`, isWorking, isFinished: f.isFinished, family: 'opus' }
      : { title: s.main, label: mainLabel(m), progress: null, cost: `≈${fmtCost(t.cost)}`, isWorking, isFinished: false, family: familyOf(m.model) }
    const officeButton = (
      <Button key="savvy-agents" label={crew ? `${s.pane} ×${crew}` : s.pane} plain onPress={() => void togglePane($)} />
    )
    const dismiss = (
      <Button
        key="savvy-dismiss"
        label="✕"
        plain
        role="dismiss"
        onPress={() => update($, panel, prev => ({ ...prev, isBandHidden: true }))}
      />
    )

    if ('Svg' in ui) {
      const { Svg } = ui
      // About 8 CSS px per reported column; the rest is the office button, the
      // dismiss and their gaps. No floor above the slot: a row wider would wrap.
      const width = Math.max(180, Math.min(1600, (e.props.bodyColumns || 100) * 8 - 170))
      return (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Svg source={bandSvg(width, band)} alt={`${band.title}: ${band.label}, ${band.cost}`} width={width} height={BAND_H} />
          {officeButton}
          {dismiss}
        </Box>
      )
    }

    const cols = e.props.bodyColumns
    const titleW = Math.max(8, Math.min(30, band.title.length + 2, Math.floor(cols / 3)))
    const width = Math.max(6, Math.min(40, cols - titleW - 40))
    const color = band.isFinished ? DONE : colorOfFamily(band.family)
    return (
      <Box flexDirection="row" gap={2}>
        <Box width={titleW} flexShrink={0}>
          <Text color={color}>{isWorking ? '● ' : '○ '}</Text>
          <Text wrap="truncate-end">{band.title}</Text>
        </Box>
        {f ? <Text color={color}>{barText(f, width)}</Text> : null}
        <Text bold>{band.label}</Text>
        <Text dimColor>{band.cost}</Text>
        {officeButton}
        {dismiss}
      </Box>
    )
  })
}
