import type { PortsConfig, PortType } from '../models/ports'
import type { MediaTheme } from '../models/theme'
import type { NodePlace, Point, PortsLayout, PortsMetrics, SlotPlace } from './layout'
import type { MessageMoment, PortsTimeline } from './timeline'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { easeIn, easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { receiverOf, senderOf } from './layout'
import { renderShape, throatSpan } from './render'
import { FALL_MS, GLOW_MS, HALT_MS, MARK_DELAY_MS, MARK_MS, POP_MS, SEAT_MS } from './timeline'

/** How long a slot's name takes to brighten once a token is seated in it. */
const NAME_LIFT_MS = 300

/** How far one character of the mono face advances, as a fraction of its size, with a little to spare. */
const MONO_ADVANCE = 0.62

/** How far around a slot its clip reaches, in slot radii: past the whole cut and its glow. */
const CLIP_REACH = 4

/** Where a token is and how it looks at one instant. */
interface TokenPose {
  /** Its centre. */
  centre: Point
  /** Its circumradius. */
  r: number
  /** How solid it is. */
  opacity: number
  /** How solid the name under it is. */
  labelOpacity: number
}

/**
 * The type a message is, with its shape and tone.
 *
 * @param config - The brokers as the scene configured them.
 * @param type - The type name.
 * @returns The type's shape and tone, or undefined for a type no contract names.
 */
function typeOf(config: PortsConfig, type: string): PortType | undefined {
  return config.types.find((candidate) => candidate.type === type)
}

/**
 * The slot on a node that takes a type.
 *
 * @param place - The broker's card and everything placed on it.
 * @param type - The type name.
 * @returns The slot, or undefined when the node's contract never accepted the type.
 */
function slotFor(place: NodePlace, type: string): SlotPlace | undefined {
  return place.slots.find((slot) => slot.type === type)
}

/**
 * Where a token waits at the receiver's boundary: just outside the inner edge, level with its slot if it has one.
 *
 * @param receiver - The node it is arriving at.
 * @param slot - Its slot, or undefined when there is none.
 * @returns The point it halts at.
 */
function approachPoint(receiver: NodePlace, slot: SlotPlace | undefined): Point {
  return { x: receiver.dock.x, y: slot === undefined ? receiver.dock.y : slot.centre.y }
}

/**
 * Where a token's name is centred: under the token while it crosses, and
 * parked just outside the nearer card while the token pops, docks, halts or
 * falls, so the name never runs under a card's outline.
 *
 * @param type - The name.
 * @param centreX - The token's centre.
 * @param layout - Where everything sits.
 * @param metrics - The measurements this profile is drawn at.
 * @returns The x the name is centred on.
 */
function labelX(type: string, centreX: number, layout: PortsLayout, metrics: PortsMetrics): number {
  const half = (type.length * metrics.labelPx * MONO_ADVANCE) / 2
  return min(layout.right.edgeX - half - metrics.labelGapPx, max(layout.left.edgeX + half + metrics.labelGapPx, centreX))
}

/**
 * Where one message's token is at one instant.
 *
 * @param moment - The message and its moments.
 * @param layout - Where everything sits.
 * @param metrics - The measurements this profile is drawn at.
 * @param crossMs - How long a token takes to cross the wire.
 * @param atMs - Offset from the start of the timeline.
 * @returns The pose, or undefined before the token appears or once it has dissolved.
 */
function tokenPose(
  moment: MessageMoment,
  layout: PortsLayout,
  metrics: PortsMetrics,
  crossMs: number,
  atMs: number
): TokenPose | undefined {
  if (atMs < moment.popAt) {
    return undefined
  }
  const sender = senderOf(layout, moment.message.from)
  const receiver = receiverOf(layout, moment.message.from)
  const slot = moment.fits ? slotFor(receiver, moment.message.type) : undefined
  const approach = approachPoint(receiver, slot)
  if (atMs < moment.crossAt) {
    const grown = easeOut(progress(atMs, moment.popAt, POP_MS))
    return { centre: sender.dock, r: metrics.tokenPx * grown, opacity: 1, labelOpacity: grown }
  }
  if (atMs < moment.arriveAt) {
    const t = easeInOut(progress(atMs, moment.crossAt, crossMs))
    return {
      centre: { x: lerp(sender.dock.x, approach.x, t), y: lerp(sender.dock.y, approach.y, t) },
      r: metrics.tokenPx,
      opacity: 1,
      labelOpacity: 1,
    }
  }
  if (slot !== undefined) {
    const seated = easeInOut(progress(atMs, moment.arriveAt, SEAT_MS))
    return {
      centre: { x: lerp(approach.x, slot.centre.x, seated), y: lerp(approach.y, slot.centre.y, seated) },
      r: lerp(metrics.tokenPx, metrics.slotPx, seated),
      opacity: 1,
      labelOpacity: 1 - seated,
    }
  }
  const fallAt = moment.arriveAt + HALT_MS
  const fallen = progress(atMs, fallAt, FALL_MS)
  if (fallen >= 1) {
    return undefined
  }
  return {
    centre: { x: approach.x, y: approach.y + metrics.fallPx * easeIn(fallen) },
    r: metrics.tokenPx,
    opacity: 1 - fallen,
    labelOpacity: 1 - easeOut(fallen),
  }
}

/**
 * Draw every token: the ones in flight with their names under them, and the ones seated in a slot.
 *
 * @param config - The brokers and the messages as the scene configured them.
 * @param layout - Where everything sits.
 * @param timeline - Every moment on the stage's timeline.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the tokens, or nothing before the first sets off.
 * @example The first token mid-crossing
 * ```ts
 * renderTokens(config, layout, timeline, metrics, theme, 4_500)
 * ```
 */
export function renderTokens(
  config: PortsConfig,
  layout: PortsLayout,
  timeline: PortsTimeline,
  metrics: PortsMetrics,
  theme: MediaTheme,
  atMs: number
): string {
  return timeline.messages
    .map((moment) => {
      const type = typeOf(config, moment.message.type)
      const pose = tokenPose(moment, layout, metrics, config.crossMs, atMs)
      if (type === undefined || pose === undefined || pose.r <= 0) {
        return ''
      }
      const colour = theme.tones[type.tone]
      const shape = renderShape(type.shape, pose.centre, pose.r, `fill="${colour}" opacity="${pose.opacity.toFixed(3)}"`)
      if (pose.labelOpacity <= 0) {
        return shape
      }
      const x = labelX(moment.message.type, pose.centre.x, layout, metrics)
      const label = `<text x="${x.toFixed(1)}" y="${(pose.centre.y + metrics.tokenLabelDropPx).toFixed(1)}" class="pt-token-name" fill="${colour}" text-anchor="middle" opacity="${(pose.labelOpacity * pose.opacity).toFixed(3)}">${escapeHtml(moment.message.type)}</text>`
      return `${shape}${label}`
    })
    .join('')
}

/**
 * Draw one node's slots: each a cut-out on the inner edge with a throat to
 * the boundary and the type's name beside it, glowing once a token seats.
 *
 * The cut is clipped to everything but its throat, and the throat's own fill
 * and walls are drawn over the opening, so the side of the cut the throat
 * opens into is never drawn at all and the two read as one keyhole rather
 * than a shape with a passage stuck on.
 *
 * @param config - The brokers as the scene configured them.
 * @param place - The broker's card and everything placed on it.
 * @param timeline - Every moment on the stage's timeline.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the slots.
 * @example The right node's slots at the first frame
 * ```ts
 * renderSlots(config, layout.right, timeline, metrics, theme, 0)
 * ```
 */
export function renderSlots(
  config: PortsConfig,
  place: NodePlace,
  timeline: PortsTimeline,
  metrics: PortsMetrics,
  theme: MediaTheme,
  atMs: number
): string {
  return place.slots
    .map((slot, index) => {
      const type = typeOf(config, slot.type)
      if (type === undefined) {
        return ''
      }
      const seatedAt = timeline.messages.find(
        (moment) => moment.fits && moment.message.from !== place.side && moment.message.type === slot.type
      )
      const glowAt = seatedAt === undefined ? undefined : seatedAt.arriveAt + SEAT_MS
      const glow = glowAt === undefined ? 0 : pulse(atMs, glowAt, GLOW_MS)
      const lift = glowAt === undefined ? 0 : easeOut(progress(atMs, glowAt, NAME_LIFT_MS))
      const span = throatSpan(type.shape, slot.centre, metrics.slotPx, metrics.throatPx)
      const x1 = (place.facing > 0 ? slot.centre.x : place.edgeX).toFixed(1)
      const x2 = (place.facing > 0 ? place.edgeX : slot.centre.x).toFixed(1)
      const y1 = span.from.toFixed(1)
      const y2 = span.to.toFixed(1)
      const height = (span.to - span.from).toFixed(1)
      const reach = metrics.slotPx * CLIP_REACH
      const clipId = `pt-throat-${place.side}-${index}`
      const clip = `<clipPath id="${clipId}"><path clip-rule="evenodd" d="M ${(slot.centre.x - reach).toFixed(1)} ${(slot.centre.y - reach).toFixed(1)} h ${(2 * reach).toFixed(1)} v ${(2 * reach).toFixed(1)} h ${(-2 * reach).toFixed(1)} Z M ${x1} ${y1} h ${metrics.slotInsetPx} v ${height} h ${-metrics.slotInsetPx} Z"/></clipPath>`
      const cut = `${clip}<g clip-path="url(#${clipId})">${renderShape(type.shape, slot.centre, metrics.slotPx, `fill="${theme.rule}" stroke="${theme.border}" stroke-width="1.5"`)}</g>`
      const passage = `<rect x="${x1}" y="${y1}" width="${metrics.slotInsetPx}" height="${height}" fill="${theme.rule}"/>`
      const walls = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y1}" stroke="${theme.border}" stroke-width="1.5"/><line x1="${x1}" y1="${y2}" x2="${x2}" y2="${y2}" stroke="${theme.border}" stroke-width="1.5"/>`
      const throat = `${passage}${walls}`
      const halo =
        glow > 0
          ? `${renderShape(type.shape, slot.centre, metrics.slotPx + 6 * glow, `fill="none" stroke="${theme.tones.success}" stroke-width="1.5" opacity="${(0.45 * glow).toFixed(3)}"`)}${renderShape(type.shape, slot.centre, metrics.slotPx, `fill="none" stroke="${theme.tones.success}" stroke-width="2.2" opacity="${glow.toFixed(3)}"`)}`
          : ''
      const name = `<text x="${slot.nameX.toFixed(1)}" y="${slot.centre.y.toFixed(1)}" class="pt-slot-name" text-anchor="${slot.anchor}" dominant-baseline="central" fill="${theme.text.muted}" opacity="${(1 - lift).toFixed(3)}">${escapeHtml(slot.type)}</text><text x="${slot.nameX.toFixed(1)}" y="${slot.centre.y.toFixed(1)}" class="pt-slot-name" text-anchor="${slot.anchor}" dominant-baseline="central" fill="${theme.text.plain}" opacity="${lift.toFixed(3)}">${escapeHtml(slot.type)}</text>`
      return `${cut}${throat}${halo}${name}`
    })
    .join('')
}

/**
 * Draw the mark each dropped token left where it dissolved: a small struck circle in the faint text colour.
 *
 * @param layout - Where everything sits.
 * @param timeline - Every moment on the stage's timeline.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the marks, or nothing before the first token drops.
 * @example The marks once everything has settled
 * ```ts
 * renderMarks(layout, timeline, metrics, theme, timeline.settledAt)
 * ```
 */
export function renderMarks(layout: PortsLayout, timeline: PortsTimeline, metrics: PortsMetrics, theme: MediaTheme, atMs: number): string {
  return timeline.messages
    .map((moment) => {
      if (moment.fits) {
        return ''
      }
      const shown = easeOut(progress(atMs, moment.arriveAt + HALT_MS + MARK_DELAY_MS, MARK_MS))
      if (shown <= 0) {
        return ''
      }
      const receiver = receiverOf(layout, moment.message.from)
      const x = receiver.dock.x
      const y = receiver.dock.y + metrics.fallPx
      const r = metrics.markPx
      const d = r * 0.72
      return `<g opacity="${shown.toFixed(3)}" stroke="${theme.text.faint}" stroke-width="1.5" stroke-linecap="round" fill="none"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/><line x1="${(x - d).toFixed(1)}" y1="${(y + d).toFixed(1)}" x2="${(x + d).toFixed(1)}" y2="${(y - d).toFixed(1)}"/></g>`
    })
    .join('')
}
