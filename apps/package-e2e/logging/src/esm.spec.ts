/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/logging`
 * Tests that the package is importable and exports work correctly from this test process, then from a
 * packed-tarball install outside the workspace driven through plain Node child processes with no loader
 * hooks, where the bundled first-party chunks under `_dependencies/` resolve as a consumer's Node resolves them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect, jest } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/logging'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000

const RUNNER = [
  "import { createLogLevelConfig, createLogger, isValidLogger } from '@hyperfrontend/logging'",
  'const calls = []',
  'const sink = (level) => (...data) => calls.push([level, ...data])',
  "const logger = createLogger(sink('error'), sink('warn'), sink('log'), sink('info'))",
  'const defaultLevel = logger.getLogLevel()',
  "logger.setLogLevel('info')",
  "logger.error('e1')",
  "logger.warn('w1')",
  "logger.log('l1')",
  "logger.info('i1')",
  "const config = createLogLevelConfig('warn')",
  "process.stdout.write(JSON.stringify({ valid: isValidLogger(logger), defaultLevel, calls, warnLogs: config.shouldLog('warn'), infoLogs: config.shouldLog('info') }))",
  '',
].join('\n')

describe('@hyperfrontend/logging ESM', () => {
  it('is importable', async () => {
    const logging = await import('@hyperfrontend/logging')
    expect(logging).toBeDefined()
  })

  it('exports createLogger function', async () => {
    const { createLogger } = await import('@hyperfrontend/logging')
    expect(typeof createLogger).toBe('function')
  })

  it('creates a logger with info, error, warn and log methods', async () => {
    const { createLogger } = await import('@hyperfrontend/logging')

    const mockError = jest.fn()
    const mockWarn = jest.fn()
    const mockLog = jest.fn()
    const mockInfo = jest.fn()

    const logger = createLogger(mockError, mockWarn, mockLog, mockInfo)

    expect(logger).toEqual(
      expect.objectContaining({
        info: expect.any(Function),
        error: expect.any(Function),
        warn: expect.any(Function),
        log: expect.any(Function),
      })
    )
  })

  it('exports isValidLogger function', async () => {
    const { isValidLogger } = await import('@hyperfrontend/logging')
    expect(typeof isValidLogger).toBe('function')
  })

  it('recognises a created logger through isValidLogger', async () => {
    const { isValidLogger, createLogger } = await import('@hyperfrontend/logging')

    const logger = createLogger(jest.fn())
    expect(isValidLogger(logger)).toBe(true)
  })
})

describe('@hyperfrontend/logging ESM under plain Node in an isolated consumer', () => {
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

  it('routes every enabled level of a created logger to its sink', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      valid: true,
      defaultLevel: 'error',
      calls: [
        ['error', 'e1'],
        ['warn', 'w1'],
        ['log', 'l1'],
        ['info', 'i1'],
      ],
      warnLogs: true,
      infoLogs: false,
    })
  })
})
