/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/time-utils
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/time-utils CJS', () => {
  it('should be requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const timeUtils = require('@hyperfrontend/time-utils')
    expect(timeUtils).toBeDefined()
  })

  it('should export sleep function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sleep } = require('@hyperfrontend/time-utils')
    expect(typeof sleep).toBe('function')
  })

  it('should sleep returns a promise that resolves', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { sleep } = require('@hyperfrontend/time-utils')

    const start = Date.now()
    await sleep(10)
    const elapsed = Date.now() - start

    // Should have waited at least 10ms (with some tolerance)
    expect(elapsed).toBeGreaterThanOrEqual(9)
  })

  it('should export createTimer function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTimer } = require('@hyperfrontend/time-utils')
    expect(typeof createTimer).toBe('function')
  })

  it('should create a timer with pause, resume, reset methods', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createTimer } = require('@hyperfrontend/time-utils')

    const timer = createTimer(() => {}, 1000)

    expect(timer).toBeDefined()
    expect(typeof timer.pause).toBe('function')
    expect(typeof timer.resume).toBe('function')
    expect(typeof timer.reset).toBe('function')

    // Clean up
    timer.pause()
  })

  it('should export createClock function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClock } = require('@hyperfrontend/time-utils')
    expect(typeof createClock).toBe('function')
  })

  it('should export normalizeToBaseTimeWindow function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { normalizeToBaseTimeWindow } = require('@hyperfrontend/time-utils')
    expect(typeof normalizeToBaseTimeWindow).toBe('function')
  })

  it('should export setIntervalCallback function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { setIntervalCallback } = require('@hyperfrontend/time-utils')
    expect(typeof setIntervalCallback).toBe('function')
  })
})
