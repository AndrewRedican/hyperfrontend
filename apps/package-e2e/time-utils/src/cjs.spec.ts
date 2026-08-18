/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/time-utils`
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/time-utils CJS', () => {
  it('is requireable', () => {
    const timeUtils = require('@hyperfrontend/time-utils')
    expect(timeUtils).toBeDefined()
  })

  it('exports sleep function', () => {
    const { sleep } = require('@hyperfrontend/time-utils')
    expect(typeof sleep).toBe('function')
  })

  it('sleep returns a promise that resolves', async () => {
    const { sleep } = require('@hyperfrontend/time-utils')

    const start = Date.now()
    await sleep(10)
    const elapsed = Date.now() - start

    // Should have waited at least 10ms (with some tolerance)
    expect(elapsed).toBeGreaterThanOrEqual(9)
  })

  it('exports createTimer function', () => {
    const { createTimer } = require('@hyperfrontend/time-utils')
    expect(typeof createTimer).toBe('function')
  })

  it('creates a timer with pause, resume, reset methods', () => {
    const { createTimer } = require('@hyperfrontend/time-utils')

    const timer = createTimer(() => {}, 1000)

    expect(timer).toBeDefined()
    expect(typeof timer.pause).toBe('function')
    expect(typeof timer.resume).toBe('function')
    expect(typeof timer.reset).toBe('function')

    // Clean up
    timer.pause()
  })

  it('exports createClock function', () => {
    const { createClock } = require('@hyperfrontend/time-utils')
    expect(typeof createClock).toBe('function')
  })

  it('exports normalizeToBaseTimeWindow function', () => {
    const { normalizeToBaseTimeWindow } = require('@hyperfrontend/time-utils')
    expect(typeof normalizeToBaseTimeWindow).toBe('function')
  })

  it('exports setIntervalCallback function', () => {
    const { setIntervalCallback } = require('@hyperfrontend/time-utils')
    expect(typeof setIntervalCallback).toBe('function')
  })
})
