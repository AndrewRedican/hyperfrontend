import type { State } from '../models'
import { createInitialState } from './state'

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
