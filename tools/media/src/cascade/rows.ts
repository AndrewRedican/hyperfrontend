import type { CascadeFrame } from './render'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { easeInOut, easeOut, lerp, progress } from '../lib/motion'
import { renderApiChip } from '../stage/api-chip'
import { MONO_ADVANCE } from './layout'
import { renderText, toneColour } from './render'
import { ARROW_MS, CHIP_MS, MORPH_MS, ROLL_MS } from './timeline'

/** How long the new version takes to appear beside the arrow. */
const APPEAR_MS = 300

/** Length of the arrowhead's two strokes, at compact size. */
const HEAD_LEN = 7

/** How far a chip slides into place from the spine's side, at compact size. */
const CHIP_SLIDE = 8

/** How far a token rises as it appears, at compact size. */
const TOKEN_RISE = 4

/**
 * Draw the version row: the version on disk, the arrow the bump lands on, and the new version with its digits rolling.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example The digits half way through their roll
 * ```ts
 * renderVersion({ ...frame, atMs: timeline.arrowAt + 700 })
 * ```
 */
export function renderVersion(frame: CascadeFrame): string {
  const { config, layout, timeline, metrics, theme, atMs } = frame
  const { version } = layout
  const y = version.y
  const from = version.from
    .map((glyph) => renderText(glyph.x, y, glyph.text, { px: metrics.versionPx, fill: theme.text.strong, weight: 700, anchor: 'middle' }))
    .join('')
  if (atMs < timeline.arrowAt) {
    return from
  }
  const drawn = easeOut(progress(atMs, timeline.arrowAt, ARROW_MS))
  const tip = lerp(version.arrowFrom, version.arrowTo, drawn)
  const head = HEAD_LEN * metrics.scale
  const arrow = `<line x1="${version.arrowFrom.toFixed(1)}" y1="${y}" x2="${tip.toFixed(1)}" y2="${y}" stroke="${theme.accent}" stroke-width="2.5" stroke-linecap="round"/><path d="M ${(tip - head).toFixed(1)} ${(y - head * 0.7).toFixed(1)} L ${tip.toFixed(1)} ${y} L ${(tip - head).toFixed(1)} ${(y + head * 0.7).toFixed(1)}" fill="none" stroke="${theme.accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="${drawn.toFixed(3)}"/>`
  const shown = easeOut(progress(atMs, timeline.arrowAt + ARROW_MS / 2, APPEAR_MS))
  if (shown <= 0) {
    return `${from}${arrow}`
  }
  const advance = metrics.versionPx * MONO_ADVANCE
  let lit = false
  const to = version.to
    .map((glyph, index) => {
      const rollAt = timeline.rollsAt[index]
      const old = config.increment.from[index] ?? glyph.text
      const style = { px: metrics.versionPx, weight: 700, anchor: 'middle' as const, opacity: shown }
      if (rollAt === undefined) {
        return renderText(glyph.x, y, glyph.text, { ...style, fill: lit ? theme.tones.accent : theme.text.muted })
      }
      const rolled = easeInOut(progress(atMs, rollAt, ROLL_MS))
      if (rolled <= 0) {
        return renderText(glyph.x, y, old, { ...style, fill: theme.text.muted })
      }
      if (rolled >= 1) {
        lit = true
        return renderText(glyph.x, y, glyph.text, { ...style, fill: theme.tones.accent })
      }
      const clipId = `cs-roll-${index}`
      const window = `<clipPath id="${clipId}"><rect x="${(glyph.x - advance / 2 - 1).toFixed(1)}" y="${(y - metrics.rollHPx / 2).toFixed(1)}" width="${(advance + 2).toFixed(1)}" height="${metrics.rollHPx}"/></clipPath>`
      const leaving = renderText(glyph.x, y - metrics.rollHPx * rolled, old, { ...style, fill: theme.text.muted })
      const arriving = renderText(glyph.x, y + metrics.rollHPx * (1 - rolled), glyph.text, { ...style, fill: theme.tones.accent })
      return `${window}<g clip-path="url(#${clipId})">${leaving}${arriving}</g>`
    })
    .join('')
  return `${from}${arrow}${to}`
}

/**
 * Draw the changelog line as far as it has assembled, and the name of the file it is written to.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example The line complete
 * ```ts
 * renderChangelog({ ...frame, atMs: 9_000 })
 * ```
 */
export function renderChangelog(frame: CascadeFrame): string {
  const { config, layout, timeline, metrics, theme, atMs } = frame
  const y = layout.rows[layout.rows.length - 1] ?? 0
  let copies = 0
  const tokens = config.changelog.tokens
    .map((token, index) => {
      const slot = layout.tokens[index]
      if (slot === undefined) {
        return ''
      }
      let shownAt = timeline.markerAt
      if (token.from !== undefined) {
        shownAt = timeline.changelog[copies]?.arriveAt ?? shownAt
        copies += 1
      }
      const shown = easeOut(progress(atMs, shownAt, MORPH_MS))
      if (shown <= 0) {
        return ''
      }
      const wrap = token.wrap ?? ''
      const faint = wrap === '' ? '' : `<tspan fill="${theme.text.faint}">${escapeHtml(wrap)}</tspan>`
      const weight = wrap === '' ? 500 : 700
      const rise = TOKEN_RISE * metrics.scale * (1 - shown)
      return `<text class="cs-mono" x="${slot.x.toFixed(1)}" y="${(y + rise).toFixed(1)}" font-size="${metrics.linePx}" font-weight="${weight}" text-anchor="start" dominant-baseline="central" opacity="${shown.toFixed(3)}" style="white-space:pre">${faint}<tspan fill="${toneColour(token.tone ?? 'plain', theme)}">${escapeHtml(token.text)}</tspan>${faint}</text>`
    })
    .join('')
  const file = renderText(layout.fileX, y, config.changelog.file, {
    px: metrics.filePx,
    fill: theme.text.faint,
    weight: 500,
    anchor: 'start',
  })
  return `${tokens}${file}`
}

/**
 * Draw the step chips in the margin, each at the row its step produces, appearing as the step starts.
 *
 * Nothing here carries an `opacity` or a `transform`: either one makes the
 * browser composite the element through a surface of its own, and a headless
 * screenshot can catch that surface with another element's pixels still in
 * it. A chip fades by mixing its colours toward transparent, driven by the
 * `--cs-on` property it sets, and slides by its `right` offset.
 *
 * @param frame - The instant being drawn.
 * @returns HTML markup.
 * @example Every chip in place
 * ```ts
 * renderChips({ ...frame, atMs: 9_000 })
 * ```
 */
export function renderChips(frame: CascadeFrame): string {
  const { config, layout, timeline, metrics } = frame
  const steps = [config.parse.api, config.bump.api, config.increment.api, config.changelog.api]
  const base = metrics.widthPx - metrics.chipRightPx
  return steps
    .map((api, index) => {
      const at = timeline.chipsAt[index]
      const rowY = layout.rows[index + 1]
      if (at === undefined || rowY === undefined || frame.atMs < at) {
        return ''
      }
      const t = easeOut(progress(frame.atMs, at, CHIP_MS))
      const right = base - CHIP_SLIDE * metrics.scale * (1 - t)
      return `<div class="cs-chip" style="top:${round(rowY - metrics.chipHPx / 2)}px;right:${right.toFixed(1)}px;--cs-on:${round(t * 100)}%">${renderApiChip(api, config.mark)}</div>`
    })
    .join('')
}
