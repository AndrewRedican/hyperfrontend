import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { useFakeTimers, useRealTimers } from '../mock/timers'
import { waitFor, waitUntil } from './wait-for'

describe('waitFor', () => {
  afterEach(() => useRealTimers())

  it('resolves with the value of a callback that passes at once', async () => {
    assert.equal(await waitFor(() => 'ready'), 'ready')
  })

  it('retries until the callback stops throwing', async () => {
    let attempts = 0
    const value = await waitFor(
      () => {
        attempts++
        if (attempts < 3) throw new Error('not yet')
        return attempts
      },
      { interval: 1 }
    )
    assert.equal(value, 3)
  })

  it('treats a rejected promise as a failed attempt', async () => {
    let attempts = 0
    const value = await waitFor(
      async () => {
        attempts++
        if (attempts < 2) throw new Error('not yet')
        return 'settled'
      },
      { interval: 1 }
    )
    assert.equal(value, 'settled')
  })

  it('rethrows the last error once the timeout passes', async () => {
    await assert.rejects(
      waitFor(
        () => {
          throw new Error('still failing')
        },
        { timeout: 30, interval: 5 }
      ),
      /still failing/
    )
  })

  it('reports a timeout when the callback never finishes an attempt', async () => {
    await assert.rejects(
      waitFor(() => new Promise(() => undefined), { timeout: 20 }),
      /waitFor timed out after 20ms before the callback finished an attempt/
    )
  })

  it('advances the fake clock between attempts', async () => {
    useFakeTimers()
    let fired = false
    setTimeout(() => {
      fired = true
    }, 100)
    const value = await waitFor(
      () => {
        if (!fired) throw new Error('timer still pending')
        return 'fired'
      },
      { interval: 10 }
    )
    assert.equal(value, 'fired')
  })
})

describe('waitUntil', () => {
  it('resolves with the first truthy value', async () => {
    let attempts = 0
    const value = await waitUntil(() => (++attempts >= 3 ? { attempts } : null), { interval: 1 })
    assert.deepEqual(value, { attempts: 3 })
  })

  it('awaits a predicate that returns a promise', async () => {
    assert.equal(await waitUntil(async () => 'found'), 'found')
  })

  it('reports a timeout when the predicate stays falsy', async () => {
    await assert.rejects(
      waitUntil(() => false, { timeout: 20, interval: 5 }),
      /waitUntil timed out after 20ms/
    )
  })

  it('raises an error the predicate throws without retrying', async () => {
    let attempts = 0
    await assert.rejects(
      waitUntil(() => {
        attempts++
        throw new Error(`broken on attempt ${attempts}`)
      }),
      /broken on attempt 1/
    )
  })
})
