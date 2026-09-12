import type { MediaTheme } from '../models/theme'
import type { QueueMetrics } from './layout'
import type { DiscPose } from './timeline'
import { escapeHtml } from '../lib/escape-html'

/** Which side of its anchor a label is drawn on. */
export type LabelSide = 'left' | 'right'

/**
 * Draw the tube: two walls open at both ends, with a dashed gate across the
 * bottom that is out of the way while a disc is passing through it.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param gate - How much of the gate is drawn, from 0 to 1.
 * @returns SVG markup for the tube.
 */
export function renderTube(metrics: QueueMetrics, theme: MediaTheme, gate: number): string {
  const left = (metrics.fifoXPx - metrics.halfWidthPx).toFixed(1)
  const right = (metrics.fifoXPx + metrics.halfWidthPx).toFixed(1)
  const top = metrics.topPx.toFixed(1)
  const bottom = metrics.bottomPx.toFixed(1)
  const walls = `<path d="M ${left} ${top} V ${bottom} M ${right} ${top} V ${bottom}" fill="none" stroke="${theme.text.muted}" stroke-width="${metrics.wallPx}" stroke-linecap="round"/>`
  const gateLine = `<path d="M ${(metrics.fifoXPx - metrics.halfWidthPx + 4 * metrics.scale).toFixed(1)} ${bottom} H ${(metrics.fifoXPx + metrics.halfWidthPx - 4 * metrics.scale).toFixed(1)}" fill="none" stroke="${theme.text.faint}" stroke-width="${metrics.wallPx}" stroke-dasharray="${(4 * metrics.scale).toFixed(1)} ${(4 * metrics.scale).toFixed(1)}" stroke-linecap="round" opacity="${gate.toFixed(3)}"/>`
  return `${walls}${gateLine}`
}

/**
 * Draw the cup: two walls joined by a rounded floor, open only at the top.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the cup.
 */
export function renderCup(metrics: QueueMetrics, theme: MediaTheme): string {
  const left = (metrics.lifoXPx - metrics.halfWidthPx).toFixed(1)
  const right = (metrics.lifoXPx + metrics.halfWidthPx).toFixed(1)
  const top = metrics.topPx.toFixed(1)
  const r = metrics.floorRPx
  const floorTop = (metrics.bottomPx - r).toFixed(1)
  const bottom = metrics.bottomPx.toFixed(1)
  const d = `M ${left} ${top} V ${floorTop} A ${r} ${r} 0 0 0 ${(metrics.lifoXPx - metrics.halfWidthPx + r).toFixed(1)} ${bottom} H ${(metrics.lifoXPx + metrics.halfWidthPx - r).toFixed(1)} A ${r} ${r} 0 0 0 ${right} ${floorTop} V ${top}`
  return `<path d="${d}" fill="none" stroke="${theme.text.muted}" stroke-width="${metrics.wallPx}" stroke-linecap="round" stroke-linejoin="round"/>`
}

/**
 * Draw the empty slots of an exit row as dashed outlines.
 *
 * @param xs - Horizontal centre of each slot.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the slots.
 */
export function renderSlots(xs: readonly number[], metrics: QueueMetrics, theme: MediaTheme): string {
  const dash = (3 * metrics.scale).toFixed(1)
  return xs
    .map(
      (x) =>
        `<circle cx="${x.toFixed(1)}" cy="${metrics.rowYPx.toFixed(1)}" r="${metrics.discRPx.toFixed(1)}" fill="none" stroke="${theme.text.faint}" stroke-width="1.5" stroke-dasharray="${dash} ${dash}"/>`
    )
    .join('')
}

/**
 * Draw the band that marks an exit row as complete.
 *
 * @param xs - Horizontal centre of each slot in the row.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param opacity - How far the band has appeared, from 0 to 1.
 * @returns SVG markup for the band, or nothing while it is invisible.
 */
export function renderBand(xs: readonly number[], metrics: QueueMetrics, theme: MediaTheme, opacity: number): string {
  const first = xs[0]
  const last = xs[xs.length - 1]
  if (first === undefined || last === undefined || opacity <= 0) {
    return ''
  }
  const reach = metrics.discRPx + metrics.bandPadPx
  const x = (first - reach).toFixed(1)
  const y = (metrics.rowYPx - reach).toFixed(1)
  const width = (last - first + 2 * reach).toFixed(1)
  const height = (2 * reach).toFixed(1)
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${reach.toFixed(1)}" fill="${theme.tones.success}" fill-opacity="${(0.12 * opacity).toFixed(3)}" stroke="${theme.tones.success}" stroke-opacity="${(0.55 * opacity).toFixed(3)}" stroke-width="1.5"/>`
}

/**
 * Draw one disc: a ring in the accent round a raised surface, numbered.
 *
 * @param pose - Where the disc is and how visible.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the disc, or nothing while it is invisible.
 */
export function renderDisc(pose: DiscPose, metrics: QueueMetrics, theme: MediaTheme): string {
  if (pose.opacity <= 0) {
    return ''
  }
  const opacity = pose.opacity >= 1 ? '' : ` opacity="${pose.opacity.toFixed(3)}"`
  return `<g transform="translate(${pose.x.toFixed(1)} ${pose.y.toFixed(1)})"${opacity}><circle r="${metrics.discRPx.toFixed(1)}" fill="${theme.surfaceRaised}" stroke="${theme.accent}" stroke-width="${metrics.ringPx}"/><text class="qu-face" text-anchor="middle" dominant-baseline="central">${escapeHtml(pose.face)}</text></g>`
}

/**
 * Draw a push or pull label beside the place the action happens.
 *
 * @param text - The word, one of the package's two verbs.
 * @param x - The anchor the label sits beside.
 * @param y - Vertical centre of the label.
 * @param side - Which side of the anchor the label extends to.
 * @param opacity - How visible the label is, from 0 to 1.
 * @returns SVG markup for the label, or nothing while it is invisible.
 */
export function renderLabel(text: string, x: number, y: number, side: LabelSide, opacity: number): string {
  if (opacity <= 0) {
    return ''
  }
  const anchor = side === 'left' ? 'end' : 'start'
  return `<text class="qu-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="central" opacity="${opacity.toFixed(3)}">${escapeHtml(text)}</text>`
}
