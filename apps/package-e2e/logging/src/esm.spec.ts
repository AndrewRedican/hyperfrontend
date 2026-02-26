/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/logging
 * Tests that the package is importable and exports work correctly.
 */

import { jest } from '@jest/globals'

describe('@hyperfrontend/logging ESM', () => {
  it('should be importable', async () => {
    const logging = await import('@hyperfrontend/logging')
    expect(logging).toBeDefined()
  })

  it('should export createLogger function', async () => {
    const { createLogger } = await import('@hyperfrontend/logging')
    expect(typeof createLogger).toBe('function')
  })

  it('should create a logger with info method', async () => {
    const { createLogger } = await import('@hyperfrontend/logging')

    const mockError = jest.fn()
    const mockWarn = jest.fn()
    const mockLog = jest.fn()
    const mockInfo = jest.fn()

    const logger = createLogger(mockError, mockWarn, mockLog, mockInfo)

    expect(logger).toBeDefined()
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.log).toBe('function')
  })

  it('should export isValidLogger function', async () => {
    const { isValidLogger, createLogger } = await import('@hyperfrontend/logging')
    expect(typeof isValidLogger).toBe('function')

    const logger = createLogger(jest.fn())
    expect(isValidLogger(logger)).toBe(true)
  })
})
