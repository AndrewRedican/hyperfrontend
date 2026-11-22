import { createDeferred, describe, expect, it } from '@hyperfrontend/testing'
import { systemClock } from './clock'

describe('systemClock', () => {
  it('reads the wall clock between two readings taken around it', () => {
    const before = Date.now()
    const reading = systemClock.now()
    expect({ notBefore: reading >= before, notAfter: reading <= Date.now() }).toEqual({ notBefore: true, notAfter: true })
  })

  it('fires a timer it started', async () => {
    const fired = createDeferred<string>()
    systemClock.setTimeout(() => fired.resolve('fired'), 1)
    expect(await fired.promise).toBe('fired')
  })

  it('does not fire a timer it cleared', async () => {
    const calls: string[] = []
    const later = createDeferred<void>()
    systemClock.clearTimeout(systemClock.setTimeout(() => calls.push('cleared'), 1))
    systemClock.setTimeout(() => later.resolve(), 5)
    await later.promise
    expect(calls).toEqual([])
  })

  it('is frozen', () => {
    expect(Object.isFrozen(systemClock)).toBe(true)
  })
})
