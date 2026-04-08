import type { StateStatusDeriver, StateDeriver } from '../models'

/**
 * Selector that checks if operation has not started.
 *
 * @param state - The state object to check
 * @returns True if operation has not started
 */
export const notStarted: StateStatusDeriver = (state) => !state.inProgress && !state.success && !state.fail

/**
 * Selector that checks if operation is in progress.
 *
 * @param state - The state object to check
 * @returns True if operation is in progress
 */
export const inProgress: StateStatusDeriver = (state) => state.inProgress

/**
 * Selector that checks if operation is done (success or fail).
 *
 * @param state - The state object to check
 * @returns True if operation is done
 */
export const done: StateStatusDeriver = (state) => !state.inProgress && (state.success || state.fail)

/**
 * Selector that checks if operation completed successfully.
 *
 * @param state - The state object to check
 * @returns True if operation completed successfully
 */
export const successful: StateStatusDeriver = (state) => !state.inProgress && state.success && !state.fail

/**
 * Selector that checks if operation failed.
 *
 * @param state - The state object to check
 * @returns True if operation failed
 */
export const failed: StateStatusDeriver = (state) => !state.inProgress && !state.success && state.fail

/**
 * Selector that checks if operation is retrying after failure.
 *
 * @param state - The state object to check
 * @returns True if operation is retrying
 */
export const retrying: StateStatusDeriver = (state) => state.inProgress && !state.success && state.fail

/**
 * Selector that checks if operation is restarting after success.
 *
 * @param state - The state object to check
 * @returns True if operation is restarting
 */
export const restarting: StateStatusDeriver = (state) => state.inProgress && state.success && !state.fail

/**
 * Selector that checks if operation is halted.
 *
 * @param state - The state object to check
 * @returns True if operation is halted
 */
export const halted: StateStatusDeriver = (state) => state.halt

/**
 * Selector that checks if operation is paused.
 *
 * @param state - The state object to check
 * @returns True if operation is paused
 */
export const paused: StateStatusDeriver = (state) => state.inProgress && state.halt

/**
 * Selector that checks if operation was cancelled.
 *
 * @param state - The state object to check
 * @returns True if operation was cancelled
 */
export const cancelled: StateStatusDeriver = (state) => !state.inProgress && state.halt && !state.success && !state.fail

/**
 * Derives a complete state object from the base state.
 *
 * @param state - The base state to derive from
 * @returns Object with all derived state properties
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
