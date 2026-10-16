import type { DerivedState } from '../models'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { StateChange } from './state-change'

describe('StateChange', () => {
  let stateChange: StateChange

  beforeEach(() => {
    stateChange = new StateChange()
  })

  it('has initial state as null for both previous and current', () => {
    expect({ previous: stateChange.previous, current: stateChange.current }).toEqual({ previous: null, current: null })
  })

  it('updates previous and current when a new state is added', () => {
    const newState1: DerivedState = {
      notStarted: true,
      inProgress: false,
      done: false,
      successful: false,
      failed: false,
      retrying: false,
      restarting: false,
      paused: false,
      cancelled: false,
    }

    const newState2: DerivedState = {
      notStarted: false,
      inProgress: true,
      done: false,
      successful: false,
      failed: false,
      retrying: false,
      restarting: false,
      paused: false,
      cancelled: false,
    }

    stateChange.addItem(newState1)
    const afterFirst = { previous: stateChange.previous, current: stateChange.current }

    stateChange.addItem(newState2)
    const afterSecond = { previous: stateChange.previous, current: stateChange.current }

    expect({ afterFirst, afterSecond }).toEqual({
      afterFirst: { previous: null, current: newState1 },
      afterSecond: { previous: newState1, current: newState2 },
    })
  })

  it('triggers registered callbacks with new previous and current state', () => {
    const callback = jest.fn()
    const newState: DerivedState = {
      notStarted: true,
      inProgress: false,
      done: false,
      successful: false,
      failed: false,
      retrying: false,
      restarting: false,
      paused: false,
      cancelled: false,
    }

    stateChange.registerCallback(callback)

    stateChange.addItem(newState)
    expect(callback).toHaveBeenCalledWith(null, newState)
  })

  it('triggers a registered callback once when a state is added', () => {
    const callback1 = jest.fn()
    const newState: DerivedState = {
      notStarted: true,
      inProgress: false,
      done: false,
      successful: false,
      failed: false,
      retrying: false,
      restarting: false,
      paused: false,
      cancelled: false,
    }

    stateChange.registerCallback(callback1)

    stateChange.addItem(newState)
    expect(callback1).toHaveBeenCalledTimes(1)
  })

  it('does not trigger unregistered callbacks', () => {
    const callback1 = jest.fn()
    const callback2 = jest.fn()
    const newState: DerivedState = {
      notStarted: true,
      inProgress: false,
      done: false,
      successful: false,
      failed: false,
      retrying: false,
      restarting: false,
      paused: false,
      cancelled: false,
    }

    stateChange.registerCallback(callback1)

    stateChange.addItem(newState)
    expect(callback2).toHaveBeenCalledTimes(0)
  })

  it('returns a new object equal to the current state from the current getter', () => {
    const newState: DerivedState = {
      notStarted: true,
      inProgress: false,
      done: false,
      successful: false,
      failed: false,
      retrying: false,
      restarting: false,
      paused: false,
      cancelled: false,
    }

    stateChange.addItem(newState)
    const current = stateChange.current
    expect({ current, sameObject: current === newState }).toEqual({ current: newState, sameObject: false })
  })

  it('returns a new object equal to the previous state from the previous getter', () => {
    const newState: DerivedState = {
      notStarted: true,
      inProgress: false,
      done: false,
      successful: false,
      failed: false,
      retrying: false,
      restarting: false,
      paused: false,
      cancelled: false,
    }

    stateChange.addItem(newState)

    stateChange.addItem({ ...newState, notStarted: false, inProgress: true })
    const previous = stateChange.previous
    expect({ previous, sameObject: previous === newState }).toEqual({ previous: newState, sameObject: false })
  })
})
