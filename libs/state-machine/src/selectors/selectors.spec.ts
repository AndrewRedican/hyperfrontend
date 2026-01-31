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
  it('notStarted', () => {
    expect(
      notStarted({
        inProgress: false,
        success: false,
        fail: false,
        halt: false,
      })
    ).toBe(true)
    expect(notStarted({ inProgress: true, success: false, fail: false, halt: false })).toBe(false)
    expect(notStarted({ inProgress: false, success: true, fail: false, halt: false })).toBe(false)
    expect(notStarted({ inProgress: false, success: false, fail: true, halt: false })).toBe(false)
  })

  it('inProgress', () => {
    expect(inProgress({ inProgress: true, success: false, fail: false, halt: false })).toBe(true)
    expect(inProgress({ inProgress: false, success: true, fail: false, halt: false })).toBe(false)
  })

  it('done', () => {
    expect(done({ inProgress: false, success: true, fail: false, halt: false })).toBe(true)
    expect(done({ inProgress: false, success: false, fail: true, halt: false })).toBe(true)
    expect(done({ inProgress: true, success: false, fail: false, halt: false })).toBe(false)
  })

  it('successful', () => {
    expect(successful({ inProgress: false, success: true, fail: false, halt: false })).toBe(true)
    expect(successful({ inProgress: true, success: false, fail: false, halt: false })).toBe(false)
    expect(successful({ inProgress: false, success: false, fail: true, halt: false })).toBe(false)
  })

  it('failed', () => {
    expect(failed({ inProgress: false, success: false, fail: true, halt: false })).toBe(true)
    expect(failed({ inProgress: true, success: false, fail: false, halt: false })).toBe(false)
    expect(failed({ inProgress: false, success: true, fail: false, halt: false })).toBe(false)
  })

  it('retrying', () => {
    expect(retrying({ inProgress: true, success: false, fail: true, halt: false })).toBe(true)
    expect(retrying({ inProgress: false, success: false, fail: true, halt: false })).toBe(false)
    expect(retrying({ inProgress: true, success: false, fail: false, halt: false })).toBe(false)
  })

  it('restarting', () => {
    expect(restarting({ inProgress: true, success: true, fail: false, halt: false })).toBe(true)
    expect(restarting({ inProgress: false, success: true, fail: false, halt: false })).toBe(false)
    expect(restarting({ inProgress: true, success: false, fail: false, halt: false })).toBe(false)
  })

  it('halted', () => {
    expect(halted({ inProgress: false, success: false, fail: false, halt: true })).toBe(true)
    expect(halted({ inProgress: false, success: false, fail: false, halt: false })).toBe(false)
  })

  it('paused', () => {
    expect(paused({ inProgress: true, success: false, fail: false, halt: true })).toBe(true)
    expect(paused({ inProgress: true, success: false, fail: false, halt: false })).toBe(false)
    expect(paused({ inProgress: false, success: false, fail: false, halt: true })).toBe(false)
  })

  it('cancelled', () => {
    expect(cancelled({ inProgress: false, success: false, fail: false, halt: true })).toBe(true)
    expect(cancelled({ inProgress: true, success: false, fail: false, halt: true })).toBe(false)
    expect(cancelled({ inProgress: false, success: true, fail: false, halt: true })).toBe(false)
    expect(cancelled({ inProgress: false, success: false, fail: true, halt: true })).toBe(false)
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
