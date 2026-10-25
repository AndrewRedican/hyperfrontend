/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/time-utils`
 * Tests that the package is importable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/time-utils'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { createTimer, normalizeToBaseTimeWindow, sleep } from '@hyperfrontend/time-utils'",
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
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

describe('@hyperfrontend/time-utils ESM', () => {
  it('is importable', async () => {
    const timeUtils = await import('@hyperfrontend/time-utils')
    expect(timeUtils).toBeDefined()
  })

  it('exports sleep function', async () => {
    const { sleep } = await import('@hyperfrontend/time-utils')
    expect(typeof sleep).toBe('function')
  })

  it('sleep returns a promise that resolves', async () => {
    const { sleep } = await import('@hyperfrontend/time-utils')

    const start = Date.now()
    await sleep(10)
    const elapsed = Date.now() - start

    // Should have waited at least 10ms (with some tolerance)
    expect(elapsed).toBeGreaterThanOrEqual(9)
  })

  it('exports createTimer function', async () => {
    const { createTimer } = await import('@hyperfrontend/time-utils')
    expect(typeof createTimer).toBe('function')
  })

  it('creates a timer with pause, resume, reset methods', async () => {
    const { createTimer } = await import('@hyperfrontend/time-utils')

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

  it('exports createClock function', async () => {
    const { createClock } = await import('@hyperfrontend/time-utils')
    expect(typeof createClock).toBe('function')
  })

  it('exports normalizeToBaseTimeWindow function', async () => {
    const { normalizeToBaseTimeWindow } = await import('@hyperfrontend/time-utils')
    expect(typeof normalizeToBaseTimeWindow).toBe('function')
  })

  it('exports setIntervalCallback function', async () => {
    const { setIntervalCallback } = await import('@hyperfrontend/time-utils')
    expect(typeof setIntervalCallback).toBe('function')
  })
})

describe('@hyperfrontend/time-utils ESM under plain Node in an isolated consumer', () => {
  let consumer: NativeConsumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.mjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('imports every export entry natively', () => {
    const loads = consumer.loadEntries('import')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('sleeps, buckets a time and hands out a pausable timer', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      slept: true,
      bucket: '2024-03-15T14:15:00.000Z',
      timer: true,
    })
  })
})
