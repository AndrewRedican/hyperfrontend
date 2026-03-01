import { createLogger, type Logger } from './create-logger'
import { logAction } from './log-action'
import { logEvent } from './log-event'
import { type IAction, ACTION_TYPES } from '../../types/action'

describe('Logging Utilities', () => {
  describe('createLogger', () => {
    it('creates logger with debug level', () => {
      const logger = createLogger({ level: 'debug' })

      expect(logger).toBeDefined()
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    })

    it('creates logger with error level (default)', () => {
      const logger = createLogger({ level: 'error' })

      expect(logger).toBeDefined()
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    })

    it('creates different logger instances', () => {
      const logger1 = createLogger({ level: 'debug' })
      const logger2 = createLogger({ level: 'error' })

      // They should be different instances
      expect(logger1).not.toBe(logger2)
    })

    it('uses custom logger when provided', () => {
      const customLogger: Logger = {
        debug: jest.fn(),
        info: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
        getLogLevel: jest.fn(() => 'debug'),
      }

      const logger = createLogger({ customLogger })

      expect(logger).toBe(customLogger)
    })

    it('custom logger receives calls correctly', () => {
      const customLogger: Logger = {
        debug: jest.fn(),
        info: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
        getLogLevel: jest.fn(() => 'debug'),
      }

      const logger = createLogger({ customLogger })

      logger.error('error message', { data: 1 })
      logger.warn('warning message', 42)
      logger.info('info message')
      logger.debug('debug message', 'extra')

      expect(customLogger.error).toHaveBeenCalledWith('error message', { data: 1 })
      expect(customLogger.warn).toHaveBeenCalledWith('warning message', 42)
      expect(customLogger.info).toHaveBeenCalledWith('info message')
      expect(customLogger.debug).toHaveBeenCalledWith('debug message', 'extra')
    })

    it('custom logger is used regardless of level setting', () => {
      const customLogger: Logger = {
        debug: jest.fn(),
        info: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
        getLogLevel: jest.fn(() => 'debug'),
      }

      // Custom logger should be used directly
      const logger = createLogger({ level: 'error', customLogger })

      logger.debug('should still be logged')

      expect(customLogger.debug).toHaveBeenCalledWith('should still be logged')
    })

    it('falls back to library logger when no custom logger provided', () => {
      const logger = createLogger({ level: 'debug' })

      // Should have created a new logger, not be undefined
      expect(logger).toBeDefined()
      expect(logger.debug).toBeDefined()
      expect(logger.info).toBeDefined()
      expect(logger.warn).toBeDefined()
      expect(logger.error).toBeDefined()
    })

    it('debug is noop when level is error and no custom logger', () => {
      const logger = createLogger({ level: 'error' })
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation()

      // Call debug - should not invoke console.debug
      logger.debug('this should not appear')

      expect(debugSpy).not.toHaveBeenCalled()
      debugSpy.mockRestore()
    })

    describe('internal console wrapper functions', () => {
      it('calls console.error with prefix when logger.error is called', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation()
        const logger = createLogger({ level: 'debug' })

        logger.error('test error message', { data: 123 })

        expect(errorSpy).toHaveBeenCalledWith('[nexus]', 'test error message', { data: 123 })
        errorSpy.mockRestore()
      })

      it('calls console.warn with prefix when logger.warn is called', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        const logger = createLogger({ level: 'debug' })

        logger.warn('test warning', 42)

        expect(warnSpy).toHaveBeenCalledWith('[nexus]', 'test warning', 42)
        warnSpy.mockRestore()
      })

      it('calls console.info with prefix when logger.info is called', () => {
        const infoSpy = jest.spyOn(console, 'info').mockImplementation()
        const logger = createLogger({ level: 'debug' })

        logger.info('test info')

        expect(infoSpy).toHaveBeenCalledWith('[nexus]', 'test info')
        infoSpy.mockRestore()
      })

      it('calls console.debug with prefix when logger.debug is called and level is debug', () => {
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation()
        const logger = createLogger({ level: 'debug' })

        logger.debug('test debug', 'extra', 'args')

        expect(debugSpy).toHaveBeenCalledWith('[nexus]', 'test debug', 'extra', 'args')
        debugSpy.mockRestore()
      })

      it('handles multiple arguments in error', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation()
        const logger = createLogger({ level: 'debug' })

        logger.error('arg1', 'arg2', 'arg3', { nested: true })

        expect(errorSpy).toHaveBeenCalledWith('[nexus]', 'arg1', 'arg2', 'arg3', { nested: true })
        errorSpy.mockRestore()
      })

      it('handles no additional arguments in warn', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        const logger = createLogger({ level: 'debug' })

        logger.warn('only message')

        expect(warnSpy).toHaveBeenCalledWith('[nexus]', 'only message')
        warnSpy.mockRestore()
      })

      it('handles complex objects in info', () => {
        const infoSpy = jest.spyOn(console, 'info').mockImplementation()
        const logger = createLogger({ level: 'debug' })
        const complexObj = { a: 1, b: [1, 2, 3], c: { nested: true } }

        logger.info('info with object', complexObj)

        expect(infoSpy).toHaveBeenCalledWith('[nexus]', 'info with object', complexObj)
        infoSpy.mockRestore()
      })

      it('creates logger with options object', () => {
        const logger = createLogger({ level: 'warn' })

        expect(logger).toBeDefined()
        expect(logger.getLogLevel()).toBe('warn')
      })

      it('creates logger with custom prefix', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        const logger = createLogger({ level: 'warn', prefix: '[custom]' })
        logger.warn('test')

        expect(warnSpy).toHaveBeenCalledWith('[custom]', 'test')
        warnSpy.mockRestore()
      })

      it('uses customLogger from options object', () => {
        const customLogger: Logger = {
          error: jest.fn(),
          warn: jest.fn(),
          log: jest.fn(),
          info: jest.fn(),
          debug: jest.fn(),
          setLogLevel: jest.fn(),
          getLogLevel: jest.fn(() => 'debug'),
        }

        const logger = createLogger({ customLogger })

        expect(logger).toBe(customLogger)
      })

      it('creates logger with default options when empty object passed', () => {
        const logger = createLogger({})

        expect(logger).toBeDefined()
        expect(logger.getLogLevel()).toBe('error')
      })

      it('creates logger with default options when no arguments passed', () => {
        const logger = createLogger()

        expect(logger).toBeDefined()
        expect(logger.getLogLevel()).toBe('error')
      })
    })
  })

  describe('logAction', () => {
    let mockLogger: Logger

    beforeEach(() => {
      mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        log: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        setLogLevel: jest.fn(),
        getLogLevel: jest.fn(() => 'debug'),
      }
    })

    it('logs sent action', () => {
      const action: IAction = {
        type: ACTION_TYPES.REQUEST_CONNECTION,
        senderId: 'sender-123',
        processId: 'process-789',
        contract: { accepted: [], emitted: [] },
      }

      logAction(mockLogger, action, 'sent')

      expect(mockLogger.debug).toHaveBeenCalledWith('Action sent:', ACTION_TYPES.REQUEST_CONNECTION, action)
    })

    it('logs received action', () => {
      const action: IAction = {
        type: ACTION_TYPES.ACCEPT_CONNECTION,
        senderId: 'sender-123',
        processId: 'process-789',
        contract: { accepted: [], emitted: [] },
      }

      logAction(mockLogger, action, 'received')

      expect(mockLogger.debug).toHaveBeenCalledWith('Action received:', ACTION_TYPES.ACCEPT_CONNECTION, action)
    })

    it('logs different action types', () => {
      const actionTypes = [
        ACTION_TYPES.REQUEST_CONNECTION,
        ACTION_TYPES.ACCEPT_CONNECTION,
        ACTION_TYPES.DENY_CONNECTION,
        ACTION_TYPES.CANCEL_CONNECTION,
        ACTION_TYPES.OPEN_CONNECTION,
        ACTION_TYPES.CLOSE_CONNECTION,
        ACTION_TYPES.DESTROY_CONNECTION,
        ACTION_TYPES.NEW_MESSAGE,
        ACTION_TYPES.INVALID_REQUEST,
      ] as const

      actionTypes.forEach((type) => {
        let action: IAction

        // Create appropriate action structure based on type
        if (type === ACTION_TYPES.REQUEST_CONNECTION || type === ACTION_TYPES.ACCEPT_CONNECTION) {
          action = {
            type,
            senderId: 'sender',
            processId: 'process',
            contract: { accepted: [], emitted: [] },
          }
        } else if (type === ACTION_TYPES.NEW_MESSAGE) {
          action = {
            type,
            senderId: 'sender',
            data: {},
          }
        } else if (type === ACTION_TYPES.DENY_CONNECTION || type === ACTION_TYPES.INVALID_REQUEST) {
          action = {
            type,
            senderId: 'sender',
            processId: 'process',
            error: 'test error',
          }
        } else if (type === ACTION_TYPES.DESTROY_CONNECTION) {
          action = {
            type,
            senderId: 'sender',
          }
        } else {
          action = {
            type,
            senderId: 'sender',
            processId: 'process',
          }
        }

        ;(<jest.Mock>mockLogger.debug).mockClear()
        logAction(mockLogger, action, 'sent')

        expect(mockLogger.debug).toHaveBeenCalledWith('Action sent:', type, action)
      })
    })
  })

  describe('logEvent', () => {
    let mockLogger: Logger

    beforeEach(() => {
      mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        log: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        setLogLevel: jest.fn(),
        getLogLevel: jest.fn(() => 'debug'),
      }
    })

    it('logs OPEN event', () => {
      const eventData = { channelId: 'channel-123' }

      logEvent(mockLogger, 'open', eventData)

      expect(mockLogger.debug).toHaveBeenCalledWith('Channel event:', 'open', eventData)
    })

    it('logs CLOSE event', () => {
      const eventData = { reason: 'User requested' }

      logEvent(mockLogger, 'close', eventData)

      expect(mockLogger.debug).toHaveBeenCalledWith('Channel event:', 'close', eventData)
    })

    it('logs CANCEL event', () => {
      const eventData = { cancelReason: 'Timeout' }

      logEvent(mockLogger, 'cancel', eventData)

      expect(mockLogger.debug).toHaveBeenCalledWith('Channel event:', 'cancel', eventData)
    })

    it('logs DENY event', () => {
      const eventData = { denyReason: 'Security policy' }

      logEvent(mockLogger, 'deny', eventData)

      expect(mockLogger.debug).toHaveBeenCalledWith('Channel event:', 'deny', eventData)
    })

    it('logs INVALID event', () => {
      const eventData = { error: 'Invalid action' }

      logEvent(mockLogger, 'invalid', eventData)

      expect(mockLogger.debug).toHaveBeenCalledWith('Channel event:', 'invalid', eventData)
    })

    it('logs event with undefined data', () => {
      logEvent(mockLogger, 'open', undefined)

      expect(mockLogger.debug).toHaveBeenCalledWith('Channel event:', 'open', undefined)
    })

    it('logs event with complex data', () => {
      const complexData = {
        nested: {
          value: 123,
          array: [1, 2, 3],
        },
        message: 'Complex event data',
      }

      logEvent(mockLogger, 'close', complexData)

      expect(mockLogger.debug).toHaveBeenCalledWith('Channel event:', 'close', complexData)
    })
  })

  describe('Integration', () => {
    it('works together for action logging flow', () => {
      const mockLogger: Logger = {
        error: jest.fn(),
        warn: jest.fn(),
        log: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        setLogLevel: jest.fn(),
        getLogLevel: jest.fn(() => 'debug'),
      }

      const action: IAction = {
        type: ACTION_TYPES.NEW_MESSAGE,
        senderId: 'sender',
        data: { message: 'Hello' },
      }

      // Log sending
      logAction(mockLogger, action, 'sent')
      expect(mockLogger.debug).toHaveBeenCalledWith('Action sent:', ACTION_TYPES.NEW_MESSAGE, action)
      ;(<jest.Mock>mockLogger.debug).mockClear()

      // Log receiving
      logAction(mockLogger, action, 'received')
      expect(mockLogger.debug).toHaveBeenCalledWith('Action received:', ACTION_TYPES.NEW_MESSAGE, action)
    })

    it('works together for event logging flow', () => {
      const mockLogger: Logger = {
        error: jest.fn(),
        warn: jest.fn(),
        log: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        setLogLevel: jest.fn(),
        getLogLevel: jest.fn(() => 'debug'),
      }

      // Log connection lifecycle
      logEvent(mockLogger, 'open', { channelId: '1' })
      expect(mockLogger.debug).toHaveBeenNthCalledWith(1, 'Channel event:', 'open', { channelId: '1' })

      logEvent(mockLogger, 'close', { reason: 'done' })
      expect(mockLogger.debug).toHaveBeenNthCalledWith(2, 'Channel event:', 'close', { reason: 'done' })

      expect(mockLogger.debug).toHaveBeenCalledTimes(2)
    })
  })
})
