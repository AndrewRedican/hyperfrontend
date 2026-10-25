/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/time-utils`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `import` sees them.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/time-utils ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/time-utils')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        sleep: 'function',
        createTimer: 'function',
        createClock: 'function',
        normalizeToBaseTimeWindow: 'function',
        setIntervalCallback: 'function',
      })
    )
  })

  it('sleeps for at least the requested time', () => {
    const slept = consumer.run(async () => {
      const { sleep } = await import('@hyperfrontend/time-utils')
      const started = Date.now()
      await sleep(20)
      return Date.now() - started >= 15
    })
    expect(slept).toBe(true)
  })

  it('creates a timer with pause, resume and reset methods', () => {
    const methods = consumer.run(async () => {
      const { createTimer } = await import('@hyperfrontend/time-utils')
      const timer = createTimer(() => undefined, 1000)
      timer.pause()
      return [typeof timer.pause, typeof timer.resume, typeof timer.reset]
    })
    expect(methods).toEqual(['function', 'function', 'function'])
  })

  it('normalises a time to the start of its window', () => {
    const bucket = consumer.run(async () => {
      const { normalizeToBaseTimeWindow } = await import('@hyperfrontend/time-utils')
      return normalizeToBaseTimeWindow(new Date('2024-03-15T14:23:45Z'), 15).toISOString()
    })
    expect(bucket).toBe('2024-03-15T14:15:00.000Z')
  })
})
