import type { QueueConfig } from '../models/queue'
import type { Point, QueueMetrics } from './layout'
import { max, PI, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeIn, easeInOut, easeOut, lerp, progress } from '../lib/motion'
import { cupArcAt, fifoSlotX, lifoSlotX, restY, tubeExitAt } from './layout'

/** How long a pushed disc takes to fade in where it appears, before it moves. */
export const APPEAR_MS = 250

/** How long a pushed disc takes to swing from where it appeared to over the mouth. */
const SWING_MS = 320

/** How long a pushed disc takes to fall from the mouth to its place in the stack. */
export const DROP_MS = 500

/** How long a disc bounces once it lands. */
export const BOUNCE_MS = 120

/** How high a landing disc bounces, before scaling. */
const BOUNCE_PX = 5

/** How long a disc takes to leave the tube through its gate and reach its slot. */
export const TUBE_EXIT_MS = 800

/** How long a disc takes to lift out of the cup and come down in its slot. */
export const CUP_EXIT_MS = 1000

/** The share of a cup exit spent lifting straight up, before the arc over the rim. */
const LIFT_SHARE = 0.3

/** How long after a pull the discs left in the tube wait before settling down a place. */
const SETTLE_DELAY_MS = 200

/** How long the discs left in the tube take to settle down a place. */
const SETTLE_MS = 300

/** How long a label or the gate takes to fade in or out. */
const FADE_MS = 160

/** How long after the last disc settles the completed rows are marked. */
const BAND_DELAY_MS = 150

/** How long the band round a completed row takes to appear. */
const BAND_MS = 400

/** A position with a visibility, for a disc part way through appearing. */
interface Placement extends Point {
  /** How visible the disc is. */
  opacity: number
}

/** Where one disc is drawn at one instant. */
export interface DiscPose {
  /** Horizontal centre. */
  x: number
  /** Vertical centre. */
  y: number
  /** How visible the disc is; 0 for a disc that has not been pushed yet. */
  opacity: number
  /** The number on the disc's face. */
  face: string
}

/** Everything the frame draws at one instant. */
export interface QueueState {
  /** The tube's discs, in the order they were pushed. */
  fifo: readonly DiscPose[]
  /** The cup's discs, in the order they were pushed. */
  lifo: readonly DiscPose[]
  /** How visible the push labels are. */
  pushLabel: number
  /** How visible the tube's pull label is. */
  tubePullLabel: number
  /** How visible the cup's pull label is. */
  cupPullLabel: number
  /** How much of the tube's gate is drawn; 0 while a disc is passing through it. */
  gate: number
  /** How visible the bands round the completed rows are. */
  band: number
}

/**
 * When the last disc has come to rest.
 *
 * @param config - The lists as the scene configured them.
 * @returns The offset at which nothing is moving any more.
 */
export function settledAt(config: QueueConfig): number {
  let latest = 0
  for (const pushAt of config.pushAtMs) {
    latest = max(latest, pushAt + DROP_MS + BOUNCE_MS)
  }
  for (const pullAt of config.pullAtMs) {
    latest = max(latest, pullAt + CUP_EXIT_MS)
  }
  return latest
}

/**
 * When the completed rows have been marked and the frame can rest.
 *
 * @param config - The lists as the scene configured them.
 * @returns The offset at which the picture is fully resolved.
 */
export function resolvedAt(config: QueueConfig): number {
  return settledAt(config) + BAND_DELAY_MS + BAND_MS
}

/**
 * A visibility that fades in at one moment and out at another.
 *
 * @param atMs - The moment being drawn.
 * @param fromMs - When the fade in starts.
 * @param toMs - When the fade out starts.
 * @returns Visibility from 0 to 1.
 */
function fadeWindow(atMs: number, fromMs: number, toMs: number): number {
  return easeOut(progress(atMs, fromMs, FADE_MS)) * (1 - easeIn(progress(atMs, toMs, FADE_MS)))
}

/**
 * The strongest of several fade windows, one per moment in a list.
 *
 * @param atMs - The moment being drawn.
 * @param moments - When each window opens.
 * @param leadMs - How long before each moment its window opens.
 * @param lengthMs - How long after each moment its window starts to close.
 * @returns Visibility from 0 to 1.
 */
function strongestWindow(atMs: number, moments: readonly number[], leadMs: number, lengthMs: number): number {
  return moments.reduce((strongest, moment) => max(strongest, fadeWindow(atMs, moment - leadMs, moment + lengthMs)), 0)
}

/**
 * Where a disc being pushed is, from the moment it appears to the end of its bounce.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param centreX - Horizontal centre of the container it is pushed into.
 * @param landingY - Vertical centre of the place it lands in.
 * @param pushAt - When the push happens.
 * @param atMs - The moment being drawn.
 * @returns The disc's centre and visibility.
 */
function pushPose(metrics: QueueMetrics, centreX: number, landingY: number, pushAt: number, atMs: number): Placement {
  const stageX = centreX - metrics.stageDxPx
  if (atMs < pushAt) {
    return { x: stageX, y: metrics.stageYPx, opacity: easeOut(progress(atMs, pushAt - APPEAR_MS, APPEAR_MS)) }
  }
  const x = lerp(stageX, centreX, easeOut(progress(atMs, pushAt, SWING_MS)))
  const bounce = progress(atMs, pushAt + DROP_MS, BOUNCE_MS)
  const y = lerp(metrics.stageYPx, landingY, easeIn(progress(atMs, pushAt, DROP_MS))) - BOUNCE_PX * metrics.scale * sin(PI * bounce)
  return { x, y, opacity: 1 }
}

/**
 * How many places below its pushed position a tube disc has settled by one instant.
 *
 * Every pull that took a disc below this one lets it drop one place, a little
 * after the pulled disc has gone.
 *
 * @param config - The lists as the scene configured them.
 * @param index - The disc, in push order.
 * @param atMs - The moment being drawn.
 * @returns Places dropped, fractional while a settle is under way.
 */
function tubeDrop(config: QueueConfig, index: number, atMs: number): number {
  return config.pullAtMs
    .slice(0, index)
    .reduce((dropped, pullAt) => dropped + easeInOut(progress(atMs, pullAt + SETTLE_DELAY_MS, SETTLE_MS)), 0)
}

/**
 * Where one of the tube's discs is at one instant.
 *
 * The tube gives discs back in the order they went in, so the disc pushed
 * first is the one the first pull takes, from the bottom of the stack.
 *
 * @param config - The lists as the scene configured them.
 * @param metrics - The measurements this profile is drawn at.
 * @param index - The disc, in push order.
 * @param atMs - The moment being drawn.
 * @returns The disc's pose.
 */
function tubeDisc(config: QueueConfig, metrics: QueueMetrics, index: number, atMs: number): DiscPose {
  const face = `${index + 1}`
  const pushAt = config.pushAtMs[index] ?? 0
  const pullAt = config.pullAtMs[index]
  if (pullAt !== undefined && atMs >= pullAt) {
    const slotX = fifoSlotX(metrics, index, config.pullAtMs.length)
    const point = tubeExitAt(metrics, slotX, easeInOut(progress(atMs, pullAt, TUBE_EXIT_MS)))
    return { ...point, opacity: 1, face }
  }
  if (atMs < pushAt + DROP_MS + BOUNCE_MS) {
    return { ...pushPose(metrics, metrics.fifoXPx, restY(metrics, index), pushAt, atMs), face }
  }
  return { x: metrics.fifoXPx, y: restY(metrics, index - tubeDrop(config, index, atMs)), opacity: 1, face }
}

/**
 * Where one of the cup's discs is at one instant.
 *
 * The cup gives discs back newest first, so the disc pushed last is the one
 * the first pull lifts, from the top of the stack; the discs under it never
 * move.
 *
 * @param config - The lists as the scene configured them.
 * @param metrics - The measurements this profile is drawn at.
 * @param index - The disc, in push order.
 * @param atMs - The moment being drawn.
 * @returns The disc's pose.
 */
function cupDisc(config: QueueConfig, metrics: QueueMetrics, index: number, atMs: number): DiscPose {
  const face = `${index + 1}`
  const pushAt = config.pushAtMs[index] ?? 0
  const pull = config.pushAtMs.length - 1 - index
  const pullAt = config.pullAtMs[pull]
  if (pullAt !== undefined && atMs >= pullAt) {
    const t = progress(atMs, pullAt, CUP_EXIT_MS)
    if (t < LIFT_SHARE) {
      return { x: metrics.lifoXPx, y: lerp(restY(metrics, index), metrics.apexYPx, easeOut(t / LIFT_SHARE)), opacity: 1, face }
    }
    const point = cupArcAt(metrics, lifoSlotX(metrics, pull), easeInOut((t - LIFT_SHARE) / (1 - LIFT_SHARE)))
    return { ...point, opacity: 1, face }
  }
  if (atMs < pushAt + DROP_MS + BOUNCE_MS) {
    return { ...pushPose(metrics, metrics.lifoXPx, restY(metrics, index), pushAt, atMs), face }
  }
  return { x: metrics.lifoXPx, y: restY(metrics, index), opacity: 1, face }
}

/**
 * Work out everything the frame draws at one instant.
 *
 * Nothing is remembered between frames: every disc's place is read out of the
 * push and pull moments and the moment asked for, which is what lets the same
 * scene record identically anywhere.
 *
 * @param config - The lists as the scene configured them.
 * @param metrics - The measurements this profile is drawn at.
 * @param atMs - The moment being drawn.
 * @returns The state to draw.
 */
export function queueState(config: QueueConfig, metrics: QueueMetrics, atMs: number): QueueState {
  const indices = config.pushAtMs.map((_, index) => index)
  return {
    fifo: indices.map((index) => tubeDisc(config, metrics, index, atMs)),
    lifo: indices.map((index) => cupDisc(config, metrics, index, atMs)),
    pushLabel: strongestWindow(atMs, config.pushAtMs, APPEAR_MS, DROP_MS),
    tubePullLabel: strongestWindow(atMs, config.pullAtMs, FADE_MS, TUBE_EXIT_MS),
    cupPullLabel: strongestWindow(atMs, config.pullAtMs, FADE_MS, CUP_EXIT_MS),
    // why: the gate is out of the way from just before a pull until the disc is clear of it, so the disc is never drawn through a closed gate
    gate: 1 - strongestWindow(atMs, config.pullAtMs, FADE_MS, TUBE_EXIT_MS * 0.55),
    band: easeOut(progress(atMs, settledAt(config) + BAND_DELAY_MS, BAND_MS)),
  }
}
