import type { LoopConfig, LoopStation } from '../models/loop'
import type { MediaTheme } from '../models/theme'
import type { Rect } from '../stage/geometry'
import type { LoopLayout } from './layout'
import type { LoopState, TokenState } from './timeline'
import { escapeHtml } from '../lib/escape-html'
import { renderArrowhead } from '../stage/figure'

/** Half the side of a token. */
const TOKEN_R = 8

/**
 * The colour a mark is drawn in on a filled indicator: the plate on a
 * portable frame, white on a themed one.
 *
 * @param theme - The visual tokens this variant is drawn with.
 * @returns A colour.
 */
function inkOn(theme: MediaTheme): string {
  return theme.transparent ? theme.plate : '#ffffff'
}

/**
 * A person: a head over a pair of shoulders.
 *
 * @param x - Horizontal centre.
 * @param y - Vertical centre.
 * @param colour - Stroke colour.
 * @returns SVG markup for the glyph.
 */
function renderPerson(x: number, y: number, colour: string): string {
  return `<g transform="translate(${x} ${y})" fill="none" stroke="${colour}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="0" cy="-5" r="4.5"/><path d="M -9 9 C -9 2, 9 2, 9 9"/></g>`
}

/**
 * A spark: the four-pointed star that stands for generation.
 *
 * @param x - Horizontal centre.
 * @param y - Vertical centre.
 * @param colour - Stroke colour.
 * @returns SVG markup for the glyph.
 */
function renderSpark(x: number, y: number, colour: string): string {
  return `<g transform="translate(${x} ${y})" fill="none" stroke="${colour}" stroke-width="1.8" stroke-linejoin="round"><path d="M 0 -10 C 1 -4, 4 -1, 10 0 C 4 1, 1 4, 0 10 C -1 4, -4 1, -10 0 C -4 -1, -1 -4, 0 -10 z"/><path d="M 7 -8 l 0.6 2 l 2 0.6 l -2 0.6 l -0.6 2 l -0.6 -2 l -2 -0.6 l 2 -0.6 z" fill="${colour}" stroke="none"/></g>`
}

/**
 * Draw one station card, lit to the degree the moment asks.
 *
 * @param rect - Where the card sits.
 * @param station - What it says.
 * @param lit - How lit it is, 0 to 1.
 * @param glyph - `person` or `spark`, for the corner.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the card.
 */
export function renderStation(rect: Rect, station: LoopStation, lit: number, glyph: 'person' | 'spark', theme: MediaTheme): string {
  const halo =
    lit > 0
      ? `<rect x="${rect.x - 6}" y="${rect.y - 6}" width="${rect.w + 12}" height="${rect.h + 12}" rx="18" fill="${theme.accentSoft}" opacity="${lit.toFixed(3)}"/>`
      : ''
  const glyphX = rect.x + rect.w - 30
  const glyphY = rect.y + 30
  const colour = lit > 0.5 ? theme.accent : theme.text.muted
  return `${halo}
    <rect class="lp-card" x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="12" style="stroke:${lit > 0 ? theme.accent : theme.border};stroke-opacity:${(0.4 + 0.6 * lit).toFixed(3)}"/>
    <text class="fig-caps" x="${rect.x + 18}" y="${rect.y + 22}">${escapeHtml(station.who)}</text>
    <text class="fig-label" x="${rect.x + 18}" y="${rect.y + 43}">${escapeHtml(station.title)}</text>
    <text class="fig-note" x="${rect.x + 18}" y="${rect.y + 61}">${escapeHtml(station.note)}</text>
    ${glyph === 'person' ? renderPerson(glyphX, glyphY, colour) : renderSpark(glyphX, glyphY, colour)}`
}

/**
 * Draw the rails: the box, the caption, one bar per check with its
 * indicator, and the dashed bar the next rule will fill.
 *
 * @param config - The loop as the scene configured it.
 * @param layout - Where everything sits.
 * @param state - What the moment shows.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the rails.
 */
export function renderRails(config: LoopConfig, layout: LoopLayout, state: LoopState, theme: MediaTheme): string {
  const { rails } = layout
  const flash =
    state.railsLit > 0
      ? `<rect x="${rails.x - 5}" y="${rails.y - 5}" width="${rails.w + 10}" height="${rails.h + 10}" rx="6" fill="none" stroke="${theme.tones.success}" stroke-width="2" opacity="${(0.7 * state.railsLit).toFixed(3)}"/>`
      : ''
  const bars = layout.railYs
    .map((y, index) => {
      const isNext = index === layout.railYs.length - 1
      const label = isNext ? config.nextRail : (config.rails[index] ?? '')
      const mark = state.marks.find((candidate) => candidate.rail === index)
      const barX = rails.x + 14
      const barW = rails.w - 28
      if (isNext) {
        const fill = state.nextRail
        return `<rect class="lp-rail lp-rail--next" x="${barX}" y="${y - 11}" width="${barW}" height="22" rx="3" style="stroke-dasharray:${fill >= 1 ? 'none' : '4 3'};fill-opacity:${fill.toFixed(3)}"/>
          <text class="lp-rail-label${fill > 0.5 ? ' lp-rail-label--filled' : ' lp-rail-label--faint'}" x="${barX + 12}" y="${y + 4}">${escapeHtml(label)}</text>`
      }
      const indicator =
        mark === undefined
          ? `<circle cx="${barX + barW - 14}" cy="${y}" r="6" fill="none" stroke="${theme.rule}" stroke-width="1.2"/>`
          : `<circle cx="${barX + barW - 14}" cy="${y}" r="6.5" fill="${theme.tones.success}" opacity="${mark.strength.toFixed(3)}"/><path d="M ${barX + barW - 17.5} ${y} l 2.5 2.5 l 4.5 -5" fill="none" stroke="${inkOn(theme)}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
      return `<rect class="lp-rail" x="${barX}" y="${y - 11}" width="${barW}" height="22" rx="3"/>
        <text class="lp-rail-label" x="${barX + 12}" y="${y + 4}">${escapeHtml(label)}</text>${indicator}`
    })
    .join('')
  return `${flash}<rect class="lp-rails" x="${rails.x}" y="${rails.y}" width="${rails.w}" height="${rails.h}" rx="4"/>
    <text class="fig-caps" x="${rails.x + 16}" y="${rails.y + 24}">${escapeHtml(config.railsCaption)}</text>${bars}`
}

/**
 * Draw the track the change travels, and the return path under it.
 *
 * @param config - The loop as the scene configured it.
 * @param layout - Where everything sits.
 * @returns SVG markup for both paths.
 */
export function renderTrack(config: LoopConfig, layout: LoopLayout): string {
  const { define, propose, rails, review } = layout
  const gap = 10
  const edges = [
    `<line x1="${define.x + define.w + gap}" y1="${layout.topY}" x2="${propose.x - gap}" y2="${layout.topY}"/>${renderArrowhead(propose.x - gap, layout.topY, 0, 6)}`,
    `<line x1="${layout.rightX}" y1="${propose.y + propose.h + gap}" x2="${layout.rightX}" y2="${rails.y - gap}"/>${renderArrowhead(layout.rightX, rails.y - gap, 90, 6)}`,
    `<line x1="${rails.x - gap}" y1="${layout.bottomY}" x2="${review.x + review.w + gap}" y2="${layout.bottomY}"/>${renderArrowhead(review.x + review.w + gap, layout.bottomY, 180, 6)}`,
    `<line x1="${layout.leftX}" y1="${review.y - gap}" x2="${layout.leftX}" y2="${define.y + define.h + gap}"/>${renderArrowhead(layout.leftX, define.y + define.h + gap, -90, 6)}`,
  ].join('')
  const back = `M ${layout.leftX} ${review.y + review.h + gap} L ${layout.leftX} ${layout.returnY} L ${layout.rightX} ${layout.returnY} L ${layout.rightX} ${rails.y + rails.h + gap}`
  return `<g class="lp-track">${edges}</g>
    <g class="lp-track lp-track--back"><path d="${back}"/>${renderArrowhead(layout.rightX, rails.y + rails.h + gap, -90, 6)}</g>
    <text class="fig-note" x="${(layout.leftX + layout.rightX) / 2}" y="${layout.returnY - 13}" text-anchor="middle">${escapeHtml(config.feedback)}</text>`
}

/**
 * Draw one token in the shape and tone its state gives it.
 *
 * @param token - Where the token is and how it looks.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the token.
 */
export function renderToken(token: TokenState, theme: MediaTheme): string {
  if (token.scale <= 0 || token.opacity <= 0) {
    return ''
  }
  const colour = token.tone === 'success' ? theme.tones.success : token.tone === 'danger' ? theme.tones.danger : theme.accent
  const r = TOKEN_R
  const body =
    token.shape === 'circle'
      ? `<circle r="${r}" fill="${colour}"/>`
      : token.shape === 'diamond'
        ? `<rect x="${-r + 1}" y="${-r + 1}" width="${2 * r - 2}" height="${2 * r - 2}" rx="2" transform="rotate(45)" fill="${colour}"/>`
        : `<rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="4" fill="${colour}"/>`
  const badge = token.failed
    ? `<g transform="translate(${r + 10} 0)"><circle r="6.5" fill="${colour}"/><path d="M -3 -3 l 6 6 M 3 -3 l -6 6" fill="none" stroke="${inkOn(theme)}" stroke-width="1.6" stroke-linecap="round"/></g>`
    : ''
  return `<g transform="translate(${token.at.x.toFixed(1)} ${token.at.y.toFixed(1)}) scale(${token.scale.toFixed(3)})" opacity="${token.opacity.toFixed(3)}"><circle r="${r * 2}" fill="${colour}" opacity="0.16"/>${body}${badge}</g>`
}

/**
 * Draw the new rail on its way back: a short bar, the same shape it will
 * have once it is in place.
 *
 * @param chip - The chip in flight.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the chip.
 */
export function renderChip(chip: TokenState, theme: MediaTheme): string {
  return `<g transform="translate(${chip.at.x.toFixed(1)} ${chip.at.y.toFixed(1)}) scale(${chip.scale.toFixed(3)})"><rect x="-15" y="-6" width="30" height="12" rx="3" fill="${theme.tones.success}"/><rect x="-22" y="-10" width="44" height="20" rx="6" fill="${theme.tones.success}" opacity="0.14"/></g>`
}
