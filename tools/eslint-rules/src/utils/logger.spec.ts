import type { ScopedLogger } from './logger'
import { beforeEach } from 'node:test'
import { logger as mockNxLogger } from '@nx/devkit'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { logger, createRuleLogger, createNxScopedLogger } from './logger'

jest.mock('@nx/devkit', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('logger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each(['error', 'warn', 'log', 'info', 'debug'])('exposes the standard %s method', (method: keyof ScopedLogger) => {
    expect(typeof logger[method]).toBe('function')
  })

  it.each(['setLogLevel', 'getLogLevel'])('exposes the %s log level control method', (method: keyof ScopedLogger) => {
    expect(typeof logger[method]).toBe('function')
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

  it.each(['error', 'warn', 'log', 'info', 'debug', 'setLogLevel', 'getLogLevel'])(
    'creates a logger exposing %s with default options',
    (method: keyof ScopedLogger) => {
      expect(typeof createNxScopedLogger('test-namespace')[method]).toBe('function')
    }
  )

  it('respects custom log level option', () => {
    const scopedLogger = createNxScopedLogger('test-namespace', { level: 'debug' })
    expect(scopedLogger.getLogLevel()).toBe('debug')
  })

  it('allows changing log level via setLogLevel', () => {
    const scopedLogger = createNxScopedLogger('test-namespace')
    const levels = [scopedLogger.getLogLevel()]
    scopedLogger.setLogLevel('info')
    levels.push(scopedLogger.getLogLevel())
    expect(levels).toEqual(['error', 'info'])
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

  it.each([
    ['debug', 'Debug message'],
    ['info', 'Info message'],
    ['log', 'Log message'],
  ])('does not invoke nxLogger.%s below the warn level', (method: 'debug' | 'info' | 'log', message: string) => {
    const scopedLogger = createNxScopedLogger('my-namespace', { level: 'warn' })
    scopedLogger[method](message)
    expect(mockNxLogger[method]).not.toHaveBeenCalled()
  })

  it.each([
    ['warn', 'Warning message'],
    ['error', 'Error message'],
  ])('invokes nxLogger.%s at or above the warn level', (method: 'warn' | 'error', message: string) => {
    const scopedLogger = createNxScopedLogger('my-namespace', { level: 'warn' })
    scopedLogger[method](message)
    expect(mockNxLogger[method]).toHaveBeenCalledWith(`[my-namespace] ${message}`)
  })
})

describe('createRuleLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each(['error', 'warn', 'log', 'info', 'debug'])('creates a scoped logger instance exposing %s', (method: keyof ScopedLogger) => {
    expect(typeof createRuleLogger('test-rule')[method]).toBe('function')
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
