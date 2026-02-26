/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/time-utils
 * Tests that the package is importable and exports work correctly.
 */

describe('@hyperfrontend/time-utils ESM', () => {
  it('should be importable', async () => {
    const timeUtils = await import('@hyperfrontend/time-utils')
    expect(timeUtils).toBeDefined()
  })

  it('should export sleep function', async () => {
    const { sleep } = await import('@hyperfrontend/time-utils')
    expect(typeof sleep).toBe('function')
  })

  it('should sleep returns a promise that resolves', async () => {
    const { sleep } = await import('@hyperfrontend/time-utils')

    const start = Date.now()
    await sleep(10)
    const elapsed = Date.now() - start

    // Should have waited at least 10ms (with some tolerance)
    expect(elapsed).toBeGreaterThanOrEqual(9)
  })

  it('should export createTimer function', async () => {
    const { createTimer } = await import('@hyperfrontend/time-utils')
    expect(typeof createTimer).toBe('function')
  })

  it('should create a timer with pause, resume, reset methods', async () => {
    const { createTimer } = await import('@hyperfrontend/time-utils')

    const timer = createTimer(() => {}, 1000)

    expect(timer).toBeDefined()
    expect(typeof timer.pause).toBe('function')
    expect(typeof timer.resume).toBe('function')
    expect(typeof timer.reset).toBe('function')

    // Clean up
    timer.pause()
  })

  it('should export createClock function', async () => {
    const { createClock } = await import('@hyperfrontend/time-utils')
    expect(typeof createClock).toBe('function')
  })

  it('should export normalizeToBaseTimeWindow function', async () => {
    const { normalizeToBaseTimeWindow } = await import('@hyperfrontend/time-utils')
    expect(typeof normalizeToBaseTimeWindow).toBe('function')
  })

  it('should export setIntervalCallback function', async () => {
    const { setIntervalCallback } = await import('@hyperfrontend/time-utils')
    expect(typeof setIntervalCallback).toBe('function')
  })
})
