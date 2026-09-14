import type { MediaProfile } from '../models/profile'
import { min, round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** The width the composition is designed at; every measurement scales from it. */
const DESIGN_WIDTH = 640

/** The height the composition is designed at. */
const DESIGN_HEIGHT = 360

/** A point in the frame, in CSS pixels. */
export interface Point {
  /** Horizontal position. */
  x: number
  /** Vertical position. */
  y: number
}

/** How the frame is sized for the surface it is being drawn for. */
export interface QueueMetrics {
  /** How much larger than the design this frame is drawn. */
  scale: number
  /** Horizontal centre of the tube. */
  fifoXPx: number
  /** Horizontal centre of the cup. */
  lifoXPx: number
  /** Half the width of a container, wall to wall. */
  halfWidthPx: number
  /** The open mouth of both containers. */
  topPx: number
  /** The tube's gate and the cup's floor. */
  bottomPx: number
  /** Radius of the cup's rounded floor corners. */
  floorRPx: number
  /** Radius of a disc. */
  discRPx: number
  /** Gap between two stacked discs, and between the lowest disc and the floor. */
  discGapPx: number
  /** Vertical centre of the chips. */
  chipYPx: number
  /** Font size of the chips. */
  chipPx: number
  /** How far left of a container's centre a pushed disc appears. */
  stageDxPx: number
  /** Vertical centre of a pushed disc where it appears. */
  stageYPx: number
  /** Vertical centre of a disc lifted out of the cup at the top of its lift. */
  apexYPx: number
  /** Vertical centre of both exit rows. */
  rowYPx: number
  /** Distance between two neighbouring slots in an exit row. */
  slotPitchPx: number
  /** Gap between the cup's wall and the first slot of its row. */
  rowGapPx: number
  /** How far the band round a completed row extends past its slots. */
  bandPadPx: number
  /** Font size of the push and pull labels. */
  labelPx: number
  /** Font size of the number on a disc. */
  numberPx: number
  /** Stroke width of a container's walls. */
  wallPx: number
  /** Stroke width of a disc's ring. */
  ringPx: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * The composition is designed at the compact profile and scaled uniformly
 * from it, centred, so a wider profile gets the same picture larger rather
 * than a different picture.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
export function queueMetrics(profile: MediaProfile): QueueMetrics {
  const scale = min(profile.width / DESIGN_WIDTH, profile.height / DESIGN_HEIGHT)
  const centreX = profile.width / 2
  const centreY = profile.height / 2
  const at = (design: number): number => round(design * scale * 10) / 10
  return {
    scale,
    fifoXPx: centreX - at(174),
    lifoXPx: centreX + at(58),
    halfWidthPx: at(45),
    topPx: centreY - at(76),
    bottomPx: centreY + at(82),
    floorRPx: at(14),
    discRPx: at(15),
    discGapPx: at(6),
    chipYPx: centreY - at(150),
    chipPx: scale >= 1.3 ? 13 : 12,
    stageDxPx: at(64),
    stageYPx: centreY - at(118),
    apexYPx: centreY - at(118),
    rowYPx: centreY + at(120),
    slotPitchPx: at(38),
    rowGapPx: at(18),
    bandPadPx: at(10),
    labelPx: scale >= 1.3 ? 12 : 11,
    numberPx: scale >= 1.3 ? 15 : 13,
    wallPx: 2,
    ringPx: 2,
  }
}

/**
 * The vertical centre of a disc resting at a position in a stack.
 *
 * Position 0 is the disc on the floor. A fractional position is a disc
 * between two, which is what a settling stack is drawn with.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param position - Position in the stack, counted up from the floor.
 * @returns Vertical centre, in CSS pixels.
 */
export function restY(metrics: QueueMetrics, position: number): number {
  return metrics.bottomPx - metrics.discGapPx - metrics.discRPx - position * (2 * metrics.discRPx + metrics.discGapPx)
}

/**
 * The horizontal centre of a slot in the tube's exit row, which runs under the tube.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param index - Slot index from the left.
 * @param count - How many slots the row has.
 * @returns Horizontal centre, in CSS pixels.
 */
export function fifoSlotX(metrics: QueueMetrics, index: number, count: number): number {
  return metrics.fifoXPx + (index - (count - 1) / 2) * metrics.slotPitchPx
}

/**
 * The horizontal centre of a slot in the cup's exit row, which runs to the cup's right.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param index - Slot index from the left.
 * @returns Horizontal centre, in CSS pixels.
 */
export function lifoSlotX(metrics: QueueMetrics, index: number): number {
  return metrics.lifoXPx + metrics.halfWidthPx + metrics.rowGapPx + metrics.discRPx + index * metrics.slotPitchPx
}

/**
 * A point on a cubic curve.
 *
 * @param p0 - Start.
 * @param p1 - First control point.
 * @param p2 - Second control point.
 * @param p3 - End.
 * @param t - Position along the curve from 0 to 1.
 * @returns The point at `t`.
 */
export function cubicAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y }
}

/**
 * Where a disc leaving the tube is when it has travelled part of the way out.
 *
 * The curve drops straight through the gate and then bends sideways into the
 * slot, so a disc reads as having left through the open bottom rather than
 * through a wall.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param slotX - Horizontal centre of the slot the disc is heading for.
 * @param t - Progress along the curve from 0 to 1, usually already eased.
 * @returns The disc's centre.
 */
export function tubeExitAt(metrics: QueueMetrics, slotX: number, t: number): Point {
  const start = { x: metrics.fifoXPx, y: restY(metrics, 0) }
  // why: the first control sits almost at row height directly under the gate so the disc is well clear of the walls before it drifts sideways
  const control1 = { x: metrics.fifoXPx, y: metrics.rowYPx - 4 * metrics.scale }
  const control2 = { x: slotX, y: metrics.bottomPx + 12 * metrics.scale }
  return cubicAt(start, control1, control2, { x: slotX, y: metrics.rowYPx }, t)
}

/**
 * Where a disc carried over the cup's rim is when it has travelled part of the arc.
 *
 * The arc starts at the top of the lift, heads out over the right wall and
 * comes down into the slot from above.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param slotX - Horizontal centre of the slot the disc is heading for.
 * @param t - Progress along the arc from 0 to 1, usually already eased.
 * @returns The disc's centre.
 */
export function cupArcAt(metrics: QueueMetrics, slotX: number, t: number): Point {
  const start = { x: metrics.lifoXPx, y: metrics.apexYPx }
  // why: the first control pulls the disc outward and slightly higher so it clears the rim with room to spare, the second lines the descent up over the slot
  const control1 = { x: metrics.lifoXPx + metrics.halfWidthPx + 10 * metrics.scale, y: metrics.apexYPx - 28 * metrics.scale }
  const control2 = { x: slotX, y: metrics.apexYPx + 24 * metrics.scale }
  return cubicAt(start, control1, control2, { x: slotX, y: metrics.rowYPx }, t)
}
