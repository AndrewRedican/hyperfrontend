/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/logging`
 * Tests that the package is requireable and exports work correctly from this test process, then from a
 * packed-tarball install outside the workspace driven through plain Node child processes with no loader hooks.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect, jest } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/logging'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000

const RUNNER = [
  "const { createLogger, isValidLogger } = require('@hyperfrontend/logging')",
  'const calls = []',
  'const sink = (level) => (...data) => calls.push([level, ...data])',
  "const logger = createLogger(sink('error'), sink('warn'))",
  "logger.setLogLevel('warn')",
  "logger.error('e1')",
  "logger.warn('w1')",
  "logger.info('dropped')",
  'process.stdout.write(JSON.stringify({ valid: isValidLogger(logger), calls }))',
  '',
].join('\n')

describe('@hyperfrontend/logging CJS', () => {
  it('is requireable', () => {
    const logging = require('@hyperfrontend/logging')
    expect(logging).toBeDefined()
  })

  it('exports createLogger function', () => {
    const { createLogger } = require('@hyperfrontend/logging')
    expect(typeof createLogger).toBe('function')
  })

  it('creates a logger with info, error, warn and log methods', () => {
    const { createLogger } = require('@hyperfrontend/logging')

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

  it('exports isValidLogger function', () => {
    const { isValidLogger } = require('@hyperfrontend/logging')
    expect(typeof isValidLogger).toBe('function')
  })

  it('recognises a created logger through isValidLogger', () => {
    const { isValidLogger, createLogger } = require('@hyperfrontend/logging')

    const logger = createLogger(jest.fn())
    expect(isValidLogger(logger)).toBe(true)
  })
})

describe('@hyperfrontend/logging CJS under plain Node in an isolated consumer', () => {
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

  it('routes the levels at or above the configured one to their sinks', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      valid: true,
      calls: [
        ['error', 'e1'],
        ['warn', 'w1'],
      ],
    })
  })
})
