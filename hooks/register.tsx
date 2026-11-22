import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Run } from '../types'

import { glideFor, shownAt } from './glide'
import { PILL_H, pillSvg, pillWidth, rightLabel } from './pill'

const IDLE: Run = {
  phase: 'idle',
  seq: 0,
  tools: 0,
  lastTool: '',
  planDone: 0,
  planTotal: 0,
  seconds: 0,
  isAborted: false,
}

const run = atom({ plugin: 'hyperbar', key: 'run' } as const, IDLE)

/** How long the finish (burst and summary) stays before the bar leaves. */
const CELEBRATE_MS = 6000

/** A tool's name as a person reads it: `mcp__x__update_plan` → `update_plan`. */
const shortName = (tool: string) => {
  const parts = tool.split('__')
  return parts[parts.length - 1] ?? tool
}

type Loose = Record<string, unknown>

/** Steps done and planned after this call, when the call is a task list. */
const planAfter = (tool: string, input: Loose, before: Run) => {
  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    const todos = input.todos as Loose[]
    return { planDone: todos.filter(t => t.status === 'completed').length, planTotal: todos.length }
  }

  if (tool.endsWith('update_plan')) {
    if (Array.isArray(input.items)) {
      const items = input.items as Loose[]
      return { planDone: items.filter(t => t.status === 'completed').length, planTotal: items.length }
    }
    let done = before.planDone
    if (input.advance === true) done += 1
    if (Array.isArray(input.done)) done += input.done.length
    return { planDone: Math.min(done, before.planTotal), planTotal: before.planTotal }
  }

  return null
}

/** The run after a change, with the bar's glide aimed from where it is now. */
const aimed = (next: Run, now: number): Run => ({ ...next, glide: glideFor(next, now) })

export const register: Register = on => {
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      await update($, run, (r): Run =>
        aimed({ ...IDLE, phase: 'working', seq: (r?.seq ?? 0) + 1, startedAt: now }, now),
      )
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      const tool = String(e.tool)
      const now = await $.clock.now()
      await update($, run, (r): Run => {
        const before = r ?? IDLE
        const plan = planAfter(tool, e as unknown as Loose, before)
        return aimed(
          {
            ...before,
            phase: 'working',
            startedAt: before.startedAt ?? now,
            tools: before.tools + 1,
            lastTool: shortName(tool),
            ...(plan ?? {}),
          },
          now,
        )
      })
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const now = await $.clock.now()
      let seq = 0
      await update($, run, (r): Run => {
        const before = r ?? IDLE
        seq = before.seq
        return aimed(
          {
            ...before,
            phase: 'done',
            seconds: Math.round(e.durationMs / 1000),
            isAborted: e.isAborted,
            planDone: e.isAborted ? before.planDone : before.planTotal,
          },
          now,
        )
      })
      // Let the finish play, then step aside, unless a new turn began meanwhile.
      $.clock.after(CELEBRATE_MS, () => {
        void update($, run, (r): Run =>
          r && r.seq === seq && r.phase === 'done' ? { ...r, phase: 'idle' } : r ?? IDLE,
        )
      })
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const r = await read($, run)

    if (e.props.hasSurvey || r.phase === 'idle') {
      return next(e)
    }

    const now = await $.clock.now()

    // The terminal has no SVG: a bar of its own, animated on its frame clock.
    if (e.surface === 'terminal') {
      const { Client } = $.ui.resolve(e)
      return (
        <Client
          key="hyperbar"
          module="./bar.tsx"
          props={{
            ...r,
            columns: e.props.bodyColumns,
            shown: shownAt(r.glide, now),
            label: rightLabel(r, now),
          }}
          width={e.props.bodyColumns}
          height={1}
        />
      )
    }

    const { Svg } = $.ui.resolve(e)
    const pct = Math.round(shownAt(r.glide, now) * 100)
    const alt =
      r.phase === 'done'
        ? `Claude ${r.isAborted ? 'stopped' : 'finished'}: ${rightLabel(r, now)}, ${r.tools} tool calls`
        : `Claude is working: ${pct}%, ${r.tools} tool calls, ${rightLabel(r, now)}`
    // An interactive Svg is a frame of its own size, 300 by 150 unless told: give it the band's width.
    const width = pillWidth(e.props.bodyColumns)
    return <Svg source={pillSvg(r, now, width)} alt={alt} isInteractive width={width} height={PILL_H} />
  })
}
