import type { ClientModule } from 'claude-code'

import type { Run } from '../types'

/** The terminal's version of the pill: one row, animated on the frame clock. */
type BarProps = Run & { columns: number; shown: number; label: string }
type BarState = { frame: number }

const TICK_MS = 60

const RED = '#ff453a'
const RED_HI = '#ff8a80'
const GREEN = '#30d158'
const GRAY = '#8e8e93'
const TRACK = '#3a3a3c'

/** What the animation remembers between frames. One bar per plugin, so one of these. */
const anim = { seq: -1, tick: 0, shown: 0, base: 0 }
let latest: BarProps | undefined

const step = () => {
  const p = latest
  if (!p) return
  if (p.seq !== anim.seq) {
    anim.seq = p.seq
    anim.shown = p.shown
    anim.base = p.shown
  }
  anim.tick += 1
  if (p.shown > anim.base) anim.base = p.shown
  if (p.phase === 'done') {
    if (!p.isAborted) anim.shown += (1 - anim.shown) * 0.3
  } else {
    // Catch up to the engine's figure, then creep a little while nothing happens.
    const goal = Math.min(0.97, Math.max(anim.base, anim.shown + 0.00025))
    anim.shown += (goal - anim.shown) * 0.15
  }
}

const Bar: ClientModule<BarProps, BarState> = (props, surface) => {
  latest = props
  if (surface.state === undefined) {
    surface.every(TICK_MS, () => {
      step()
      surface.setState({ frame: anim.tick })
    })
    step()
  }

  const { Box, Text } = surface.elements
  const p = props
  const isDone = p.phase === 'done'
  const accent = p.isAborted ? GRAY : isDone ? GREEN : RED
  const columns = Math.max(24, surface.columns || p.columns)

  const thumb = isDone ? (p.isAborted ? ' ■ ' : ' ✓ ') : ` ⚡${p.tools} `
  const label = ` ${p.label}`
  const track = Math.max(6, columns - thumb.length - label.length - 2)
  const filled = Math.round(Math.min(1, anim.shown) * track)

  // The thumb breathes, as the pill's glow does.
  const pulse = !isDone && Math.sin(anim.tick / 4.5) > 0
  const thumbBg = isDone || p.isAborted ? accent : pulse ? RED_HI : RED

  // A bright glint running along the filled line.
  const glintAt = filled > 0 ? anim.tick % (filled + 12) : -1
  const fill = [...'━'.repeat(filled)]
  const before = glintAt >= 0 && glintAt < filled ? fill.slice(0, glintAt).join('') : fill.join('')
  const glint = glintAt >= 0 && glintAt < filled ? '━' : ''
  const afterGlint = glintAt >= 0 && glintAt < filled ? fill.slice(glintAt + 1).join('') : ''

  return (
    <Box flexDirection="row" width={columns}>
      <Text color={accent}>{before}</Text>
      <Text color="#ffffff" weight="bold">
        {glint}
      </Text>
      <Text color={accent}>{afterGlint}</Text>
      <Text backgroundColor={thumbBg} color="#ffffff" weight="bold">
        {thumb}
      </Text>
      <Text color={TRACK}>{'─'.repeat(track - filled)}</Text>
      <Text color={accent} weight="bold">
        {label}
      </Text>
    </Box>
  )
}

export default Bar
