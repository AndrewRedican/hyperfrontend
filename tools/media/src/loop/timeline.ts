import type { Point } from '../stage/geometry'
import type { LoopLayout } from './layout'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { clamp01, easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { alongPath } from './layout'

/** When each beat of the loop begins, in milliseconds. */
export const BEATS = {
  /** The change leaves the definition. */
  leaveDefine: 800,
  /** It reaches the model. */
  reachPropose: 1900,
  /** The model's candidates emerge. */
  emerge: 2800,
  /** They set off for the rails. */
  leavePropose: 3100,
  /** They enter the rails. */
  enterRails: 3900,
  /** The survivor leaves the rails. */
  exitRails: 6300,
  /** It reaches the review. */
  reachReview: 7400,
  /** The accepted change and the new rail leave the review. */
  leaveReview: 8300,
  /** The accepted change reaches the definition again. */
  reachDefine: 9700,
  /** The new rail reaches the rails. */
  reachRails: 10000,
  /** The new rail is in place. */
  railFilled: 10600,
  /** The loop is complete. */
  end: 11400,
} as const

/** How many candidates the model produces. */
export const CANDIDATES = 3

/** Sideways offset of each candidate's column through the rails. */
const COLUMN_OFFSETS: readonly number[] = [-22, 0, 22]

/** Which rail each candidate fails at, or -1 for the one that passes them all. */
const FAILS_AT: readonly number[] = [0, -1, 2]

/** How long a failed candidate takes to dim once it has stopped. */
const DIM_MS = 400

/** How dim a failed candidate stays while the survivor goes on. */
const DIMMED = 0.45

/** How long a failed candidate takes to fade once the survivor has left the rails. */
const FADE_MS = 500

/** How far below the model's card its candidates appear. */
const EMERGE_DROP = 12

/** How long the change takes to appear at a socket. */
const APPEAR_MS = 300

/** The shape a token is drawn as. */
export type TokenShape = 'circle' | 'square' | 'diamond'

/** A token somewhere on the loop. */
export interface TokenState {
  /** Where it is. */
  at: Point
  /** How large it is drawn, 1 being full size. */
  scale: number
  /** How opaque it is drawn. */
  opacity: number
  /** Which shape it is. */
  shape: TokenShape
  /** The colour its state gives it. */
  tone: 'accent' | 'success' | 'danger'
  /** Whether a failure badge is drawn beside it. */
  failed: boolean
}

/** A pass shown at a rail's indicator. */
export interface RailMark {
  /** Which rail. */
  rail: number
  /** How strongly the indicator is lit, brightest as the survivor passes. */
  strength: number
}

/** Everything drawn at one instant. */
export interface LoopState {
  /** The tokens in flight or docked. */
  tokens: readonly TokenState[]
  /** How lit the definition card is. */
  defineLit: number
  /** How lit the model's card is. */
  proposeLit: number
  /** How lit the review card is. */
  reviewLit: number
  /** How lit the rails are, for the flash when a rail is added. */
  railsLit: number
  /** The verdicts shown on the rails. */
  marks: readonly RailMark[]
  /** The new rail travelling back, or undefined when it is not in flight. */
  chip: TokenState | undefined
  /** How far the next rail has filled in, 0 for a dashed outline and 1 for a rail. */
  nextRail: number
}

/** The shapes the candidates take, column by column. */
const SHAPES: readonly TokenShape[] = ['circle', 'square', 'diamond']

/**
 * When a candidate reaches a rail on its way down.
 *
 * @param layout - Where everything sits.
 * @param rail - Which rail.
 * @returns The moment.
 */
function railReachedAt(layout: LoopLayout, rail: number): number {
  const y = layout.railYs[rail] ?? layout.bottomY
  const t = (y - layout.rails.y) / (layout.bottomY - layout.rails.y)
  return BEATS.enterRails + t * (BEATS.exitRails - BEATS.enterRails)
}

/**
 * Where one candidate is and how it looks, while it is between the model
 * and the review.
 *
 * @param column - Which candidate.
 * @param layout - Where everything sits.
 * @param atMs - Offset from the start of the timeline.
 * @returns The token, or undefined when it is not on the frame.
 */
function candidateAt(column: number, layout: LoopLayout, atMs: number): TokenState | undefined {
  const offset = COLUMN_OFFSETS[column] ?? 0
  const shape = SHAPES[column] ?? 'square'
  const socket = { x: layout.rightX + offset, y: layout.propose.y + layout.propose.h + EMERGE_DROP }
  if (atMs < BEATS.emerge) {
    return undefined
  }
  if (atMs < BEATS.leavePropose) {
    return { at: socket, scale: easeOut(progress(atMs, BEATS.emerge, APPEAR_MS)), opacity: 1, shape, tone: 'accent', failed: false }
  }
  if (atMs < BEATS.enterRails) {
    const t = easeInOut(progress(atMs, BEATS.leavePropose, BEATS.enterRails - BEATS.leavePropose))
    return { at: { x: socket.x, y: lerp(socket.y, layout.rails.y, t) }, scale: 1, opacity: 1, shape, tone: 'accent', failed: false }
  }
  const failsAt = FAILS_AT[column] ?? -1
  const failedAt = failsAt === -1 ? undefined : railReachedAt(layout, failsAt)
  if (failedAt !== undefined && atMs >= failedAt) {
    // why: a failed candidate stays where it stopped, dimmed, until the survivor has left the rails, so the frame that matters shows every verdict at once
    const dimmed = lerp(1, DIMMED, easeOut(progress(atMs, failedAt, DIM_MS)))
    const gone = progress(atMs, BEATS.exitRails, FADE_MS)
    return {
      at: { x: socket.x, y: layout.railYs[failsAt] ?? layout.bottomY },
      scale: 1,
      opacity: dimmed * (1 - gone),
      shape,
      tone: 'danger',
      failed: true,
    }
  }
  if (atMs < BEATS.exitRails) {
    const t = progress(atMs, BEATS.enterRails, BEATS.exitRails - BEATS.enterRails)
    const flash = layout.railYs.reduce((strongest, _, rail) => max(strongest, pulse(atMs, railReachedAt(layout, rail), 450)), 0)
    return {
      at: { x: socket.x, y: lerp(layout.rails.y, layout.bottomY, t) },
      scale: 1,
      opacity: 1,
      shape,
      tone: flash > 0.5 ? 'success' : 'accent',
      failed: false,
    }
  }
  if (atMs < BEATS.reachReview) {
    const t = easeInOut(progress(atMs, BEATS.exitRails, BEATS.reachReview - BEATS.exitRails))
    return {
      at: { x: lerp(layout.rightX, layout.review.x + layout.review.w, t), y: layout.bottomY },
      scale: 1,
      opacity: 1,
      shape,
      tone: 'accent',
      failed: false,
    }
  }
  return undefined
}

/**
 * Where the change is while the human has it: docked at the definition, on
 * its way to the model, or on its way back up from the review.
 *
 * @param layout - Where everything sits.
 * @param atMs - Offset from the start of the timeline.
 * @returns The token, or undefined when it is inside a card.
 */
function changeAt(layout: LoopLayout, atMs: number): TokenState | undefined {
  const defineSocket = { x: layout.define.x + layout.define.w, y: layout.topY }
  if (atMs < BEATS.leaveDefine) {
    return { at: defineSocket, scale: easeOut(progress(atMs, 0, APPEAR_MS)), opacity: 1, shape: 'square', tone: 'accent', failed: false }
  }
  if (atMs < BEATS.reachPropose) {
    const t = easeInOut(progress(atMs, BEATS.leaveDefine, BEATS.reachPropose - BEATS.leaveDefine))
    return {
      at: { x: lerp(defineSocket.x, layout.propose.x, t), y: layout.topY },
      scale: 1,
      opacity: 1,
      shape: 'square',
      tone: 'accent',
      failed: false,
    }
  }
  if (atMs >= BEATS.leaveReview && atMs < BEATS.reachDefine) {
    const t = easeInOut(progress(atMs, BEATS.leaveReview, BEATS.reachDefine - BEATS.leaveReview))
    const appear = easeOut(progress(atMs, BEATS.leaveReview, APPEAR_MS))
    return {
      at: { x: layout.leftX, y: lerp(layout.review.y, layout.define.y + layout.define.h, t) },
      scale: appear,
      opacity: 1,
      shape: 'square',
      tone: 'success',
      failed: false,
    }
  }
  return undefined
}

/**
 * Where the new rail is on its way back from the review to the rails.
 *
 * @param layout - Where everything sits.
 * @param atMs - Offset from the start of the timeline.
 * @returns The chip, or undefined when it is not in flight.
 */
function chipAt(layout: LoopLayout, atMs: number): TokenState | undefined {
  if (atMs < BEATS.leaveReview || atMs >= BEATS.reachRails) {
    return undefined
  }
  const corners: readonly Point[] = [
    { x: layout.leftX, y: layout.review.y + layout.review.h },
    { x: layout.leftX, y: layout.returnY },
    { x: layout.rightX, y: layout.returnY },
    { x: layout.rightX, y: layout.rails.y + layout.rails.h },
  ]
  const t = easeInOut(progress(atMs, BEATS.leaveReview, BEATS.reachRails - BEATS.leaveReview))
  return {
    at: alongPath(corners, t),
    scale: easeOut(progress(atMs, BEATS.leaveReview, APPEAR_MS)),
    opacity: 1,
    shape: 'square',
    tone: 'success',
    failed: false,
  }
}

/**
 * The verdicts the rails are showing.
 *
 * A rail's indicator is the survivor's: it lights the moment the survivor
 * passes, which is the same moment any other candidate stops there. The
 * failures are shown on the candidates themselves, beside where they stopped.
 *
 * @param layout - Where everything sits.
 * @param atMs - Offset from the start of the timeline.
 * @returns One mark per rail passed so far, the most recent strongest.
 */
function marksAt(layout: LoopLayout, atMs: number): readonly RailMark[] {
  const marks: RailMark[] = []
  for (let rail = 0; rail < layout.railYs.length - 1; rail += 1) {
    const reached = railReachedAt(layout, rail)
    if (atMs >= reached) {
      marks.push({ rail, strength: 0.55 + 0.45 * pulse(atMs, reached, 900) })
    }
  }
  return marks
}

/**
 * Work out everything drawn at one instant.
 *
 * Nothing is remembered between frames: every position and every glow is
 * read out of the beats and the moment asked for.
 *
 * @param layout - Where everything sits.
 * @param atMs - Offset from the start of the timeline.
 * @returns The state to draw.
 */
export function loopStateAt(layout: LoopLayout, atMs: number): LoopState {
  const tokens: TokenState[] = []
  const change = changeAt(layout, atMs)
  if (change !== undefined) {
    tokens.push(change)
  }
  for (let column = 0; column < CANDIDATES; column += 1) {
    const candidate = candidateAt(column, layout, atMs)
    if (candidate !== undefined) {
      tokens.push(candidate)
    }
  }
  const defineLit = max(1 - progress(atMs, BEATS.leaveDefine, 500), easeOut(progress(atMs, BEATS.reachDefine, 400)))
  const proposeLit = clamp01(easeOut(progress(atMs, BEATS.reachPropose, 400)) - progress(atMs, BEATS.leavePropose, 600))
  const reviewLit = clamp01(easeOut(progress(atMs, BEATS.reachReview, 400)) - progress(atMs, BEATS.leaveReview + 300, 600))
  return {
    tokens,
    defineLit,
    proposeLit,
    reviewLit,
    railsLit: pulse(atMs, BEATS.reachRails, 900),
    marks: marksAt(layout, atMs),
    chip: chipAt(layout, atMs),
    nextRail: easeOut(progress(atMs, BEATS.reachRails, BEATS.railFilled - BEATS.reachRails)),
  }
}
