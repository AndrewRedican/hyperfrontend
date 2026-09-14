import type { PortShape } from '../models/ports'
import type { MediaTheme } from '../models/theme'
import type { Box, NodePlace, Point, PortsLayout, PortsMetrics } from './layout'
import type { PortsTimeline } from './timeline'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { FLASH_MS, GLOW_MS, SEAT_MS, SWEEP_MS, TICK_MS } from './timeline'

/** Half the height of an equilateral triangle, as a fraction of its circumradius. */
const TRIANGLE_HALF_WIDTH = 0.866

/** How strongly a node ticks when a handshake pulse short of the last one reaches it. */
const TICK_STRENGTH = 0.3

/** A run along one axis, from one coordinate to another. */
export interface Span {
  /** Where the run starts. */
  from: number
  /** Where the run ends. */
  to: number
}

/**
 * The `d` attribute of one shape, centred on a point.
 *
 * The circle is a path as well so every shape is drawn by the same element
 * and takes the same attributes.
 *
 * @param shape - Which outline.
 * @param centre - Where its centre sits.
 * @param r - Its circumradius.
 * @returns The path data.
 * @example A triangle of radius 9 at the origin
 * ```ts
 * shapePath('triangle', { x: 0, y: 0 }, 9)
 * ```
 */
export function shapePath(shape: PortShape, centre: Point, r: number): string {
  const x = centre.x
  const y = centre.y
  if (shape === 'circle') {
    return `M ${(x - r).toFixed(1)} ${y.toFixed(1)} a ${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)} 0 a ${r.toFixed(1)} ${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)} 0 Z`
  }
  if (shape === 'triangle') {
    const w = r * TRIANGLE_HALF_WIDTH
    return `M ${x.toFixed(1)} ${(y - r).toFixed(1)} L ${(x + w).toFixed(1)} ${(y + r / 2).toFixed(1)} L ${(x - w).toFixed(1)} ${(y + r / 2).toFixed(1)} Z`
  }
  return `M ${x.toFixed(1)} ${(y - r).toFixed(1)} L ${(x + r).toFixed(1)} ${y.toFixed(1)} L ${x.toFixed(1)} ${(y + r).toFixed(1)} L ${(x - r).toFixed(1)} ${y.toFixed(1)} Z`
}

/**
 * Draw one shape with whatever attributes the caller wants on it.
 *
 * @param shape - Which outline.
 * @param centre - Where its centre sits.
 * @param r - Its circumradius.
 * @param attrs - Attributes, already formatted, such as `fill="..." stroke="..."`.
 * @returns SVG markup for the shape.
 * @example A filled circle
 * ```ts
 * renderShape('circle', centre, 9, `fill="${theme.tones.success}"`)
 * ```
 */
export function renderShape(shape: PortShape, centre: Point, r: number, attrs: string): string {
  return `<path d="${shapePath(shape, centre, r)}" stroke-linejoin="round" ${attrs}/>`
}

/**
 * The vertical run a slot's throat opens: the passage cut through the card's
 * edge to the slot, and the gap it leaves in the card's outline.
 *
 * The throat is as tall as the metric says on both sides of the slot's
 * centre, except under a triangle, whose base sits above where the floor
 * would be: there the floor rises to the base, so the base runs straight out
 * to the edge and the throat closes on the shape instead of stepping past it.
 *
 * @param shape - The outline the slot is cut in.
 * @param centre - Where the slot's centre sits.
 * @param r - The slot's circumradius.
 * @param throatPx - Half the height of a throat, before the shape has its say.
 * @returns The run of y the throat covers.
 * @example The throat under a circle of radius 11 at y 196
 * ```ts
 * throatSpan('circle', { x: 190, y: 196 }, 11, 10) // { from: 186, to: 206 }
 * ```
 */
export function throatSpan(shape: PortShape, centre: Point, r: number, throatPx: number): Span {
  const floor = shape === 'triangle' ? min(throatPx, r / 2) : throatPx
  return { from: centre.y - throatPx, to: centre.y + floor }
}

/**
 * The runs of an edge that remain once the gaps are cut out of it.
 *
 * @param edge - The whole edge.
 * @param gaps - The openings, each inside the edge and not overlapping.
 * @returns The runs between them, in order.
 */
function edgeRuns(edge: Span, gaps: readonly Span[]): readonly Span[] {
  const sorted = [...gaps].sort((a, b) => a.from - b.from)
  const runs: Span[] = []
  let cursor = edge.from
  for (const gap of sorted) {
    if (gap.from > cursor) {
      runs.push({ from: cursor, to: gap.from })
    }
    cursor = max(cursor, gap.to)
  }
  if (cursor < edge.to) {
    runs.push({ from: cursor, to: edge.to })
  }
  return runs
}

/**
 * The outline of a node's card, with its inner edge opened wherever a slot's throat cuts it.
 *
 * @param box - The card.
 * @param corner - Corner radius.
 * @param facing - 1 for a card whose inner edge is its right edge, -1 for its left.
 * @param gaps - The vertical runs of the inner edge to leave open.
 * @returns The path data: the inner edge's runs, then the rest of the perimeter.
 */
function nodeOutline(box: Box, corner: number, facing: number, gaps: readonly Span[]): string {
  const x1 = box.x
  const x2 = box.x + box.width
  const y1 = box.y
  const y2 = box.y + box.height
  const c = corner
  const runs = edgeRuns({ from: y1 + c, to: y2 - c }, gaps)
  if (facing > 0) {
    const inner = runs.map((run) => `M ${x2} ${run.from.toFixed(1)} V ${run.to.toFixed(1)}`).join(' ')
    return `${inner} M ${x2} ${y2 - c} A ${c} ${c} 0 0 1 ${x2 - c} ${y2} H ${x1 + c} A ${c} ${c} 0 0 1 ${x1} ${y2 - c} V ${y1 + c} A ${c} ${c} 0 0 1 ${x1 + c} ${y1} H ${x2 - c} A ${c} ${c} 0 0 1 ${x2} ${y1 + c}`
  }
  const inner = runs.map((run) => `M ${x1} ${run.from.toFixed(1)} V ${run.to.toFixed(1)}`).join(' ')
  return `${inner} M ${x1} ${y1 + c} A ${c} ${c} 0 0 1 ${x1 + c} ${y1} H ${x2 - c} A ${c} ${c} 0 0 1 ${x2} ${y1 + c} V ${y2 - c} A ${c} ${c} 0 0 1 ${x2 - c} ${y2} H ${x1 + c} A ${c} ${c} 0 0 1 ${x1} ${y2 - c}`
}

/**
 * How brightly a node's outline is lit at one instant.
 *
 * A node lights fully when the wire opens and when a token seats in one of
 * its slots, and ticks faintly when a handshake pulse short of the last one
 * reaches it. A token with no slot lights nothing.
 *
 * @param place - The broker's card and everything placed on it.
 * @param timeline - Every moment on the stage's timeline.
 * @param atMs - Offset from the start of the timeline.
 * @returns Intensity from 0 to 1.
 */
function nodeLight(place: NodePlace, timeline: PortsTimeline, atMs: number): number {
  let strength = pulse(atMs, timeline.openAt, FLASH_MS)
  for (const moment of timeline.pulses) {
    if (moment.arriveAt < timeline.openAt && moment.from !== place.side) {
      strength = max(strength, TICK_STRENGTH * pulse(atMs, moment.arriveAt, TICK_MS))
    }
  }
  for (const moment of timeline.messages) {
    if (moment.fits && moment.message.from !== place.side) {
      strength = max(strength, pulse(atMs, moment.arriveAt + SEAT_MS, GLOW_MS))
    }
  }
  return strength
}

/**
 * Draw the wire: dashed until the handshake completes, then lit from the middle out.
 *
 * @param layout - Where everything sits.
 * @param timeline - Every moment on the stage's timeline.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the wire.
 * @example The wire at the first frame, still dashed
 * ```ts
 * renderWire(layout, timeline, theme, 0)
 * ```
 */
export function renderWire(layout: PortsLayout, timeline: PortsTimeline, theme: MediaTheme, atMs: number): string {
  const x1 = layout.left.edgeX
  const x2 = layout.right.edgeX
  const y = layout.wireY
  const sweep = easeOut(progress(atMs, timeline.openAt, SWEEP_MS))
  const dashed = `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${theme.border}" stroke-width="1.5" stroke-dasharray="5 6" stroke-linecap="round" opacity="${(1 - sweep).toFixed(3)}"/>`
  if (sweep <= 0) {
    return dashed
  }
  const middle = (x1 + x2) / 2
  const half = ((x2 - x1) / 2) * sweep
  const lit = `<line x1="${(middle - half).toFixed(1)}" y1="${y}" x2="${(middle + half).toFixed(1)}" y2="${y}" stroke="${theme.accent}" stroke-width="7" stroke-linecap="round" opacity="0.16"/><line x1="${(middle - half).toFixed(1)}" y1="${y}" x2="${(middle + half).toFixed(1)}" y2="${y}" stroke="${theme.accent}" stroke-width="2" stroke-linecap="round"/>`
  return `${dashed}${lit}`
}

/**
 * Draw every handshake pulse that is in flight: a plain glowing dot, no shape and no name.
 *
 * @param layout - Where everything sits.
 * @param timeline - Every moment on the stage's timeline.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the pulses in flight, or nothing.
 * @example The first pulse half way across
 * ```ts
 * renderPulses(layout, timeline, metrics, theme, 800)
 * ```
 */
export function renderPulses(layout: PortsLayout, timeline: PortsTimeline, metrics: PortsMetrics, theme: MediaTheme, atMs: number): string {
  return timeline.pulses
    .map((moment) => {
      if (atMs < moment.setOffAt || atMs >= moment.arriveAt) {
        return ''
      }
      const t = easeInOut(progress(atMs, moment.setOffAt, moment.arriveAt - moment.setOffAt))
      const x = lerp(layout.left.edgeX, layout.right.edgeX, moment.from === 'left' ? t : 1 - t)
      return `<circle cx="${x.toFixed(1)}" cy="${layout.wireY}" r="${metrics.pulsePx * 2.4}" fill="${theme.accent}" opacity="0.2"/><circle cx="${x.toFixed(1)}" cy="${layout.wireY}" r="${metrics.pulsePx}" fill="${theme.accent}"/>`
    })
    .join('')
}

/**
 * Draw one node's card, its outline opened at each slot's throat, and its light.
 *
 * @param place - The broker's card and everything placed on it.
 * @param timeline - Every moment on the stage's timeline.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the card and, when lit, its outline glow.
 * @example The left node at the first frame
 * ```ts
 * renderNodeCard(layout.left, timeline, metrics, theme, 0)
 * ```
 */
export function renderNodeCard(place: NodePlace, timeline: PortsTimeline, metrics: PortsMetrics, theme: MediaTheme, atMs: number): string {
  const { box } = place
  const gaps = place.slots.map((slot) => throatSpan(slot.shape, slot.centre, metrics.slotPx, metrics.throatPx))
  const fill = `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${metrics.cornerPx}" fill="${theme.surface}"/>`
  const outline = `<path d="${nodeOutline(box, metrics.cornerPx, place.facing, gaps)}" fill="none" stroke="${theme.border}" stroke-width="1.5"/>`
  const light = nodeLight(place, timeline, atMs)
  if (light <= 0) {
    return `${fill}${outline}`
  }
  const grow = 4 * light
  const halo = `<rect x="${(box.x - grow).toFixed(1)}" y="${(box.y - grow).toFixed(1)}" width="${(box.width + 2 * grow).toFixed(1)}" height="${(box.height + 2 * grow).toFixed(1)}" rx="${(metrics.cornerPx + grow).toFixed(1)}" fill="none" stroke="${theme.borderActive}" stroke-width="1.5" opacity="${(0.35 * light).toFixed(3)}"/>`
  const ring = `<path d="${nodeOutline(box, metrics.cornerPx, place.facing, gaps)}" fill="none" stroke="${theme.borderActive}" stroke-width="2" opacity="${light.toFixed(3)}"/>`
  return `${fill}${halo}${outline}${ring}`
}
