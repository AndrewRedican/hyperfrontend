/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/logging
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/logging CJS', () => {
  it('should be requireable', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const logging = require('@hyperfrontend/logging')
    expect(logging).toBeDefined()
  })

  it('should export createLogger function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createLogger } = require('@hyperfrontend/logging')
    expect(typeof createLogger).toBe('function')
  })

  it('should create a logger with info method', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createLogger } = require('@hyperfrontend/logging')

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

  it('should export isValidLogger function', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isValidLogger, createLogger } = require('@hyperfrontend/logging')
    expect(typeof isValidLogger).toBe('function')

    const logger = createLogger(jest.fn())
    expect(isValidLogger(logger)).toBe(true)
  })
})
