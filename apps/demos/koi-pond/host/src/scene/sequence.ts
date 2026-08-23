/**
 * Tracking a disturbance from the strike to the last koi settling.
 *
 * A sequence opens when the water is struck and closes when every koi that was
 * asked to react has reported itself back to an ambient cruise. Only then does
 * the pond tell the gallery the scene has unwound — which, in the expanded
 * dialog, is the cue to collapse it back to its card.
 *
 * A koi that never answers must not hold the sequence open forever, so the
 * tracker also closes on a deadline. Standalone and in-card the completion is
 * simply ignored, and the shoal loops on.
 */
import type { KoiInstanceId } from './instance-id'

/** Longest a sequence stays open waiting for the last koi to settle, in milliseconds. */
export const SEQUENCE_DEADLINE_MS = 14_000

/** One disturbance, from the strike to the last koi settling. */
export interface SequenceTracker {
  /**
   * Opens a sequence over the koi that were told about a strike.
   *
   * @param participants - The koi the disturbance was sent to.
   * @param now - Host clock reading.
   */
  begin(participants: readonly KoiInstanceId[], now: number): void
  /**
   * Records that a koi resumed an ambient cruise.
   *
   * @param id - Which koi settled.
   * @param now - Host clock reading.
   * @returns How many koi took part, once the sequence has fully unwound; `null` while it is still running or when none is open.
   */
  settle(id: KoiInstanceId, now: number): number | null
  /**
   * Closes a sequence whose last koi never answered.
   *
   * @param now - Host clock reading.
   * @returns How many koi took part, when the deadline just expired; `null` otherwise.
   */
  expire(now: number): number | null
  /** Whether a sequence is currently open. */
  readonly isRunning: boolean
}

/**
 * Creates the disturbance-sequence tracker.
 *
 * @returns The tracker.
 *
 * @example Reporting a completed scatter to the gallery
 * ```typescript
 * const fish = sequence.settle(session.id, Date.now())
 * if (fish !== null) {
 *   reporter.sequenceComplete(fish)
 * }
 * ```
 */
export function createSequenceTracker(): SequenceTracker {
  let pending = new Set<KoiInstanceId>()
  let participants = 0
  let openedAt = 0

  /**
   * Closes the open sequence.
   *
   * @returns How many koi took part.
   */
  const close = (): number => {
    const took = participants
    pending = new Set()
    participants = 0
    openedAt = 0
    return took
  }

  return {
    begin(next, now) {
      // why: A second strike mid-scatter restarts the sequence rather than nesting one inside another; the visitor's latest disturbance is the one being watched.
      pending = new Set(next)
      participants = next.length
      openedAt = now
    },

    settle(id, now) {
      if (participants === 0) {
        return null
      }
      pending.delete(id)
      if (pending.size > 0 && now - openedAt < SEQUENCE_DEADLINE_MS) {
        return null
      }
      return close()
    },

    expire(now) {
      if (participants === 0 || now - openedAt < SEQUENCE_DEADLINE_MS) {
        return null
      }
      return close()
    },

    get isRunning() {
      return participants > 0
    },
  }
}
