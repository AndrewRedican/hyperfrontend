import type { State } from '../models'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { cancel, pause, start } from '../actions/actions'
import { Store } from './store'

describe('Store', () => {
  let store: Store
  let initialState: State

  beforeEach(() => {
    store = new Store()
    initialState = store.getState()
  })

  it('creates a new store', () => {
    expect(store).toBeDefined()
  })

  it('reads an initial state from a new store', () => {
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

  it('calls a subscribed listener on dispatch', () => {
    const listener = jest.fn()
    store.subscribe(listener)

    store.dispatch(pause())
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops calling a listener once it is unsubscribed', () => {
    const listener = jest.fn()
    const unsubscribe = store.subscribe(listener)

    store.dispatch(pause())

    unsubscribe()

    store.dispatch(cancel())
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
