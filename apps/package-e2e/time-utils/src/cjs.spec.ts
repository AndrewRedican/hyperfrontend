/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/time-utils`
 * Tests that the package is requireable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/time-utils'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { createTimer, normalizeToBaseTimeWindow, sleep } = require('@hyperfrontend/time-utils')",
  'async function main() {',
  '  const started = Date.now()',
  '  await sleep(20)',
  '  const elapsed = Date.now() - started',
  '  const timer = createTimer(() => undefined, 1000)',
  '  timer.pause()',
  '  return {',
  '    slept: elapsed >= 15,',
  "    bucket: normalizeToBaseTimeWindow(new Date('2024-03-15T14:23:45Z'), 15).toISOString(),",
  "    timer: ['pause', 'resume', 'reset'].every((method) => typeof timer[method] === 'function'),",
  '  }',
  '}',
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

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

    expect(timer).toEqual(
      expect.objectContaining({
        pause: expect.any(Function),
        resume: expect.any(Function),
        reset: expect.any(Function),
      })
    )

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

describe('@hyperfrontend/time-utils CJS under plain Node in an isolated consumer', () => {
  let consumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.cjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('requires every export entry natively', () => {
    const loads = consumer.loadEntries('require')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('sleeps, buckets a time and hands out a pausable timer', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      slept: true,
      bucket: '2024-03-15T14:15:00.000Z',
      timer: true,
    })
  })
})
