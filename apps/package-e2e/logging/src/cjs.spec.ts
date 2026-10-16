/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/logging`
 * Tests that the package is requireable and exports work correctly.
 */

'use strict'

const { describe, it, expect, jest } = require('@hyperfrontend/testing')

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
