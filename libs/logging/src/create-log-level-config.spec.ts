import type { LogLevel } from './create-log-level-config'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isValidLogLevel, createLogLevelConfig } from './create-log-level-config'

describe('Log Level Configuration Tests', () => {
  it.each(['none', 'error', 'warn', 'log', 'info', 'debug'])('returns true for the valid log level %s', (level: string) => {
    expect(isValidLogLevel(level)).toBe(true)
  })

  it('returns false for invalid log levels', () => {
    expect(isValidLogLevel('querty')).toBe(false)
  })

  it('returns false for a value that is not a string', () => {
    expect(isValidLogLevel(42)).toBe(false)
  })

  it('narrows an unknown value to a log level', () => {
    const level: unknown = 'debug'
    expect(isValidLogLevel(level) ? createLogLevelConfig(level).getLogLevel() : 'not narrowed').toBe('debug')
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
      // lint-disable-next-line typescript/no-explicit-any
      expect(() => createLogLevelConfig('qwerty' as any)).toThrow(Error)
    })

    it('names the rejected value in the error thrown for an invalid log level', () => {
      // lint-disable-next-line typescript/no-explicit-any
      expect(() => createLogLevelConfig('qwerty' as any)).toThrow(
        "Cannot create log level configuration with invalid default level 'qwerty'."
      )
    })

    it('returns an immutable log level configuration', () => {
      const config = createLogLevelConfig()
      expect(() => {
        // lint-disable-next-line typescript/no-explicit-any
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
        // lint-disable-next-line typescript/no-explicit-any
        expect(() => config.setLogLevel('qwerty' as any)).toThrow(Error)
      })
    })

    describe('shouldLog', () => {
      it.each(['error', 'warn'])('returns true for %s, equal or higher priority than the current warn level', (level: LogLevel) => {
        const config = createLogLevelConfig('warn')
        expect(config.shouldLog(level)).toBe(true)
      })

      it('returns false if the level is lower priority than current level', () => {
        const config = createLogLevelConfig('warn')
        expect(config.shouldLog('log')).toBe(false)
      })

      it('returns false if the level is invalid', () => {
        const config = createLogLevelConfig()
        // lint-disable-next-line typescript/no-explicit-any
        expect(config.shouldLog('qwerty' as any)).toBe(false)
      })

      it('returns false if current level is none', () => {
        const config = createLogLevelConfig('none')
        expect(config.shouldLog('error')).toBe(false)
      })
    })
  })
})
