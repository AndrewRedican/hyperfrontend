import type { State } from '../models'
import { cancel, pause, start } from '../actions/actions'
import { Store } from './store'

describe('Store', () => {
  let store: Store
  let initialState: State

  beforeEach(() => {
    store = new Store()
    initialState = store.getState()
  })

  it('creates a new store with initial state', () => {
    expect(store).toBeDefined()
    expect(initialState).toBeDefined()
  })

  it('dispatches an action and updates state', () => {
    store.dispatch(start())
    const newState = store.getState()
    expect(newState).not.toEqual(initialState)
  })

  it('returns the current state', () => {
    const state = store.getState()
    expect(state).toEqual(initialState)
  })

  it('subscribes and unsubscribes a listener', () => {
    const listener = jest.fn()
    const unsubscribe = store.subscribe(listener)

    // Dispatch an action to check if the listener is called
    store.dispatch(pause())
    expect(listener).toHaveBeenCalledTimes(1)

    // Unsubscribe the listener
    unsubscribe()

    // Dispatch another action to check if the listener is not called again
    store.dispatch(cancel())
    expect(listener).toHaveBeenCalledTimes(1) // Listener should still have been called only once
  })
})
