import { createLogger, type Logger } from './create-logger'
import { logAction } from './log-action'
import { logEvent } from './log-event'
import { type IAction, ACTION_TYPES } from '../../types/action'

describe('Logging Utilities', () => {
  describe('createLogger', () => {
    it('creates logger with debug enabled', () => {
      const logger = createLogger(true)

      expect(logger).toBeDefined()
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    })

    it('creates logger with debug disabled', () => {
      const logger = createLogger(false)

      expect(logger).toBeDefined()
      expect(typeof logger.debug).toBe('function')
      expect(typeof logger.info).toBe('function')
      expect(typeof logger.warn).toBe('function')
      expect(typeof logger.error).toBe('function')
    })

    it('creates different logger instances', () => {
      const logger1 = createLogger(true)
      const logger2 = createLogger(false)

      // They should be different instances
      expect(logger1).not.toBe(logger2)
    })

    it('uses custom logger when provided', () => {
      const customLogger: Logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
        getLogLevel: jest.fn(() => 'debug'),
      }

      const logger = createLogger(true, customLogger)

      expect(logger).toBe(customLogger)
    })

    it('custom logger receives calls correctly', () => {
      const customLogger: Logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
        getLogLevel: jest.fn(() => 'debug'),
      }

      const logger = createLogger(true, customLogger)

      logger.error('error message', { data: 1 })
      logger.warn('warning message', 42)
      logger.info('info message')
      logger.debug('debug message', 'extra')

      expect(customLogger.error).toHaveBeenCalledWith('error message', { data: 1 })
      expect(customLogger.warn).toHaveBeenCalledWith('warning message', 42)
      expect(customLogger.info).toHaveBeenCalledWith('info message')
      expect(customLogger.debug).toHaveBeenCalledWith('debug message', 'extra')
    })

    it('ignores debug flag when custom logger is provided', () => {
      const customLogger: Logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
        getLogLevel: jest.fn(() => 'debug'),
      }

      // Even with debug=false, custom logger's debug should still be called
      const logger = createLogger(false, customLogger)

      logger.debug('should still be logged')

      expect(customLogger.debug).toHaveBeenCalledWith('should still be logged')
    })

    it('falls back to library logger when no custom logger provided', () => {
      const logger = createLogger(true)

      // Should have created a new logger, not be undefined
      expect(logger).toBeDefined()
      expect(logger.debug).toBeDefined()
      expect(logger.info).toBeDefined()
      expect(logger.warn).toBeDefined()
      expect(logger.error).toBeDefined()
    })

    it('debug is noop when debug disabled and no custom logger', () => {
      const logger = createLogger(false)
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation()

      // Call debug - should not invoke console.debug
      logger.debug('this should not appear')

      expect(debugSpy).not.toHaveBeenCalled()
      debugSpy.mockRestore()
    })

    describe('internal console wrapper functions', () => {
      it('calls console.error with prefix when logger.error is called', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation()
        const logger = createLogger(true)
        logger.setLogLevel('debug')

        logger.error('test error message', { data: 123 })

        expect(errorSpy).toHaveBeenCalledWith('[nexus]', 'test error message', { data: 123 })
        errorSpy.mockRestore()
      })

      it('calls console.warn with prefix when logger.warn is called', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        const logger = createLogger(true)
        logger.setLogLevel('debug')

        logger.warn('test warning', 42)

        expect(warnSpy).toHaveBeenCalledWith('[nexus]', 'test warning', 42)
        warnSpy.mockRestore()
      })

      it('calls console.info with prefix when logger.info is called', () => {
        const infoSpy = jest.spyOn(console, 'info').mockImplementation()
        const logger = createLogger(true)
        logger.setLogLevel('debug')

        logger.info('test info')

        expect(infoSpy).toHaveBeenCalledWith('[nexus]', 'test info')
        infoSpy.mockRestore()
      })

      it('calls console.debug with prefix when logger.debug is called and debug is enabled', () => {
        const debugSpy = jest.spyOn(console, 'debug').mockImplementation()
        const logger = createLogger(true)
        logger.setLogLevel('debug')

        logger.debug('test debug', 'extra', 'args')

        expect(debugSpy).toHaveBeenCalledWith('[nexus]', 'test debug', 'extra', 'args')
        debugSpy.mockRestore()
      })

      it('handles multiple arguments in error', () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation()
        const logger = createLogger(false)
        logger.setLogLevel('debug')

        logger.error('arg1', 'arg2', 'arg3', { nested: true })

        expect(errorSpy).toHaveBeenCalledWith('[nexus]', 'arg1', 'arg2', 'arg3', { nested: true })
        errorSpy.mockRestore()
      })

      it('handles no additional arguments in warn', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation()
        const logger = createLogger(false)
        logger.setLogLevel('debug')

        logger.warn('only message')

        expect(warnSpy).toHaveBeenCalledWith('[nexus]', 'only message')
        warnSpy.mockRestore()
      })

      it('handles complex objects in info', () => {
        const infoSpy = jest.spyOn(console, 'info').mockImplementation()
        const logger = createLogger(false)
        logger.setLogLevel('debug')
        const complexObj = { a: 1, b: [1, 2, 3], c: { nested: true } }

        logger.info('info with object', complexObj)

        expect(infoSpy).toHaveBeenCalledWith('[nexus]', 'info with object', complexObj)
        infoSpy.mockRestore()
      })
    })
  })

  describe('logAction', () => {
    let logger: Logger
    let debugSpy: jest.SpyInstance

    beforeEach(() => {
      logger = createLogger(true)
      debugSpy = jest.spyOn(logger, 'debug')
    })

    afterEach(() => {
      debugSpy.mockRestore()
    })

    it('logs sent action', () => {
      const action: IAction = {
        type: ACTION_TYPES.REQUEST_CONNECTION,
        senderId: 'sender-123',
        processId: 'process-789',
        contract: { accepted: [], emitted: [] },
      }

      logAction(logger, action, 'sent')

      expect(debugSpy).toHaveBeenCalledWith('Action sent:', ACTION_TYPES.REQUEST_CONNECTION, action)
    })

    it('logs received action', () => {
      const action: IAction = {
        type: ACTION_TYPES.ACCEPT_CONNECTION,
        senderId: 'sender-123',
        processId: 'process-789',
        contract: { accepted: [], emitted: [] },
      }

      logAction(logger, action, 'received')

      expect(debugSpy).toHaveBeenCalledWith('Action received:', ACTION_TYPES.ACCEPT_CONNECTION, action)
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

        debugSpy.mockClear()
        logAction(logger, action, 'sent')

        expect(debugSpy).toHaveBeenCalledWith('Action sent:', type, action)
      })
    })
  })

  describe('logEvent', () => {
    let logger: Logger
    let debugSpy: jest.SpyInstance

    beforeEach(() => {
      logger = createLogger(true)
      debugSpy = jest.spyOn(logger, 'debug')
    })

    afterEach(() => {
      debugSpy.mockRestore()
    })

    it('logs OPEN event', () => {
      const eventData = { channelId: 'channel-123' }

      logEvent(logger, 'open', eventData)

      expect(debugSpy).toHaveBeenCalledWith('Channel event:', 'open', eventData)
    })

    it('logs CLOSE event', () => {
      const eventData = { reason: 'User requested' }

      logEvent(logger, 'close', eventData)

      expect(debugSpy).toHaveBeenCalledWith('Channel event:', 'close', eventData)
    })

    it('logs CANCEL event', () => {
      const eventData = { cancelReason: 'Timeout' }

      logEvent(logger, 'cancel', eventData)

      expect(debugSpy).toHaveBeenCalledWith('Channel event:', 'cancel', eventData)
    })

    it('logs DENY event', () => {
      const eventData = { denyReason: 'Security policy' }

      logEvent(logger, 'deny', eventData)

      expect(debugSpy).toHaveBeenCalledWith('Channel event:', 'deny', eventData)
    })

    it('logs INVALID event', () => {
      const eventData = { error: 'Invalid action' }

      logEvent(logger, 'invalid', eventData)

      expect(debugSpy).toHaveBeenCalledWith('Channel event:', 'invalid', eventData)
    })

    it('logs event with undefined data', () => {
      logEvent(logger, 'open', undefined)

      expect(debugSpy).toHaveBeenCalledWith('Channel event:', 'open', undefined)
    })

    it('logs event with complex data', () => {
      const complexData = {
        nested: {
          value: 123,
          array: [1, 2, 3],
        },
        message: 'Complex event data',
      }

      logEvent(logger, 'close', complexData)

      expect(debugSpy).toHaveBeenCalledWith('Channel event:', 'close', complexData)
    })
  })

  describe('Integration', () => {
    it('works together for action logging flow', () => {
      const logger = createLogger(true)
      const debugSpy = jest.spyOn(logger, 'debug')

      const action: IAction = {
        type: ACTION_TYPES.NEW_MESSAGE,
        senderId: 'sender',
        data: { message: 'Hello' },
      }

      // Log sending
      logAction(logger, action, 'sent')
      expect(debugSpy).toHaveBeenCalledWith('Action sent:', ACTION_TYPES.NEW_MESSAGE, action)

      debugSpy.mockClear()

      // Log receiving
      logAction(logger, action, 'received')
      expect(debugSpy).toHaveBeenCalledWith('Action received:', ACTION_TYPES.NEW_MESSAGE, action)

      debugSpy.mockRestore()
    })

    it('works together for event logging flow', () => {
      const logger = createLogger(true)
      const debugSpy = jest.spyOn(logger, 'debug')

      // Log connection lifecycle
      logEvent(logger, 'open', { channelId: '1' })
      expect(debugSpy).toHaveBeenNthCalledWith(1, 'Channel event:', 'open', { channelId: '1' })

      logEvent(logger, 'close', { reason: 'done' })
      expect(debugSpy).toHaveBeenNthCalledWith(2, 'Channel event:', 'close', { reason: 'done' })

      expect(debugSpy).toHaveBeenCalledTimes(2)

      debugSpy.mockRestore()
    })
  })
})
