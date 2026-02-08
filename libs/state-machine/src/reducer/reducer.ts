/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Action, State, Handlers } from '../models'
import * as ActionTypes from '../actions/actions.types'
import { createInitialState } from '../state/state'

const handlers: Handlers = {
  [ActionTypes.START]: (state) => ({ ...state, inProgress: true }),
  [ActionTypes.PAUSE]: (state) => ({ ...state, inProgress: true, halt: true }),
  [ActionTypes.CANCEL]: (state) => ({
    ...state,
    inProgress: false,
    halt: true,
  }),
  [ActionTypes.SUCCESS]: (state) => ({
    ...state,
    inProgress: false,
    success: true,
    fail: false,
    halt: false,
  }),
  [ActionTypes.FAIL]: (state) => ({
    ...state,
    inProgress: false,
    success: false,
    fail: true,
    halt: false,
  }),
}

export const rootReducer = (state = createInitialState(), action: Action): State => {
  const handler = (handlers as any)[action.type] as Handlers[keyof Handlers]
  return handler ? handler(state, action as any) : state
}
