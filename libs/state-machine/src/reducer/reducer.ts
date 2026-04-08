import type { Action, State, Handlers } from '../models'
import { START, PAUSE, CANCEL, SUCCESS, FAIL } from '../actions/actions.types'
import { createInitialState } from '../state/state'

const handlers: Handlers = {
  [START]: (state) => ({ ...state, inProgress: true }),
  [PAUSE]: (state) => ({ ...state, inProgress: true, halt: true }),
  [CANCEL]: (state) => ({
    ...state,
    inProgress: false,
    halt: true,
  }),
  [SUCCESS]: (state) => ({
    ...state,
    inProgress: false,
    success: true,
    fail: false,
    halt: false,
  }),
  [FAIL]: (state) => ({
    ...state,
    inProgress: false,
    success: false,
    fail: true,
    halt: false,
  }),
}

/**
 * Root reducer that handles state transitions based on action types.
 *
 * @param state - Current state or undefined for initial state
 * @param action - Action to process
 * @returns Updated state after applying the action
 *
 * @example
 * ```typescript
 * const state = rootReducer(undefined, start())
 * // => { inProgress: true, success: false, fail: false, halt: false }
 * ```
 */
export const rootReducer = (state = createInitialState(), action: Action): State => {
  const handler = <((state: State, action: Action) => State) | undefined>handlers[<keyof Handlers>action.type]
  return handler ? handler(state, action) : state
}
