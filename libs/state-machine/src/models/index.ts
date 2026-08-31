/**
 * Type definitions for state machine models (types exported from main entry point).
 *
 * @module @hyperfrontend/state-machine/models
 */

import type * as actions from '../actions/actions'
import type { START, PAUSE, CANCEL, SUCCESS, FAIL } from '../actions/actions.types'

/** Base action with a type discriminator */
export interface Action {
  /** Action type identifier */
  type: string
}

/** Map of action type constants to their handler functions */
export interface Handlers {
  /** Handler for start action */
  [START]: (state: State, action: ReturnType<typeof actions.start>) => State
  /** Handler for pause action */
  [PAUSE]: (state: State, action: ReturnType<typeof actions.pause>) => State
  /** Handler for cancel action */
  [CANCEL]: (state: State, action: ReturnType<typeof actions.cancel>) => State
  /** Handler for success action */
  [SUCCESS]: (state: State, action: ReturnType<typeof actions.success>) => State
  /** Handler for fail action */
  [FAIL]: (state: State, action: ReturnType<typeof actions.fail>) => State
}

/** Core state machine state flags */
export interface State {
  /** Whether the operation is currently in progress */
  inProgress: boolean
  /** Whether the operation completed successfully */
  success: boolean
  /** Whether the operation failed */
  fail: boolean
  /** Whether the operation is halted */
  halt: boolean
}

/** Derived state computed from core state flags */
export interface DerivedState {
  /** Operation has not started */
  notStarted: boolean
  /** Operation is in progress */
  inProgress: boolean
  /** Operation has completed */
  done: boolean
  /** Operation completed successfully */
  successful: boolean
  /** Operation failed */
  failed: boolean
  /** Operation is retrying */
  retrying: boolean
  /** Operation is restarting */
  restarting: boolean
  /** Operation is paused */
  paused: boolean
  /** Operation was cancelled */
  cancelled: boolean
}

/** Function that derives a single status boolean from state */
export type StateStatusDeriver = (state: State) => boolean

/** Function that derives full DerivedState from State */
export type StateDeriver = (state: State) => DerivedState
export const event = {
  NotStarted: 'notStarted',
  InProgress: 'inProgress',
  Done: 'done',
  Successful: 'successful',
  Failed: 'failed',
  Retrying: 'retrying',
  Restarting: 'restarting',
  Paused: 'paused',
  Cancelled: 'cancelled',
} as const

/** Event name type derived from the event constant object */
export type Event = (typeof event)[keyof typeof event]
