import type { State } from '../models'
import { describe, expect, it } from '@hyperfrontend/testing'
import {
  notStarted,
  inProgress,
  done,
  successful,
  failed,
  retrying,
  restarting,
  halted,
  paused,
  cancelled,
  derivedState,
} from './selectors'

describe('derivedState', () => {
  it.each([
    [true, { inProgress: false, success: false, fail: false, halt: false }],
    [false, { inProgress: true, success: false, fail: false, halt: false }],
    [false, { inProgress: false, success: true, fail: false, halt: false }],
    [false, { inProgress: false, success: false, fail: true, halt: false }],
  ])('notStarted returns %s for %p', (expected: boolean, state: State) => {
    expect(notStarted(state)).toBe(expected)
  })

  it.each([
    [true, { inProgress: true, success: false, fail: false, halt: false }],
    [false, { inProgress: false, success: true, fail: false, halt: false }],
  ])('inProgress returns %s for %p', (expected: boolean, state: State) => {
    expect(inProgress(state)).toBe(expected)
  })

  it.each([
    [true, { inProgress: false, success: true, fail: false, halt: false }],
    [true, { inProgress: false, success: false, fail: true, halt: false }],
    [false, { inProgress: true, success: false, fail: false, halt: false }],
  ])('done returns %s for %p', (expected: boolean, state: State) => {
    expect(done(state)).toBe(expected)
  })

  it.each([
    [true, { inProgress: false, success: true, fail: false, halt: false }],
    [false, { inProgress: true, success: false, fail: false, halt: false }],
    [false, { inProgress: false, success: false, fail: true, halt: false }],
  ])('successful returns %s for %p', (expected: boolean, state: State) => {
    expect(successful(state)).toBe(expected)
  })

  it.each([
    [true, { inProgress: false, success: false, fail: true, halt: false }],
    [false, { inProgress: true, success: false, fail: false, halt: false }],
    [false, { inProgress: false, success: true, fail: false, halt: false }],
  ])('failed returns %s for %p', (expected: boolean, state: State) => {
    expect(failed(state)).toBe(expected)
  })

  it.each([
    [true, { inProgress: true, success: false, fail: true, halt: false }],
    [false, { inProgress: false, success: false, fail: true, halt: false }],
    [false, { inProgress: true, success: false, fail: false, halt: false }],
  ])('retrying returns %s for %p', (expected: boolean, state: State) => {
    expect(retrying(state)).toBe(expected)
  })

  it.each([
    [true, { inProgress: true, success: true, fail: false, halt: false }],
    [false, { inProgress: false, success: true, fail: false, halt: false }],
    [false, { inProgress: true, success: false, fail: false, halt: false }],
  ])('restarting returns %s for %p', (expected: boolean, state: State) => {
    expect(restarting(state)).toBe(expected)
  })

  it.each([
    [true, { inProgress: false, success: false, fail: false, halt: true }],
    [false, { inProgress: false, success: false, fail: false, halt: false }],
  ])('halted returns %s for %p', (expected: boolean, state: State) => {
    expect(halted(state)).toBe(expected)
  })

  it.each([
    [true, { inProgress: true, success: false, fail: false, halt: true }],
    [false, { inProgress: true, success: false, fail: false, halt: false }],
    [false, { inProgress: false, success: false, fail: false, halt: true }],
  ])('paused returns %s for %p', (expected: boolean, state: State) => {
    expect(paused(state)).toBe(expected)
  })

  it.each([
    [true, { inProgress: false, success: false, fail: false, halt: true }],
    [false, { inProgress: true, success: false, fail: false, halt: true }],
    [false, { inProgress: false, success: true, fail: false, halt: true }],
    [false, { inProgress: false, success: false, fail: true, halt: true }],
  ])('cancelled returns %s for %p', (expected: boolean, state: State) => {
    expect(cancelled(state)).toBe(expected)
  })

  it('derivedState', () => {
    const state = { inProgress: true, success: false, fail: true, halt: true }
    const expectedResult = {
      notStarted: false,
      inProgress: true,
      done: false,
      successful: false,
      failed: false,
      retrying: true,
      restarting: false,
      halted: true,
      paused: true,
      cancelled: false,
    }

    expect(derivedState(state)).toEqual(expectedResult)
  })
})
