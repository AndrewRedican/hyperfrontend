import type { State } from '../models'

/**
 * Creates the initial state for the state machine.
 *
 * @returns Initial state with all flags set to false
 *
 * @example
 * ```typescript
 * const state = createInitialState()
 * // => { inProgress: false, success: false, fail: false, halt: false }
 * ```
 */
export const createInitialState = (): State => ({
  inProgress: false,
  success: false,
  fail: false,
  halt: false,
})
