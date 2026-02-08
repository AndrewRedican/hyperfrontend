import { createInitialState } from './state'
import type { State } from '../models'

describe('store', () => {
  it('createInitialState', () => {
    const initialState: State = {
      inProgress: false,
      success: false,
      fail: false,
      halt: false,
    }

    expect(createInitialState()).toEqual(initialState)
  })
})
