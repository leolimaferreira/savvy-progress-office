export type Phase = 'plan' | 'design' | 'delegate' | 'review' | 'close'

export type PlannedTask = {
  title: string
  tier: string
  after: number[]
}

export type Flow = {
  title: string
  total: number
  done: number
  running: number
  phase: Phase
  isFinished: boolean
  tasks: PlannedTask[]
}

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  type: string
  description: string
  model: string
  effort?: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  contextTokens: number
  contextMax: number
  tokens: number
  costUsd: number
  steps: number
  round: number
  /** Self-reported by the worker through the `step` tool. */
  stepDone?: number
  stepTotal?: number
  stepNote?: string
}

/** The main conversation, counted turn by turn as the subagents are. */
export type MainRun = {
  model: string
  effort?: string
  status: 'working' | 'idle'
  /** The prompt the current or last turn began with, clipped. */
  task: string
  turnStartedAt?: number
  /** Wall-clock time of finished turns. */
  activeMs: number
  tokens: number
  costUsd: number
  contextTokens: number
  contextMax: number
  steps: number
  turns: number
}

export type Panel = {
  isCompact: boolean
  isDoneCollapsed: boolean
  autoOpenedFor: string
  /** The person dismissed the band; a new flow or opening the office brings it back. */
  isBandHidden?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'savvy-progress': {
      flow: Flow | null
      agents: AgentRun[]
      main: MainRun
      panel: Panel
      now: number
    }
  }
}
