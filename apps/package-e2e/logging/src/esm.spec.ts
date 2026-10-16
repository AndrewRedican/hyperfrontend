/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/logging`
 * Tests that the package is importable and exports work correctly.
 */

import { describe, it, expect, jest } from '@hyperfrontend/testing'

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
