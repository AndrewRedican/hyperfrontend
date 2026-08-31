import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { currentGeneration } from '../hooks/generation'
import { jest } from './jest-api'
import { isMockFunction } from './types'

describe('jest mock helpers', () => {
  it('creates a mock function', () => {
    assert.equal(isMockFunction(jest.fn()), true)
  })

  it('creates a mock with an implementation', () => {
    assert.equal(jest.fn((value: number) => value + 1)(1), 2)
  })

  it('spies on a method', () => {
    const host = { greet: () => 'real' }
    jest.spyOn(host, 'greet').mockReturnValue('fake')
    assert.equal(host.greet(), 'fake')
  })

  it('returns its argument from mocked', () => {
    const mock = jest.fn()
    assert.equal(jest.mocked(mock), mock)
  })

  it('clears every mock', () => {
    const mock = jest.fn()
    mock()
    jest.clearAllMocks()
    assert.deepEqual(mock.mock.calls, [])
  })

  it('resets every mock', () => {
    const mock = jest.fn().mockReturnValue(1)
    jest.resetAllMocks()
    assert.equal(mock(), undefined)
  })

  it('restores every spy', () => {
    const host = { greet: () => 'real' }
    jest.spyOn(host, 'greet').mockReturnValue('fake')
    jest.restoreAllMocks()
    assert.equal(host.greet(), 'real')
  })

  it('returns the namespace from clearAllMocks so calls can chain', () => {
    assert.equal(jest.clearAllMocks(), jest)
  })

  it('returns the namespace from resetAllMocks so calls can chain', () => {
    assert.equal(jest.resetAllMocks(), jest)
  })

  it('returns the namespace from restoreAllMocks so calls can chain', () => {
    assert.equal(jest.restoreAllMocks(), jest)
  })
})

describe('jest timer helpers', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('installs a fake clock', () => {
    jest.useFakeTimers({ now: 0 })
    assert.equal(Date.now(), 0)
  })

  it('returns the namespace from useFakeTimers so calls can chain', () => {
    assert.equal(jest.useFakeTimers({ now: 0 }), jest)
  })

  it('returns the namespace from useRealTimers so calls can chain', () => {
    assert.equal(jest.useRealTimers(), jest)
  })

  it('advances the clock', () => {
    jest.useFakeTimers()
    const ran = jest.fn()
    setTimeout(ran, 10)
    jest.advanceTimersByTime(10)
    assert.equal(ran.mock.calls.length, 1)
  })

  it('advances the clock and yields', async () => {
    jest.useFakeTimers()
    const ran = jest.fn()
    setTimeout(ran, 10)
    await jest.advanceTimersByTimeAsync(10)
    assert.equal(ran.mock.calls.length, 1)
  })

  it('runs every pending timer', () => {
    jest.useFakeTimers()
    const ran = jest.fn()
    setTimeout(ran, 10_000)
    jest.runAllTimers()
    assert.equal(ran.mock.calls.length, 1)
  })

  it('runs the timers pending right now', () => {
    jest.useFakeTimers()
    const ran = jest.fn()
    setTimeout(ran, 10)
    jest.runOnlyPendingTimers()
    assert.equal(ran.mock.calls.length, 1)
  })

  it('discards pending timers', () => {
    jest.useFakeTimers({ now: 0 })
    const ran = jest.fn()
    setTimeout(ran, 10)
    jest.clearAllTimers()
    jest.advanceTimersByTime(100)
    assert.equal(ran.mock.calls.length, 0)
  })

  it('moves the clock to an instant', () => {
    jest.useFakeTimers({ now: 0 })
    jest.setSystemTime(999)
    assert.equal(Date.now(), 999)
  })
})

describe('jest.resetModules', () => {
  it('advances the module generation', () => {
    const before = currentGeneration()
    jest.resetModules()
    assert.equal(currentGeneration(), before + 1)
  })

  it('returns the namespace so calls can chain', () => {
    assert.equal(jest.resetModules(), jest)
  })
})
