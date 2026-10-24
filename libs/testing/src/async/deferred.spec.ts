import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDeferred } from './deferred'

describe('createDeferred', () => {
  it('starts pending', () => {
    assert.equal(createDeferred().state, 'pending')
  })

  it('fulfils the promise with the value given to resolve', async () => {
    const deferred = createDeferred<string>()
    deferred.resolve('done')
    assert.equal(await deferred.promise, 'done')
  })

  it('rejects the promise with the reason given to reject', async () => {
    const deferred = createDeferred()
    deferred.reject(new Error('exit animation failed'))
    await assert.rejects(deferred.promise, /exit animation failed/)
  })

  it('reports fulfilled once the promise has settled', async () => {
    const deferred = createDeferred()
    deferred.resolve()
    await deferred.promise
    assert.equal(deferred.state, 'fulfilled')
  })

  it('reports rejected once the promise has settled, with no handler of its own attached', async () => {
    const deferred = createDeferred()
    deferred.reject(new Error('nobody awaited this'))
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(deferred.state, 'rejected')
  })
})
