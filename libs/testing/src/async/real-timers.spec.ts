import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { useFakeTimers, useRealTimers } from '../mock/timers'
import { flushPromises, sleep } from './real-timers'

describe('sleep', () => {
  afterEach(() => useRealTimers())

  it('waits on the real clock while the fake clock is installed', async () => {
    useFakeTimers()
    const started = performance.now()
    await sleep(20)
    // magic: 15 rather than 20 tolerates the coarse timer resolution some platforms report.
    assert.ok(performance.now() - started >= 15)
  })
})

describe('flushPromises', () => {
  afterEach(() => useRealTimers())

  it('settles a promise chain queued before it was called', async () => {
    let settled = false
    void Promise.resolve()
      .then(() => undefined)
      .then(() => undefined)
      .then(() => {
        settled = true
      })
    await flushPromises()
    assert.equal(settled, true)
  })

  it('resolves while the fake clock is installed', async () => {
    useFakeTimers()
    let settled = false
    void Promise.resolve().then(() => {
      settled = true
    })
    await flushPromises()
    assert.equal(settled, true)
  })
})
