import type { Run } from '../types'

import { CATCH_MS, CREEP_MS, shownAt } from './glide'

/** The pill's height in CSS pixels; its width is the band's. */
export const PILL_H = 44

/**
 * The band's width in CSS pixels. A remote surface counts its width in cells of
 * its code font, so this multiplies back by that font's advance.
 */
export const PX_PER_COLUMN = 7.7
export const pillWidth = (columns: number) => Math.max(240, Math.floor(columns * PX_PER_COLUMN))

const RED = '#ff453a'
const GREEN = '#30d158'
const GRAY = '#8e8e93'
const FONT = `-apple-system, 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif`

/** Drawn in a 15 × 22 box; the thumb scales it down. */
const BOLT = 'M9.5 0 L0 13 H7 L5.2 22 L15 8.4 H8.2 Z'
const CHECK = 'M1 11 L6.5 16.5 L17 4'

const fmt = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`
}

/** What the right end says: an estimate when the plan allows one, else the clock. */
export const rightLabel = (r: Run, now: number) => {
  if (r.phase === 'done') return r.isAborted ? `Stopped · ${fmt(r.seconds)}` : `Done · ${fmt(r.seconds)}`
  const elapsed = (now - (r.startedAt ?? now)) / 1000
  if (r.planTotal > 0 && r.planDone > 0 && r.planDone < r.planTotal) {
    const left = (elapsed / r.planDone) * (r.planTotal - r.planDone)
    return `~${fmt(left < 60 ? Math.ceil(left / 5) * 5 : left)}`
  }
  if (r.planTotal > 0) return `${Math.min(r.planDone + 1, r.planTotal)}/${r.planTotal}`
  return fmt(elapsed)
}

const n = (v: number) => (Math.round(v * 100) / 100).toString()

/** The pill, `width` CSS pixels across, as one SVG document that animates itself (SMIL). */
export const pillSvg = (r: Run, now: number, width: number) => {
  const W = Math.max(240, Math.round(width))
  const H = PILL_H
  const Y = H / 2
  const isDone = r.phase === 'done'
  const accent = r.isAborted ? GRAY : isDone ? GREEN : RED

  const right = rightLabel(r, now)
  const labelW = Math.round(right.length * 8.2)
  const labelX = W - 22
  // The track runs from the left cap to just short of the label, leaving the thumb room.
  const X0 = 24
  const X1 = labelX - labelW - 26
  const L = Math.max(40, X1 - X0)

  const g = r.glide ?? { from: 0, goal: 0, creep: 0, t0: now }
  const elapsed = Math.max(0, now - g.t0)
  const total = CATCH_MS + CREEP_MS
  const glideTiming =
    `dur="${n(total / 1000)}s" begin="-${n(elapsed / 1000)}s" fill="freeze" calcMode="spline" ` +
    `keyTimes="0;${n(CATCH_MS / total)};1" keySplines="0.25 0.1 0.25 1;0 0 0.58 1"`
  const widths = [g.from, g.goal, g.creep].map(v => n(v * L)).join(';')
  const spots = [g.from, g.goal, g.creep].map(v => `${n(X0 + v * L)} ${Y}`).join(';')
  const shown = shownAt(g, now)

  // The thumb: ⚡ and the tool count while working, ✓ or ■ once done.
  const label = isDone ? '' : String(r.tools)
  const thumbH = 24
  const thumbW = isDone ? 34 : 30 + 8.6 * label.length
  const iconX = -thumbW / 2 + 9
  const icon = isDone
    ? r.isAborted
      ? `<rect x="-4.5" y="-4.5" width="9" height="9" rx="2" fill="#fff"/>`
      : `<path d="${CHECK}" transform="translate(-6 -7) scale(0.68)" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${BOLT}" transform="translate(${n(iconX)} -7.2) scale(0.65)" fill="#fff"/>`
  const count = label
    ? `<text x="${n(iconX + 12)}" y="5" font-family="${FONT}" font-size="14.5" font-weight="700" fill="#fff">${label}</text>`
    : ''

  // Rings that burst out of the thumb when the turn finishes.
  const burst =
    isDone && !r.isAborted
      ? [0, 0.4]
          .map(
            d => `<circle r="12" fill="none" stroke="${accent}" stroke-width="2" opacity="0">
        <animate attributeName="r" values="12;60" dur="1s" begin="${d}s" fill="freeze"/>
        <animate attributeName="opacity" values="0.9;0" dur="1s" begin="${d}s" fill="freeze"/>
      </circle>`,
          )
          .join('')
      : ''

  // A light sweeping along the filled track, like a current flowing.
  const shimmer = isDone
    ? ''
    : `<rect x="${X0}" y="${Y - 2.5}" height="5" rx="2.5" fill="url(#sheen)">
      <animate attributeName="width" values="${widths}" ${glideTiming}/>
    </rect>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMinYMid meet">
  <defs>
    <clipPath id="pill"><rect width="${W}" height="${H}" rx="${H / 2}"/></clipPath>
    <filter id="glow" x="-150%" y="-250%" width="400%" height="600%"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="soft" x="-10%" y="-400%" width="120%" height="900%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <linearGradient id="sheen" gradientUnits="userSpaceOnUse" x1="${X0 - 110}" x2="${X0}" y1="0" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      <animateTransform attributeName="gradientTransform" type="translate" values="0 0;${L + 110} 0" dur="2.2s" repeatCount="indefinite"/>
    </linearGradient>
    <linearGradient id="thumbFace" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.25"/>
      <stop offset="0.55" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" rx="${H / 2}" fill="#0a0a0b"/>
  <g clip-path="url(#pill)">
  <rect x="${X0}" y="${Y - 2.5}" width="${L}" height="5" rx="2.5" fill="#2c2c2e"/>
  <rect x="${X0}" y="${Y - 2.5}" width="${n(shown * L)}" height="5" rx="2.5" fill="${accent}" filter="url(#soft)" opacity="0.8">
    <animate attributeName="width" values="${widths}" ${glideTiming}/>
  </rect>
  <rect x="${X0}" y="${Y - 2.5}" width="${n(shown * L)}" height="5" rx="2.5" fill="${accent}">
    <animate attributeName="width" values="${widths}" ${glideTiming}/>
  </rect>
  ${shimmer}
  <g transform="translate(${n(X0 + shown * L)} ${Y})">
    <animateTransform attributeName="transform" type="translate" values="${spots}" ${glideTiming}/>
    ${burst}
    <ellipse rx="${n(thumbW / 2 + 14)}" ry="17" fill="${accent}" filter="url(#glow)" opacity="0.8">
      ${r.isAborted ? '' : `<animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite"/>`}
    </ellipse>
    <g>
      <animateTransform attributeName="transform" type="scale" values="1.28;0.94;1" keyTimes="0;0.6;1" dur="0.45s" fill="freeze"/>
      <rect x="${n(-thumbW / 2)}" y="${-thumbH / 2}" width="${n(thumbW)}" height="${thumbH}" rx="${thumbH / 2}" fill="${accent}"/>
      <rect x="${n(-thumbW / 2)}" y="${-thumbH / 2}" width="${n(thumbW)}" height="${thumbH}" rx="${thumbH / 2}" fill="url(#thumbFace)"/>
      ${icon}
      ${count}
    </g>
  </g>
  </g>
  <text x="${labelX}" y="${Y + 5}" text-anchor="end" font-family="${FONT}" font-size="14.5" font-weight="600" fill="${accent}">${right}</text>
</svg>`
}
