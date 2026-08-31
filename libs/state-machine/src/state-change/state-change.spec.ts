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
    expect(stateChange.previous).toBeNull()
    expect(stateChange.current).toBeNull()
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
    expect(stateChange.previous).toBeNull()
    expect(stateChange.current).toEqual(newState1)

    stateChange.addItem(newState2)
    expect(stateChange.previous).toEqual(newState1)
    expect(stateChange.current).toEqual(newState2)
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
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback2).toHaveBeenCalledTimes(0)
  })

  it('returns a new object for previous and current state getters', () => {
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
    expect(stateChange.current).toEqual(newState)
    expect(stateChange.current).not.toBe(newState)

    stateChange.addItem({ ...newState, notStarted: false, inProgress: true })
    expect(stateChange.previous).toEqual(newState)
    expect(stateChange.previous).not.toBe(newState)
  })
})
