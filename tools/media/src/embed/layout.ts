import type { MediaProfile } from '../models/profile'
import { hypot, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** A point in the frame, in CSS pixels. */
export interface Point {
  /** Horizontal position. */
  x: number
  /** Vertical position. */
  y: number
}

/** A rectangle in the frame, in CSS pixels. */
export interface Rect {
  /** Left edge. */
  x: number
  /** Top edge. */
  y: number
  /** Width. */
  w: number
  /** Height. */
  h: number
}

/** Where everything in the world sits for one profile. */
export interface EmbedLayout {
  /** The host page's window. */
  host: Rect
  /** Height of the host's chrome bar. */
  hostChromePx: number
  /** The placeholder content bars of the host page. */
  hostBars: readonly Rect[]
  /** The dashed outline the feature seats into. */
  slot: Rect
  /** Where the feature window sits once seated. */
  seat: Rect
  /** Where the feature window starts before it docks. */
  origin: Rect
  /** Height of the feature's chrome bar. */
  featureChromePx: number
  /** Vertical position of the wire. */
  wireY: number
  /** The host end of the wire: the status lamp. */
  port: Point
  /** The feature end of the wire, on the seated window's edge. */
  socket: Point
  /** Centre of the watchdog ring. */
  ringCentre: Point
  /** Radius of the watchdog ring. */
  ringRadius: number
  /** Where a receipt or a saved document lands in the host. */
  landing: Point
  /** Horizontal position of the shutter across the wire. */
  gateX: number
  /** Top-left corner of the host's API chip, above the slot. */
  shellChip: Point
  /** Vertical position of the dimension bracket above the slot. */
  bracketY: number
  /** Where the draft glyph sits inside the seated feature. */
  draftAt: Point
  /** Font size of chips and labels. */
  textPx: number
  /** Font size of the state word inside the ring, a step smaller so the longest state clears the rim. */
  wordPx: number
}

/** Margin between the drawing and the edge of the frame. */
const INSET_PX = 18

/** Width of the seated feature window. */
const SEAT_W = 150

/** Height of the seated feature window. */
const SEAT_H = 112

/** Gap between the slot's outline and the seated window. */
const SLOT_GAP = 4

/** Radius of the watchdog ring. */
const RING_RADIUS = 50

/** How far inside the host's left edge the ring starts. */
const RING_MARGIN_PX = 14

/**
 * Lay the world out for one profile.
 *
 * The host takes the left 62 % of the frame; the feature starts in the space
 * to its right and seats into a slot in the host's lower right. The wire runs
 * from a lamp on the host to the slot's left edge, with the ring around the
 * lamp's left and the landing zone above it.
 *
 * A script in which nothing arrives from outside has no use for the space
 * on the right, so the host takes the centre of the frame instead.
 *
 * @param profile - The presentation target being composed for.
 * @param centred - Whether the host sits in the middle of the frame rather than leaving room on the right for the feature's origin.
 * @returns Every position the renderer needs.
 * @example The slot of the compact profile
 * ```ts
 * embedLayout(profile, false).slot // { x: 220, y: 204, w: 158, h: 120 }
 * ```
 */
export function embedLayout(profile: MediaProfile, centred: boolean): EmbedLayout {
  const hostWidth = round((profile.width - 2 * INSET_PX) * 0.62)
  const host: Rect = {
    x: centred ? round((profile.width - hostWidth) / 2) : INSET_PX,
    y: INSET_PX + 4,
    w: hostWidth,
    h: profile.height - 2 * INSET_PX - 4,
  }
  const seat: Rect = { x: host.x + host.w - 18 - SEAT_W, y: host.y + host.h - 22 - SEAT_H, w: SEAT_W, h: SEAT_H }
  const slot: Rect = { x: seat.x - SLOT_GAP, y: seat.y - SLOT_GAP, w: SEAT_W + 2 * SLOT_GAP, h: SEAT_H + 2 * SLOT_GAP }
  const wireY = seat.y + SEAT_H / 2
  const ringCentre: Point = { x: host.x + RING_MARGIN_PX + RING_RADIUS, y: wireY }
  const port: Point = { x: ringCentre.x + RING_RADIUS, y: wireY }
  const socket: Point = { x: slot.x, y: wireY }
  const barX = host.x + 16
  const barY = host.y + 38
  return {
    host,
    hostChromePx: 24,
    hostBars: [
      { x: barX, y: barY, w: 120, h: 8 },
      { x: barX, y: barY + 20, w: 236, h: 5 },
      { x: barX, y: barY + 32, w: 204, h: 5 },
      { x: barX, y: barY + 44, w: 168, h: 5 },
    ],
    slot,
    seat,
    origin: { x: profile.width - INSET_PX - 26 - SEAT_W, y: 120, w: SEAT_W, h: SEAT_H },
    featureChromePx: 16,
    wireY,
    port,
    socket,
    ringCentre,
    ringRadius: RING_RADIUS,
    landing: { x: ringCentre.x + 26, y: seat.y - 2 },
    gateX: round((port.x + socket.x) / 2),
    shellChip: { x: seat.x, y: seat.y - 56 },
    bracketY: seat.y - 12,
    draftAt: { x: seat.x + SEAT_W - 18, y: seat.y + SEAT_H - 20 },
    textPx: 11.5,
    wordPx: 11,
  }
}

/**
 * Interpolate between two rectangles.
 *
 * @param from - The rectangle at 0.
 * @param to - The rectangle at 1.
 * @param t - Progress from 0 to 1, usually already eased.
 * @returns The rectangle between them.
 */
export function lerpRect(from: Rect, to: Rect, t: number): Rect {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    w: from.w + (to.w - from.w) * t,
    h: from.h + (to.h - from.h) * t,
  }
}

/**
 * The point a stated fraction of the way along a polyline, by arc length.
 *
 * @param points - The corners, in order.
 * @param u - Fraction of the total length from 0 to 1.
 * @returns The point on the polyline.
 */
export function alongPolyline(points: readonly Point[], u: number): Point {
  const first = points[0]
  if (first === undefined) {
    return { x: 0, y: 0 }
  }
  const lengths = points.slice(1).map((point, index) => {
    const previous = points[index] ?? point
    return hypot(point.x - previous.x, point.y - previous.y)
  })
  const total = lengths.reduce((sum, length) => sum + length, 0)
  let remaining = u * total
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index] ?? 0
    const start = points[index] ?? first
    const end = points[index + 1] ?? start
    if (remaining <= length || index === lengths.length - 1) {
      const t = length === 0 ? 1 : remaining / length
      return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }
    }
    remaining -= length
  }
  return first
}
