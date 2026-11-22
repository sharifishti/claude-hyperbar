import type { Glide, Run } from '../types'

/** The quick catch-up to a new goal, then the slow creep while nothing happens. */
export const CATCH_MS = 700
export const CREEP_MS = 120_000

const easeOut = (x: number) => 1 - (1 - x) * (1 - x)

/** Where a glide has the bar at `now`: the same curve the drawing plays. */
export const shownAt = (g: Glide | undefined, now: number) => {
  if (!g) return 0
  const t = Math.max(0, now - g.t0)
  if (t <= CATCH_MS) return g.from + (g.goal - g.from) * easeOut(t / CATCH_MS)
  const x = Math.min(1, (t - CATCH_MS) / CREEP_MS)
  return g.goal + (g.creep - g.goal) * easeOut(x)
}

/** Where a run should head next, given what the bar shows now. */
export const glideFor = (r: Run, now: number): Glide => {
  const shown = shownAt(r.glide, now)

  if (r.phase === 'done') {
    const end = r.isAborted ? shown : 1
    return { from: shown, goal: end, creep: end, t0: now }
  }

  let goal: number
  let creep: number
  if (r.planTotal > 0) {
    const per = 1 / r.planTotal
    goal = Math.min(0.97, r.planDone * per)
    creep = Math.min(0.97, goal + per * 0.85)
  } else {
    const seconds = (now - (r.startedAt ?? now)) / 1000
    goal = 0.9 * (1 - Math.exp(-(seconds / 45 + r.tools / 15)))
    creep = goal + (0.95 - goal) * 0.6
  }
  goal = Math.max(goal, shown)
  return { from: shown, goal, creep: Math.max(creep, goal), t0: now }
}
