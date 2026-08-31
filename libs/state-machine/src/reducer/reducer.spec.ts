import type { Action } from '../models'
import { describe, expect, it } from '@hyperfrontend/testing'
import * as ActionTypes from '../actions/actions.types'
import { createInitialState } from '../state/state'
import { rootReducer } from './reducer'

describe('reducer', () => {
  it('default state', () => {
    const action: Action = { type: 'UNKNOWN_ACTION' }
    const state = rootReducer(undefined, action)
    expect(state).toEqual(createInitialState())
  })

  it('unknown action with existing state', () => {
    const action: Action = { type: 'UNKNOWN_ACTION' }
    const existingState = { ...createInitialState(), inProgress: true }
    const state = rootReducer(existingState, action)
    expect(state).toEqual(existingState)
  })

  it('START action', () => {
    const action: Action = { type: ActionTypes.START }
    const state = rootReducer(createInitialState(), action)
    expect(state).toEqual({ ...createInitialState(), inProgress: true })
  })

  it('PAUSE action', () => {
    const action: Action = { type: ActionTypes.PAUSE }
    const state = rootReducer(createInitialState(), action)
    expect(state).toEqual({
      ...createInitialState(),
      inProgress: true,
      halt: true,
    })
  })

  it('CANCEL action', () => {
    const action: Action = { type: ActionTypes.CANCEL }
    const state = rootReducer(createInitialState(), action)
    expect(state).toEqual({
      ...createInitialState(),
      inProgress: false,
      halt: true,
    })
  })

  it('SUCCESS action', () => {
    const action: Action = { type: ActionTypes.SUCCESS }
    const state = rootReducer(createInitialState(), action)
    expect(state).toEqual({
      ...createInitialState(),
      inProgress: false,
      success: true,
      fail: false,
      halt: false,
    })
  })

  it('FAIL action', () => {
    const action: Action = { type: ActionTypes.FAIL }
    const state = rootReducer(createInitialState(), action)
    expect(state).toEqual({
      ...createInitialState(),
      inProgress: false,
      success: false,
      fail: true,
      halt: false,
    })
  })
})
