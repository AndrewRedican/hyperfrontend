import { beforeEach, afterEach } from 'node:test'
import { describe, it, expect, jest } from '@hyperfrontend/testing'
import { createScopedLogger, sanitize, logger, setGlobalLogLevel, getGlobalLogLevel, resetGlobalLogLevel } from './logger'

describe('core/logger', () => {
  describe('sanitize', () => {
    it('returns null for null input', () => {
      expect(sanitize(null)).toBeNull()
    })

    it('returns undefined for undefined input', () => {
      expect(sanitize(undefined)).toBeUndefined()
    })

    it('returns primitive values unchanged', () => {
      expect(sanitize('hello')).toBe('hello')
      expect(sanitize(42)).toBe(42)
      expect(sanitize(true)).toBe(true)
    })

    it('redacts keys containing "token"', () => {
      const result = sanitize({ accessToken: 'secret123' })
      expect(result).toEqual({ accessToken: '[REDACTED]' })
    })

    it('redacts keys containing "key"', () => {
      const result = sanitize({ apiKey: 'abc123', publicData: 'visible' })
      expect(result).toEqual({ apiKey: '[REDACTED]', publicData: 'visible' })
    })

    it('redacts keys containing "password"', () => {
      const result = sanitize({ password: 'mysecret', username: 'user' })
      expect(result).toEqual({ password: '[REDACTED]', username: 'user' })
    })

    it('redacts keys containing "secret"', () => {
      const result = sanitize({ clientSecret: 'shhh' })
      expect(result).toEqual({ clientSecret: '[REDACTED]' })
    })

    it('redacts keys containing "credential"', () => {
      const result = sanitize({ userCredential: 'cred123' })
      expect(result).toEqual({ userCredential: '[REDACTED]' })
    })

    it('redacts keys containing "auth"', () => {
      const result = sanitize({ authToken: 'auth123', authorization: 'Bearer xyz' })
      expect(result).toEqual({ authToken: '[REDACTED]', authorization: '[REDACTED]' })
    })

    it('redacts keys containing "bearer"', () => {
      const result = sanitize({ bearerToken: 'xyz789' })
      expect(result).toEqual({ bearerToken: '[REDACTED]' })
    })

    it('redacts keys containing "private"', () => {
      const result = sanitize({ privateKey: 'key123' })
      expect(result).toEqual({ privateKey: '[REDACTED]' })
    })

    it('redacts keys containing "passphrase"', () => {
      const result = sanitize({ sshPassphrase: 'phrase' })
      expect(result).toEqual({ sshPassphrase: '[REDACTED]' })
    })

    it('handles nested objects', () => {
      const result = sanitize({
        config: {
          apiKey: 'secret',
          name: 'test',
        },
        path: '/project',
      })
      expect(result).toEqual({
        config: {
          apiKey: '[REDACTED]',
          name: 'test',
        },
        path: '/project',
      })
    })

    it('handles arrays', () => {
      const result = sanitize([{ token: 'abc' }, { data: 'visible' }])
      expect(result).toEqual([{ token: '[REDACTED]' }, { data: 'visible' }])
    })

    it('handles deeply nested structures', () => {
      const result = sanitize({
        level1: {
          level2: {
            level3: {
              password: 'deep-secret',
              name: 'nested',
            },
          },
        },
      })
      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              password: '[REDACTED]',
              name: 'nested',
            },
          },
        },
      })
    })

    it('is case-insensitive for key matching', () => {
      const result = sanitize({
        APIKEY: 'upper',
        ApiKey: 'mixed',
        apikey: 'lower',
      })
      expect(result).toEqual({
        APIKEY: '[REDACTED]',
        ApiKey: '[REDACTED]',
        apikey: '[REDACTED]',
      })
    })
  })

  describe('createScopedLogger', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation()
      jest.spyOn(console, 'warn').mockImplementation()
      jest.spyOn(console, 'log').mockImplementation()
      jest.spyOn(console, 'info').mockImplementation()
      jest.spyOn(console, 'debug').mockImplementation()
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('creates a logger with all expected methods', () => {
      const log = createScopedLogger('test-ns', { level: 'info' })
      expect(log.error).toBeDefined()
      expect(log.warn).toBeDefined()
      expect(log.log).toBeDefined()
      expect(log.info).toBeDefined()
      expect(log.debug).toBeDefined()
      expect(log.setLogLevel).toBeDefined()
      expect(log.getLogLevel).toBeDefined()
    })

    it('can call logging methods without error', () => {
      const log = createScopedLogger('test-ns', { level: 'debug' })
      expect(() => log.error('Error message')).not.toThrow()
      expect(() => log.warn('Warning message')).not.toThrow()
      expect(() => log.log('Log message')).not.toThrow()
      expect(() => log.info('Info message')).not.toThrow()
      expect(() => log.debug('Debug message')).not.toThrow()
    })

    it('can call logging methods with metadata', () => {
      const log = createScopedLogger('test-ns', { level: 'debug' })
      expect(() => log.info('Message', { key: 'value' })).not.toThrow()
      expect(() => log.debug('Debug', { nested: { deep: true } })).not.toThrow()
    })

    it('defaults to error level', () => {
      const log = createScopedLogger('test')
      expect(log.getLogLevel()).toBe('error')
    })

    it('respects initial log level option', () => {
      const log = createScopedLogger('test', { level: 'debug' })
      expect(log.getLogLevel()).toBe('debug')
    })

    it('can change log level', () => {
      const log = createScopedLogger('test')
      log.setLogLevel('info')
      expect(log.getLogLevel()).toBe('info')
    })

    it('accepts sanitizeSecrets option', () => {
      expect(() => createScopedLogger('test', { sanitizeSecrets: true })).not.toThrow()
      expect(() => createScopedLogger('test', { sanitizeSecrets: false })).not.toThrow()
    })

    it('sanitizes secrets in metadata when sanitizeSecrets is true', () => {
      const log = createScopedLogger('test', { level: 'debug', sanitizeSecrets: true })
      expect(() => log.info('Config', { apiKey: 'secret', password: 'test' })).not.toThrow()
    })
  })

  describe('default logger', () => {
    it('is exported and has correct namespace', () => {
      expect(logger).toBeDefined()
      expect(logger.getLogLevel).toBeDefined()
      expect(logger.setLogLevel).toBeDefined()
      expect(logger.error).toBeDefined()
      expect(logger.warn).toBeDefined()
      expect(logger.log).toBeDefined()
      expect(logger.info).toBeDefined()
      expect(logger.debug).toBeDefined()
    })
  })

  describe('global log level management', () => {
    afterEach(() => {
      resetGlobalLogLevel()
    })

    it('setGlobalLogLevel sets level for all registered loggers', () => {
      const testLogger1 = createScopedLogger('test-global-1')
      const testLogger2 = createScopedLogger('test-global-2')

      setGlobalLogLevel('debug')

      expect(testLogger1.getLogLevel()).toBe('debug')
      expect(testLogger2.getLogLevel()).toBe('debug')
    })

    it('getGlobalLogLevel returns current global level', () => {
      expect(getGlobalLogLevel()).toBeNull()

      setGlobalLogLevel('warn')
      expect(getGlobalLogLevel()).toBe('warn')
    })

    it('resetGlobalLogLevel clears global override', () => {
      setGlobalLogLevel('info')
      expect(getGlobalLogLevel()).toBe('info')

      resetGlobalLogLevel()
      expect(getGlobalLogLevel()).toBeNull()
    })

    it('new loggers use global level when set', () => {
      setGlobalLogLevel('debug')

      const newLogger = createScopedLogger('new-test-logger')
      expect(newLogger.getLogLevel()).toBe('debug')
    })
  })
})
