// Mock @nx/devkit logger - must be defined before jest.mock hoisting
jest.mock('@nx/devkit', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

const { logger: mockNxLogger } = require('@nx/devkit')

import { logger, createRuleLogger, createNxScopedLogger } from './logger'

describe('logger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exposes standard log methods', () => {
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.warn).toBe('function')
    expect(typeof logger.log).toBe('function')
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.debug).toBe('function')
  })

  it('exposes log level control methods', () => {
    expect(typeof logger.setLogLevel).toBe('function')
    expect(typeof logger.getLogLevel).toBe('function')
  })

  it('defaults to error log level', () => {
    const testLogger = createNxScopedLogger('test')
    expect(testLogger.getLogLevel()).toBe('error')
  })
})

describe('createNxScopedLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a logger with default options', () => {
    const scopedLogger = createNxScopedLogger('test-namespace')
    expect(typeof scopedLogger.error).toBe('function')
    expect(typeof scopedLogger.warn).toBe('function')
    expect(typeof scopedLogger.log).toBe('function')
    expect(typeof scopedLogger.info).toBe('function')
    expect(typeof scopedLogger.debug).toBe('function')
    expect(typeof scopedLogger.setLogLevel).toBe('function')
    expect(typeof scopedLogger.getLogLevel).toBe('function')
  })

  it('respects custom log level option', () => {
    const scopedLogger = createNxScopedLogger('test-namespace', { level: 'debug' })
    expect(scopedLogger.getLogLevel()).toBe('debug')
  })

  it('allows changing log level via setLogLevel', () => {
    const scopedLogger = createNxScopedLogger('test-namespace')
    expect(scopedLogger.getLogLevel()).toBe('error')
    scopedLogger.setLogLevel('info')
    expect(scopedLogger.getLogLevel()).toBe('info')
  })
})

describe('createNxScopedLogger invocation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('invokes nxLogger.error with namespaced message', () => {
    const scopedLogger = createNxScopedLogger('my-namespace', { level: 'error' })
    scopedLogger.error('Something went wrong')
    expect(mockNxLogger.error).toHaveBeenCalledWith('[my-namespace] Something went wrong')
  })

  it('invokes nxLogger.warn with namespaced message', () => {
    const scopedLogger = createNxScopedLogger('my-namespace', { level: 'warn' })
    scopedLogger.warn('Warning message')
    expect(mockNxLogger.warn).toHaveBeenCalledWith('[my-namespace] Warning message')
  })

  it('invokes nxLogger.log with namespaced message', () => {
    const scopedLogger = createNxScopedLogger('my-namespace', { level: 'log' })
    scopedLogger.log('Log message')
    expect(mockNxLogger.log).toHaveBeenCalledWith('[my-namespace] Log message')
  })

  it('invokes nxLogger.info with namespaced message', () => {
    const scopedLogger = createNxScopedLogger('my-namespace', { level: 'info' })
    scopedLogger.info('Info message')
    expect(mockNxLogger.info).toHaveBeenCalledWith('[my-namespace] Info message')
  })

  it('invokes nxLogger.debug with namespaced message', () => {
    const scopedLogger = createNxScopedLogger('my-namespace', { level: 'debug' })
    scopedLogger.debug('Debug message')
    expect(mockNxLogger.debug).toHaveBeenCalledWith('[my-namespace] Debug message')
  })

  it('appends stringified metadata to log message', () => {
    const scopedLogger = createNxScopedLogger('my-namespace', { level: 'info' })
    scopedLogger.info('Processing file', { file: 'index.ts', line: 42 })
    expect(mockNxLogger.info).toHaveBeenCalledWith('[my-namespace] Processing file {"file":"index.ts","line":42}')
  })

  it('sanitizes sensitive data in metadata', () => {
    const scopedLogger = createNxScopedLogger('my-namespace', { level: 'info' })
    scopedLogger.info('Config loaded', { apiKey: 'secret123', name: 'app' })
    expect(mockNxLogger.info).toHaveBeenCalledWith('[my-namespace] Config loaded {"apiKey":"[REDACTED]","name":"app"}')
  })

  it('respects log level filtering - does not invoke lower priority logs', () => {
    const scopedLogger = createNxScopedLogger('my-namespace', { level: 'warn' })
    scopedLogger.debug('Debug message')
    scopedLogger.info('Info message')
    scopedLogger.log('Log message')
    // These should not be called because level is 'warn'
    expect(mockNxLogger.debug).not.toHaveBeenCalled()
    expect(mockNxLogger.info).not.toHaveBeenCalled()
    expect(mockNxLogger.log).not.toHaveBeenCalled()
  })

  it('invokes logs at or above the set level', () => {
    const scopedLogger = createNxScopedLogger('my-namespace', { level: 'warn' })
    scopedLogger.warn('Warning message')
    scopedLogger.error('Error message')
    expect(mockNxLogger.warn).toHaveBeenCalledWith('[my-namespace] Warning message')
    expect(mockNxLogger.error).toHaveBeenCalledWith('[my-namespace] Error message')
  })
})

describe('createRuleLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a scoped logger instance', () => {
    const ruleLogger = createRuleLogger('test-rule')
    expect(typeof ruleLogger.error).toBe('function')
    expect(typeof ruleLogger.warn).toBe('function')
    expect(typeof ruleLogger.log).toBe('function')
    expect(typeof ruleLogger.info).toBe('function')
    expect(typeof ruleLogger.debug).toBe('function')
  })

  it('creates independent logger instances', () => {
    const logger1 = createRuleLogger('rule-1')
    const logger2 = createRuleLogger('rule-2')
    expect(logger1).not.toBe(logger2)
  })

  it('creates logger with default error level', () => {
    const ruleLogger = createRuleLogger('test-rule')
    expect(ruleLogger.getLogLevel()).toBe('error')
  })

  it('uses eslint-rules:scope namespace format', () => {
    const ruleLogger = createRuleLogger('deepest-import-path')
    ruleLogger.setLogLevel('error')
    ruleLogger.error('Rule violation')
    expect(mockNxLogger.error).toHaveBeenCalledWith('[eslint-rules:deepest-import-path] Rule violation')
  })
})
