import type * as actions from './actions/actions'
import type { START, PAUSE, CANCEL, SUCCESS, FAIL } from './actions/actions.types'

export interface Action {
  type: string
}

export interface Handlers {
  [START]: (state: State, action: ReturnType<typeof actions.start>) => State
  [PAUSE]: (state: State, action: ReturnType<typeof actions.pause>) => State
  [CANCEL]: (state: State, action: ReturnType<typeof actions.cancel>) => State
  [SUCCESS]: (state: State, action: ReturnType<typeof actions.success>) => State
  [FAIL]: (state: State, action: ReturnType<typeof actions.fail>) => State
}

export interface State {
  inProgress: boolean
  success: boolean
  fail: boolean
  halt: boolean
}

export interface DerivedState {
  notStarted: boolean
  inProgress: boolean
  done: boolean
  successful: boolean
  failed: boolean
  retrying: boolean
  restarting: boolean
  paused: boolean
  cancelled: boolean
}

export type StateStatusDeriver = (state: State) => boolean

export type StateDeriver = (state: State) => DerivedState

export const event = <const>{
  NotStarted: 'notStarted',
  InProgress: 'inProgress',
  Done: 'done',
  Successful: 'successful',
  Failed: 'failed',
  Retrying: 'retrying',
  Restarting: 'restarting',
  Paused: 'paused',
  Cancelled: 'cancelled',
}

export type Event = (typeof event)[keyof typeof event]
