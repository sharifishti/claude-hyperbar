import { expect, mock, test } from 'claude-code/testing'

import type { Run } from '../types'

const BAND = {
  plugin: 'hyperbar',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: true,
    maxRows: 10,
    bodyColumns: 60,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const T0 = 1_700_000_000_000

const WORKING: Run = {
  phase: 'working',
  seq: 1,
  tools: 0,
  lastTool: '',
  planDone: 0,
  planTotal: 0,
  seconds: 0,
  isAborted: false,
  startedAt: T0,
}

const seed = (run: Run) => () => ({ value: { value: run, version: 1 } })

/** Every string in a drawn tree, in order. */
const textOf = (node: unknown): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object' && 'children' in node) return textOf((node as { children: unknown }).children)
  return ''
}

/** The SVG source somewhere in the drawn tree. */
const svgOf = (tree: unknown) => {
  const json = JSON.stringify(tree)
  const source = /"source":"((?:[^"\\]|\\.)*)"/.exec(json)?.[1]
  return source === undefined ? '' : (JSON.parse(`"${source}"`) as string)
}

const plan = [
  { content: 'a', status: 'completed', activeForm: 'a' },
  { content: 'b', status: 'completed', activeForm: 'b' },
  { content: 'c', status: 'in_progress', activeForm: 'c' },
  { content: 'd', status: 'pending', activeForm: 'd' },
] as const

test('idle draws nothing of its own', async $ => {
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(JSON.stringify(await ui.drawn())).not.toContain('Svg')
  await ui.unmount()
})

test('desktop draws the glowing pill: count on the thumb, estimate on the right', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  on('tool.call', () => ({ result: {} }))

  await $.tool.call({ tool: 'Read', file_path: 'x' })
  await clock.advance(60_000)
  await $.tool.call({ tool: 'TodoWrite', todos: [...plan] })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const tree = await ui.drawn()
  expect(JSON.stringify(tree)).toContain('"type":"Svg"')
  expect(JSON.stringify(tree)).toContain('"isInteractive":true')
  // 60 cells of the code font: the frame is sized to the band, not left at 300 by 150.
  expect(JSON.stringify(tree)).toContain('"width":462')
  expect(JSON.stringify(tree)).toContain('"height":44')
  const svg = svgOf(tree)
  expect(svg).toContain('>2</text>') // two tool calls on the thumb
  expect(svg).toContain('>~1m</text>') // 2 of 4 steps in 60 s: about a minute left
  expect(svg).toContain('<animateTransform attributeName="transform" type="translate"')
  expect(svg).toContain('#ff453a')
  await ui.unmount()
})

test('a finished turn goes green, full, with a burst', async ($, on) => {
  mock.clock(on, { now: T0 + 5000 })
  on('state.get', seed({ ...WORKING, phase: 'done', tools: 4, seconds: 34, glide: { from: 0.4, goal: 1, creep: 1, t0: T0 } }))
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const svg = svgOf(await ui.drawn())
  expect(svg).toContain('Done · 34s')
  expect(svg).toContain('#30d158')
  expect(svg).toContain('values="12;60"')
  await ui.unmount()
})

test('an interrupted turn goes grey and says so', async ($, on) => {
  mock.clock(on, { now: T0 + 5000 })
  on('state.get', seed({ ...WORKING, phase: 'done', tools: 2, seconds: 5, isAborted: true }))
  const ui = await $.ui.mount({ ...BAND, surface: 'mobile' })
  const svg = svgOf(await ui.drawn())
  expect(svg).toContain('Stopped · 5s')
  expect(svg).not.toContain('values="12;60"')
  await ui.unmount()
})

test('a value stored before the pill (no glide, no start) still draws', async ($, on) => {
  mock.clock(on, { now: T0 })
  const { startedAt: _, ...old } = WORKING
  on('state.get', seed(old as Run))
  const ui = await $.ui.mount({ ...BAND, surface: 'vscode' })
  expect(svgOf(await ui.drawn())).toContain('>0s</text>')
  await ui.unmount()
})

test('the terminal draws a one-row pill that fills on its frame clock', async ($, on) => {
  const clock = mock.clock(on, { now: T0 })
  on('tool.call', () => ({ result: {} }))
  await $.tool.call({ tool: 'TodoWrite', todos: [...plan] })
  await clock.advance(30_000)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.advance(3000)
  const text = textOf(await ui.drawn({ in: 'hyperbar' }))
  expect(text).toContain(' ⚡1 ')
  expect(text).toContain('~30s')
  const filled = (text.match(/━/g) ?? []).length
  expect(filled).toBeGreaterThan(15)
  await ui.unmount()
})
