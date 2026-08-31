import type { SessionContext } from './session-context'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** Result status constants returned by steps. */
export const StepStatus = freeze({
  /** Step completed normally; runner advances to the next step */
  Done: 'done',
  /** Step aborted the session (error surfaces via `error` field) */
  Cancelled: 'cancelled',
  /** Step requested a jump back to a named step */
  Goto: 'goto',
} as const)

/** Result status values returned by steps. */
export type StepStatus = (typeof StepStatus)[keyof typeof StepStatus]

/** Outcome produced by a step implementation. */
export interface StepResult {
  /** Status tag used by the runner to decide how to proceed */
  readonly status: StepStatus

  /** Target step id when `status === 'goto'` */
  readonly gotoStepId?: string

  /** Error attached when `status === 'cancelled'` */
  readonly error?: Error
}

/** A named step in an authoring session. */
export interface Step {
  /** Stable identifier used by `goto` and for debugging */
  readonly id: string

  /** Runs the step against the session context; may mutate `ctx.draft` */
  run(ctx: SessionContext): Promise<StepResult>
}

/**
 * Helper for building a `done` result.
 *
 * @returns Step result that advances the runner to the next step
 *
 * @example Returning done from a step
 * ```typescript
 * async run(): Promise<StepResult> { return done() }
 * ```
 */
export function done(): StepResult {
  return { status: StepStatus.Done }
}

/**
 * Helper for building a `cancelled` result with an optional error.
 *
 * @param error - Cause of cancellation attached to the result (omit when the user aborted cleanly)
 * @returns Step result that stops the session
 *
 * @example Cancelling after an executor throws
 * ```typescript
 * try { await executor() } catch (err) { return cancelled(err as Error) }
 * ```
 */
export function cancelled(error?: Error): StepResult {
  return error ? { status: StepStatus.Cancelled, error } : { status: StepStatus.Cancelled }
}

/**
 * Helper for building a `goto` result pointing at the supplied step id.
 *
 * @param stepId - Target step id the runner should jump to
 * @returns Step result that redirects the runner to the named step
 *
 * @example Sending the runner back to the `type` step
 * ```typescript
 * return goto('type')
 * ```
 */
export function goto(stepId: string): StepResult {
  return { status: StepStatus.Goto, gotoStepId: stepId }
}
