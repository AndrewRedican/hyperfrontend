import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidLogLevel, createLogLevelConfig } from './create-log-level-config'

describe('Log Level Configuration Tests', () => {
  it('returns true for valid log levels', () => {
    expect(isValidLogLevel('none')).toBe(true)
    expect(isValidLogLevel('error')).toBe(true)
    expect(isValidLogLevel('warn')).toBe(true)
    expect(isValidLogLevel('log')).toBe(true)
    expect(isValidLogLevel('info')).toBe(true)
    expect(isValidLogLevel('debug')).toBe(true)
  })

  it('returns false for invalid log levels', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(isValidLogLevel('querty' as any)).toBe(false)
  })

  describe('createLogLevelConfig', () => {
    it('creates a log level config with default level as error', () => {
      const config = createLogLevelConfig()
      expect(config.getLogLevel()).toBe('error')
    })

    it('creates a log level config with a specified valid level', () => {
      const config = createLogLevelConfig('warn')
      expect(config.getLogLevel()).toBe('warn')
    })

    it('throws an error when created with an invalid log level', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => createLogLevelConfig('qwerty' as any)).toThrow(Error)
    })

    it('returns an immutable log level configuration', () => {
      const config = createLogLevelConfig()
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(config as any).newProp = 'test'
      }).toThrow()
    })

    describe('getLogLevel', () => {
      it('returns the current log level', () => {
        const config = createLogLevelConfig('info')
        expect(config.getLogLevel()).toBe('info')
      })
    })

    describe('setLogLevel', () => {
      it('updates the log level', () => {
        const config = createLogLevelConfig('log')
        config.setLogLevel('debug')
        expect(config.getLogLevel()).toBe('debug')
      })

      it('throws an error for invalid log levels', () => {
        const config = createLogLevelConfig()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(() => config.setLogLevel('qwerty' as any)).toThrow(Error)
      })
    })

    describe('shouldLog', () => {
      it('returns true if the level is equal or higher priority than current level', () => {
        const config = createLogLevelConfig('warn')
        expect(config.shouldLog('error')).toBe(true)
        expect(config.shouldLog('warn')).toBe(true)
      })

      it('returns false if the level is lower priority than current level', () => {
        const config = createLogLevelConfig('warn')
        expect(config.shouldLog('log')).toBe(false)
      })

      it('returns false if the level is invalid', () => {
        const config = createLogLevelConfig()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(config.shouldLog('qwerty' as any)).toBe(false)
      })

      it('returns false if current level is none', () => {
        const config = createLogLevelConfig('none')
        expect(config.shouldLog('error')).toBe(false)
      })
    })
  })
})
