import type { UnresponsivePolicy } from '../shared/types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createRevival, resolveReopenPolicy } from './revival'

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
  clearTimeout: (id: number) => clearTimeout(id),
}))

const TUNING = { graceMs: 1000, backoff: 2, attempts: 2, stableMs: 5000 }

interface HookState {
  healthy: boolean
}

function setup() {
  const state: HookState = { healthy: false }
  const hooks = {
    isHealthy: () => state.healthy,
    reopen: jest.fn(),
    giveUp: jest.fn(),
  }
  return { state, hooks, revival: createRevival(TUNING, hooks) }
}

describe('resolveReopenPolicy', () => {
  it.each([
    ['no policy', undefined],
    ['the emit policy', 'emit'],
    ['the unmount policy', 'unmount'],
    ['a callback policy', () => undefined],
  ])('reads no tuning from %s', (_label: string, policy: UnresponsivePolicy | undefined) => {
    expect(resolveReopenPolicy(policy)).toBeNull()
  })

  it('applies the defaults to the shorthand', () => {
    expect(resolveReopenPolicy('reopen')).toEqual({ graceMs: 4000, backoff: 3, attempts: 3, stableMs: 60000 })
  })

  it('layers the given tuning over the defaults', () => {
    expect(resolveReopenPolicy({ reopen: { attempts: 5 } })).toEqual({ graceMs: 4000, backoff: 3, attempts: 5, stableMs: 60000 })
  })

  it('accepts the edges of every range', () => {
    expect(resolveReopenPolicy({ reopen: { graceMs: 0, backoff: 1, attempts: 1, stableMs: 0 } })).toEqual({
      graceMs: 0,
      backoff: 1,
      attempts: 1,
      stableMs: 0,
    })
  })

  it.each([-1, Infinity])('rejects the grace %p as negative or not finite', (graceMs: number) => {
    expect(() => resolveReopenPolicy({ reopen: { graceMs } })).toThrow('"graceMs" must be a finite number')
  })

  it.each([0.5, NaN])('rejects the backoff %p as below one or not finite', (backoff: number) => {
    expect(() => resolveReopenPolicy({ reopen: { backoff } })).toThrow('"backoff" must be a finite factor')
  })

  it.each([0, 1.5])('rejects the attempt budget %p as not a positive integer', (attempts: number) => {
    expect(() => resolveReopenPolicy({ reopen: { attempts } })).toThrow('"attempts" must be a positive integer')
  })

  it('rejects a stability window that is negative or not finite', () => {
    expect(() => resolveReopenPolicy({ reopen: { stableMs: -5 } })).toThrow('"stableMs" must be a finite number')
  })
})

describe('createRevival', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('reopens once the verdict outlasts the grace', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    jest.advanceTimersByTime(999)
    const reopensBeforeGraceEnds = [...hooks.reopen.mock.calls]
    jest.advanceTimersByTime(1)
    expect({ reopensBeforeGraceEnds, reopensAtGraceEnd: hooks.reopen.mock.calls }).toEqual({
      reopensBeforeGraceEnds: [],
      reopensAtGraceEnd: [[1, 2]],
    })
  })

  it('leaves a frame that beat again during the grace alone', () => {
    const { state, hooks, revival } = setup()
    revival.unresponsive()
    state.healthy = true
    jest.advanceTimersByTime(1000)
    expect(hooks.reopen).not.toHaveBeenCalled()
  })

  it('schedules one reopen however often the verdict repeats', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    revival.unresponsive()
    jest.advanceTimersByTime(1000)
    expect(hooks.reopen).toHaveBeenCalledTimes(1)
  })

  it('waits longer for each further death in the same episode', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    jest.advanceTimersByTime(1000)
    revival.opened()
    revival.unresponsive()
    jest.advanceTimersByTime(1999)
    const reopensBeforeLongerGraceEnds = hooks.reopen.mock.calls.length
    jest.advanceTimersByTime(1)
    expect({ reopensBeforeLongerGraceEnds, lastReopen: hooks.reopen.mock.lastCall }).toEqual({
      reopensBeforeLongerGraceEnds: 1,
      lastReopen: [2, 2],
    })
  })

  it('gives up once the budget is spent and the frame is still silent', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    jest.advanceTimersByTime(1000)
    revival.opened()
    revival.unresponsive()
    jest.advanceTimersByTime(2000)
    revival.opened()
    revival.unresponsive()
    jest.advanceTimersByTime(3999)
    const giveUpsBeforeGraceEnds = [...hooks.giveUp.mock.calls]
    jest.advanceTimersByTime(1)
    expect({ giveUpsBeforeGraceEnds, giveUpsAtGraceEnd: hooks.giveUp.mock.calls, reopens: hooks.reopen.mock.calls.length }).toEqual({
      giveUpsBeforeGraceEnds: [],
      giveUpsAtGraceEnd: [[2]],
      reopens: 2,
    })
  })

  it('restores the budget once a reopened session stays open', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    jest.advanceTimersByTime(1000)
    revival.opened()
    jest.advanceTimersByTime(5000)
    revival.unresponsive()
    jest.advanceTimersByTime(1000)
    expect(hooks.reopen).toHaveBeenLastCalledWith(1, 2)
  })

  it('restores the budget once a stalled frame that recovered stays', () => {
    const { state, hooks, revival } = setup()
    revival.unresponsive()
    jest.advanceTimersByTime(1000)
    revival.opened()
    revival.unresponsive()
    state.healthy = true
    jest.advanceTimersByTime(2000)
    jest.advanceTimersByTime(5000)
    state.healthy = false
    revival.unresponsive()
    jest.advanceTimersByTime(1000)
    expect(hooks.reopen).toHaveBeenLastCalledWith(1, 2)
  })

  it('keeps counting when the frame dies again inside the stability window', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    jest.advanceTimersByTime(1000)
    revival.opened()
    jest.advanceTimersByTime(4999)
    revival.unresponsive()
    jest.advanceTimersByTime(2000)
    expect(hooks.reopen).toHaveBeenLastCalledWith(2, 2)
  })

  it('holds the attempt while silence cannot be judged, then grants a fresh grace', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    revival.setObservable(false)
    jest.advanceTimersByTime(10_000)
    const reopensWhileUnobservable = [...hooks.reopen.mock.calls]
    revival.setObservable(true)
    jest.advanceTimersByTime(999)
    const reopensBeforeFreshGraceEnds = [...hooks.reopen.mock.calls]
    jest.advanceTimersByTime(1)
    expect({ reopensWhileUnobservable, reopensBeforeFreshGraceEnds, reopensAtFreshGraceEnd: hooks.reopen.mock.calls }).toEqual({
      reopensWhileUnobservable: [],
      reopensBeforeFreshGraceEnds: [],
      reopensAtFreshGraceEnd: [[1, 2]],
    })
  })

  it('ignores a return to observability when nothing is held', () => {
    const { hooks, revival } = setup()
    revival.setObservable(true)
    jest.advanceTimersByTime(10_000)
    expect(hooks.reopen).not.toHaveBeenCalled()
  })

  it('ignores a repeated verdict while an attempt is held', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    revival.setObservable(false)
    jest.advanceTimersByTime(1000)
    revival.unresponsive()
    jest.advanceTimersByTime(10_000)
    expect(hooks.reopen).not.toHaveBeenCalled()
  })

  it('lets a session that opened supersede a pending reopen', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    revival.opened()
    jest.advanceTimersByTime(1000)
    expect(hooks.reopen).not.toHaveBeenCalled()
  })

  it('counts a reopened session that never connected as the next death', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    jest.advanceTimersByTime(1000)
    revival.connectFailed()
    jest.advanceTimersByTime(2000)
    expect(hooks.reopen).toHaveBeenLastCalledWith(2, 2)
  })

  it('leaves a failed connection it did not start to the host', () => {
    const { hooks, revival } = setup()
    revival.connectFailed()
    jest.advanceTimersByTime(10_000)
    expect(hooks.reopen).not.toHaveBeenCalled()
  })

  it('cancels a pending reopen when disposed', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    revival.dispose()
    jest.advanceTimersByTime(10_000)
    expect(hooks.reopen).not.toHaveBeenCalled()
  })

  it('forgets a held attempt when disposed', () => {
    const { hooks, revival } = setup()
    revival.unresponsive()
    revival.setObservable(false)
    jest.advanceTimersByTime(1000)
    revival.dispose()
    revival.setObservable(true)
    jest.advanceTimersByTime(10_000)
    expect(hooks.reopen).not.toHaveBeenCalled()
  })
})
