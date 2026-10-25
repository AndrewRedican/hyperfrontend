/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/logging`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `import` sees them.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/logging ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/logging')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        createLogger: 'function',
        isValidLogger: 'function',
        createLogLevelConfig: 'function',
      })
    )
  })

  it('creates a logger with info, error, warn and log methods', () => {
    const methods = consumer.run(async () => {
      const { createLogger } = await import('@hyperfrontend/logging')
      const noop = () => undefined
      const logger = createLogger(noop, noop, noop, noop)
      return [typeof logger.info, typeof logger.error, typeof logger.warn, typeof logger.log]
    })
    expect(methods).toEqual(['function', 'function', 'function', 'function'])
  })

  it('recognises a created logger through isValidLogger', () => {
    const valid = consumer.run(async () => {
      const { createLogger, isValidLogger } = await import('@hyperfrontend/logging')
      return isValidLogger(createLogger(() => undefined))
    })
    expect(valid).toBe(true)
  })

  it('starts a logger at the error level', () => {
    const level = consumer.run(async () => {
      const { createLogger } = await import('@hyperfrontend/logging')
      return createLogger(() => undefined).getLogLevel()
    })
    expect(level).toBe('error')
  })

  it('routes every level at or above the configured one to its sink', () => {
    const calls = consumer.run(async () => {
      const { createLogger } = await import('@hyperfrontend/logging')
      const calls: unknown[][] = []
      const sink =
        (level: string) =>
        (...data: unknown[]) =>
          calls.push([level, ...data])
      const logger = createLogger(sink('error'), sink('warn'), sink('log'), sink('info'))
      logger.setLogLevel('warn')
      logger.error('e1')
      logger.warn('w1')
      logger.log('dropped')
      logger.info('dropped')
      return calls
    })
    expect(calls).toEqual([
      ['error', 'e1'],
      ['warn', 'w1'],
    ])
  })

  it('answers which levels a level config lets through', () => {
    const allowed = consumer.run(async () => {
      const { createLogLevelConfig } = await import('@hyperfrontend/logging')
      const config = createLogLevelConfig('warn')
      return [config.shouldLog('error'), config.shouldLog('warn'), config.shouldLog('info')]
    })
    expect(allowed).toEqual([true, true, false])
  })
})
