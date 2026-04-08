import type { StateStatusDeriver, StateDeriver } from '../models'

/**
 * Selector that checks if operation has not started.
 *
 * @param state - The state object to check
 * @returns True if operation has not started
 *
 * @example
 * ```typescript
 * notStarted({ inProgress: false, success: false, fail: false, halt: false })
 * // => true
 * ```
 */
export const notStarted: StateStatusDeriver = (state) => !state.inProgress && !state.success && !state.fail

/**
 * Selector that checks if operation is in progress.
 *
 * @param state - The state object to check
 * @returns True if operation is in progress
 *
 * @example
 * ```typescript
 * inProgress({ inProgress: true, success: false, fail: false, halt: false })
 * // => true
 * ```
 */
export const inProgress: StateStatusDeriver = (state) => state.inProgress

/**
 * Selector that checks if operation is done (success or fail).
 *
 * @param state - The state object to check
 * @returns True if operation is done
 *
 * @example
 * ```typescript
 * done({ inProgress: false, success: true, fail: false, halt: false })
 * // => true
 * ```
 */
export const done: StateStatusDeriver = (state) => !state.inProgress && (state.success || state.fail)

/**
 * Selector that checks if operation completed successfully.
 *
 * @param state - The state object to check
 * @returns True if operation completed successfully
 *
 * @example
 * ```typescript
 * successful({ inProgress: false, success: true, fail: false, halt: false })
 * // => true
 * ```
 */
export const successful: StateStatusDeriver = (state) => !state.inProgress && state.success && !state.fail

/**
 * Selector that checks if operation failed.
 *
 * @param state - The state object to check
 * @returns True if operation failed
 *
 * @example
 * ```typescript
 * failed({ inProgress: false, success: false, fail: true, halt: false })
 * // => true
 * ```
 */
export const failed: StateStatusDeriver = (state) => !state.inProgress && !state.success && state.fail

/**
 * Selector that checks if operation is retrying after failure.
 *
 * @param state - The state object to check
 * @returns True if operation is retrying
 *
 * @example
 * ```typescript
 * retrying({ inProgress: true, success: false, fail: true, halt: false })
 * // => true
 * ```
 */
export const retrying: StateStatusDeriver = (state) => state.inProgress && !state.success && state.fail

/**
 * Selector that checks if operation is restarting after success.
 *
 * @param state - The state object to check
 * @returns True if operation is restarting
 *
 * @example
 * ```typescript
 * restarting({ inProgress: true, success: true, fail: false, halt: false })
 * // => true
 * ```
 */
export const restarting: StateStatusDeriver = (state) => state.inProgress && state.success && !state.fail

/**
 * Selector that checks if operation is halted.
 *
 * @param state - The state object to check
 * @returns True if operation is halted
 *
 * @example
 * ```typescript
 * halted({ inProgress: false, success: false, fail: false, halt: true })
 * // => true
 * ```
 */
export const halted: StateStatusDeriver = (state) => state.halt

/**
 * Selector that checks if operation is paused.
 *
 * @param state - The state object to check
 * @returns True if operation is paused
 *
 * @example
 * ```typescript
 * paused({ inProgress: true, success: false, fail: false, halt: true })
 * // => true
 * ```
 */
export const paused: StateStatusDeriver = (state) => state.inProgress && state.halt

/**
 * Selector that checks if operation was cancelled.
 *
 * @param state - The state object to check
 * @returns True if operation was cancelled
 *
 * @example
 * ```typescript
 * cancelled({ inProgress: false, success: false, fail: false, halt: true })
 * // => true
 * ```
 */
export const cancelled: StateStatusDeriver = (state) => !state.inProgress && state.halt && !state.success && !state.fail

/**
 * Derives a complete state object from the base state.
 *
 * @param state - The base state to derive from
 * @returns Object with all derived state properties
 *
 * @example
 * ```typescript
 * const state = { inProgress: true, success: false, fail: false, halt: false }
 * derivedState(state)
 * // => { notStarted: false, inProgress: true, done: false, ... }
 * ```
 */
export const derivedState: StateDeriver = (state) => ({
  notStarted: notStarted(state),
  inProgress: inProgress(state),
  done: done(state),
  successful: successful(state),
  failed: failed(state),
  retrying: retrying(state),
  restarting: restarting(state),
  halted: halted(state),
  paused: paused(state),
  cancelled: cancelled(state),
})
