import type { MediaProfile } from '../models/profile'
import type { ChapterFrame, RailPosition, SequenceConfig, SequencePlacement } from '../models/sequence'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** How long a move between chapters takes when the scene names nothing. */
export const DEFAULT_TRANSITION_MS = 520

/** How far, as a fraction of the frame, the outgoing chapter is pushed while it leaves. */
const EXIT_SHIFT = 0.18

/**
 * How long a move between chapters takes for this sequence.
 *
 * @param config - The sequence as the scene configured it.
 * @returns The transition length in milliseconds.
 */
export function transitionOf(config: SequenceConfig): number {
  return config.transitionMs ?? DEFAULT_TRANSITION_MS
}

/**
 * Lay the chapters out along one timeline.
 *
 * Each chapter runs for its own duration, rests for its hold, and is followed
 * by one transition unless it is the last. The layout is decided entirely by
 * the scene's numbers, so the same configuration places its chapters the same
 * way on every run.
 *
 * @param config - The sequence as the scene configured it.
 * @param profile - The profile the chapters are composed against.
 * @returns Each chapter with its place on the timeline, in order.
 * @throws {Error} When there are no chapters, or a timing is negative.
 * @example Two chapters of a second each, a 500ms move between them
 * ```ts
 * placeSegments({ segments: [a, b], transitionMs: 500 }, profile)
 * // [{ startMs: 0, endMs: 1000 }, { startMs: 1500, endMs: 2500 }]
 * ```
 */
export function placeSegments(config: SequenceConfig, profile: MediaProfile): readonly SequencePlacement[] {
  if (config.segments.length === 0) {
    throw createError('A sequence needs at least one chapter')
  }
  const transitionMs = transitionOf(config)
  if (transitionMs < 0) {
    throw createError(`A sequence's transition cannot be negative (got ${transitionMs}ms)`)
  }
  const placements: SequencePlacement[] = []
  let cursor = 0
  config.segments.forEach((segment, index) => {
    const holdMs = segment.holdMs ?? 0
    if (holdMs < 0) {
      throw createError(`Chapter "${segment.label}" cannot hold for a negative time (got ${holdMs}ms)`)
    }
    const durationMs = segment.durationMs(profile)
    if (durationMs < 0) {
      throw createError(`Chapter "${segment.label}" reports a negative duration (${durationMs}ms)`)
    }
    const endMs = cursor + durationMs + holdMs
    placements.push({ segment, startMs: cursor, durationMs, endMs })
    cursor = endMs + (index === config.segments.length - 1 ? 0 : transitionMs)
  })
  return placements
}

/**
 * Ease a linear progress so a move starts and ends gently.
 *
 * @param t - Linear progress from 0 to 1.
 * @returns Eased progress from 0 to 1.
 */
function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
}

/**
 * Which chapters are drawn at one instant, and how.
 *
 * Inside a chapter, that chapter alone, at its own offset. Between two, the
 * outgoing chapter holds its last frame while it leaves and the incoming one
 * arrives already at its first, so the move is between two settled pictures
 * rather than two things still happening. Past the last chapter's end it
 * stays, clamped to its final frame, for as long as the scene holds.
 *
 * @param placements - The chapters on the timeline, from {@link placeSegments}.
 * @param transitionMs - How long a move between chapters takes.
 * @param atMs - Offset from the start of the sequence.
 * @returns The chapters to draw, in the order they are stacked.
 */
export function chaptersAt(placements: readonly SequencePlacement[], transitionMs: number, atMs: number): readonly ChapterFrame[] {
  const frames: ChapterFrame[] = []
  placements.forEach((placement, index) => {
    const next = placements[index + 1]
    if (atMs < placement.startMs) {
      return
    }
    if (atMs < placement.endMs || next === undefined) {
      frames.push({ index, segment: placement.segment, localMs: min(atMs - placement.startMs, placement.durationMs), shift: 0, opacity: 1 })
      return
    }
    if (atMs < next.startMs) {
      const t = ease(min(1, (atMs - placement.endMs) / max(1, transitionMs)))
      frames.push({ index, segment: placement.segment, localMs: placement.durationMs, shift: -EXIT_SHIFT * t, opacity: 1 - t })
      frames.push({ index: index + 1, segment: next.segment, localMs: 0, shift: 1 - t, opacity: t })
    }
  })
  return frames
}

/**
 * Which chapter the rail points at, and how far through it the sequence is.
 *
 * @param placements - The chapters on the timeline.
 * @param atMs - Offset from the start of the sequence.
 * @returns The running chapter's index and its progress from 0 to 1.
 */
export function railPosition(placements: readonly SequencePlacement[], atMs: number): RailPosition {
  const current = placements.reduce((found, placement, index) => (atMs >= placement.startMs ? index : found), 0)
  const running = placements[current]
  const progress = running === undefined ? 0 : min(1, max(0, (atMs - running.startMs) / max(1, running.endMs - running.startMs)))
  return { current, progress }
}
