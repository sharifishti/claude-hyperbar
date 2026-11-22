export type Phase = 'idle' | 'working' | 'done'

/**
 * Where the bar is heading: from `from` it catches up to `goal` quickly, then
 * creeps on toward `creep` while nothing happens, all fractions of the track,
 * timed from `t0` (clock ms). The drawing plays this itself, so the bar keeps
 * moving between tool calls without a redraw.
 */
export type Glide = { from: number; goal: number; creep: number; t0: number }

/** One turn of the main loop, as the bar draws it. */
export type Run = {
  phase: Phase
  /** Bumped at each turn's start, so the bar knows a new run began. */
  seq: number
  tools: number
  lastTool: string
  /** Steps finished and planned, from TodoWrite or the desktop task list. */
  planDone: number
  planTotal: number
  /** The finished turn's length, in seconds. */
  seconds: number
  isAborted: boolean
  /** When the turn began (clock ms); absent in a value an older version stored. */
  startedAt?: number
  glide?: Glide
}

declare module 'claude-code' {
  interface PluginState {
    hyperbar: { run: Run }
  }
}
