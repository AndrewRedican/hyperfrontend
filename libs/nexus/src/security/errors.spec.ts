import type { SecurityErrorEventData } from '../types/events'
import { SecurityError, createSecurityErrorEventData, createDeobfuscationRetry, logSecurityError, DEFAULT_RETRY_CONFIG } from './errors'

describe('security/errors', () => {
  describe('SecurityError', () => {
    it('creates error with message and code', () => {
      const error = new SecurityError('Test error', 'decryption_failed')

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('decryption_failed')
      expect(error.name).toBe('SecurityError')
      expect(error.originalCause).toBeUndefined()
    })

    it('creates error with original cause', () => {
      const cause = new Error('Original error')
      const error = new SecurityError('Wrapped error', 'transport_error', cause)

      expect(error.message).toBe('Wrapped error')
      expect(error.code).toBe('transport_error')
      expect(error.originalCause).toBe(cause)
    })

    it('is instanceof Error and SecurityError', () => {
      const error = new SecurityError('Test', 'unknown')

      expect(error instanceof Error).toBe(true)
      expect(error instanceof SecurityError).toBe(true)
    })
  })

  describe('createSecurityErrorEventData', () => {
    it('converts SecurityError to event data', () => {
      const cause = new Error('Cause')
      const secError = new SecurityError('Security issue', 'deobfuscation_failed', cause)

      const eventData = createSecurityErrorEventData(secError)

      expect(eventData.message).toBe('Security issue')
      expect(eventData.code).toBe('deobfuscation_failed')
      expect(eventData.cause).toBe(cause)
    })

    it('categorizes standard Error with decryption keywords', () => {
      const error = new Error('Failed to decrypt payload')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.message).toBe('Failed to decrypt payload')
      expect(eventData.code).toBe('decryption_failed')
      expect(eventData.cause).toBe(error)
    })

    it('categorizes error with invalid key keyword', () => {
      const error = new Error('Invalid key provided')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.code).toBe('decryption_failed')
    })

    it('categorizes error with corrupted keyword', () => {
      const error = new Error('Data corrupted')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.code).toBe('decryption_failed')
    })

    it('categorizes error with cipher keyword', () => {
      const error = new Error('Cipher operation failed')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.code).toBe('decryption_failed')
    })

    it('categorizes error with deobfuscation keyword', () => {
      const error = new Error('Deobfuscation error occurred')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.code).toBe('deobfuscation_failed')
    })

    it('categorizes error with time window keyword', () => {
      const error = new Error('Time window expired')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.code).toBe('deobfuscation_failed')
    })

    it('categorizes error with clock skew keyword', () => {
      const error = new Error('Clock skew too large')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.code).toBe('deobfuscation_failed')
    })

    it('categorizes error with timestamp keyword', () => {
      const error = new Error('Timestamp validation failed')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.code).toBe('deobfuscation_failed')
    })

    it('categorizes error with transport keyword', () => {
      const error = new Error('Transport layer error')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.code).toBe('transport_error')
    })

    it('categorizes error with connection keyword', () => {
      const error = new Error('Connection reset')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.code).toBe('transport_error')
    })

    it('categorizes error with network keyword', () => {
      const error = new Error('Network unavailable')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.code).toBe('transport_error')
    })

    it('categorizes unknown errors as unknown', () => {
      const error = new Error('Something unexpected')

      const eventData = createSecurityErrorEventData(error)

      expect(eventData.code).toBe('unknown')
    })

    it('handles non-Error values', () => {
      const eventData = createSecurityErrorEventData('string error')

      expect(eventData.message).toBe('string error')
      expect(eventData.code).toBe('unknown')
      expect(eventData.cause).toBeUndefined()
    })

    it('handles number values', () => {
      const eventData = createSecurityErrorEventData(42)

      expect(eventData.message).toBe('42')
      expect(eventData.code).toBe('unknown')
    })

    it('handles null values', () => {
      const eventData = createSecurityErrorEventData(null)

      expect(eventData.message).toBe('null')
      expect(eventData.code).toBe('unknown')
    })

    it('handles undefined values', () => {
      const eventData = createSecurityErrorEventData(undefined)

      expect(eventData.message).toBe('undefined')
      expect(eventData.code).toBe('unknown')
    })

    it('handles object values', () => {
      const eventData = createSecurityErrorEventData({ custom: 'error' })

      expect(eventData.message).toBe('[object Object]')
      expect(eventData.code).toBe('unknown')
    })
  })

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('has expected defaults', () => {
      expect(DEFAULT_RETRY_CONFIG.maxAttempts).toBe(3)
      expect(DEFAULT_RETRY_CONFIG.timeOffsets).toEqual([0, -1000, 1000])
    })
  })

  describe('createDeobfuscationRetry', () => {
    it('returns value on first successful attempt', () => {
      const deobfuscateFn = jest.fn().mockReturnValue('decrypted')

      const retryFn = createDeobfuscationRetry(deobfuscateFn)
      const result = retryFn(new Uint8Array([1, 2, 3]))

      expect(result).toBe('decrypted')
      expect(deobfuscateFn).toHaveBeenCalledTimes(1)
      expect(deobfuscateFn).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), 0)
    })

    it('retries with different time offsets on failure', () => {
      const deobfuscateFn = jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('First attempt failed')
        })
        .mockReturnValue('success')

      const retryFn = createDeobfuscationRetry(deobfuscateFn)
      const result = retryFn(new Uint8Array([1, 2, 3]))

      expect(result).toBe('success')
      expect(deobfuscateFn).toHaveBeenCalledTimes(2)
      expect(deobfuscateFn).toHaveBeenNthCalledWith(1, new Uint8Array([1, 2, 3]), 0)
      expect(deobfuscateFn).toHaveBeenNthCalledWith(2, new Uint8Array([1, 2, 3]), -1000)
    })

    it('uses all retry attempts before throwing', () => {
      const deobfuscateFn = jest.fn().mockImplementation(() => {
        throw new Error('Always fails')
      })

      const retryFn = createDeobfuscationRetry(deobfuscateFn)

      expect(() => retryFn(new Uint8Array([1, 2, 3]))).toThrow(SecurityError)
      expect(deobfuscateFn).toHaveBeenCalledTimes(3)
    })

    it('throws SecurityError with deobfuscation_failed code after all attempts', () => {
      const deobfuscateFn = jest.fn().mockImplementation(() => {
        throw new Error('Deob failed')
      })

      const retryFn = createDeobfuscationRetry(deobfuscateFn)

      let thrownError: SecurityError | null = null
      try {
        retryFn(new Uint8Array([1, 2, 3]))
      } catch (error) {
        thrownError = <SecurityError>error
      }

      expect(thrownError).not.toBeNull()
      expect(thrownError).toBeInstanceOf(SecurityError)
      expect(thrownError?.code).toBe('deobfuscation_failed')
      expect(thrownError?.message).toContain('Deobfuscation failed after 3 attempts')
      expect(thrownError?.originalCause?.message).toBe('Deob failed')
    })

    it('succeeds on third attempt', () => {
      const deobfuscateFn = jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('Failed 1')
        })
        .mockImplementationOnce(() => {
          throw new Error('Failed 2')
        })
        .mockReturnValue('finally!')

      const retryFn = createDeobfuscationRetry(deobfuscateFn)
      const result = retryFn(new Uint8Array([1, 2, 3]))

      expect(result).toBe('finally!')
      expect(deobfuscateFn).toHaveBeenCalledTimes(3)
      expect(deobfuscateFn).toHaveBeenNthCalledWith(3, new Uint8Array([1, 2, 3]), 1000)
    })

    it('uses custom retry config', () => {
      const deobfuscateFn = jest.fn().mockImplementation(() => {
        throw new Error('Fail')
      })

      const customConfig = {
        maxAttempts: 2,
        timeOffsets: [100, 200],
      }

      const retryFn = createDeobfuscationRetry(deobfuscateFn, customConfig)

      expect(() => retryFn(new Uint8Array([1]))).toThrow()
      expect(deobfuscateFn).toHaveBeenCalledTimes(2)
      expect(deobfuscateFn).toHaveBeenNthCalledWith(1, new Uint8Array([1]), 100)
      expect(deobfuscateFn).toHaveBeenNthCalledWith(2, new Uint8Array([1]), 200)
    })

    it('handles non-Error thrown values', () => {
      const deobfuscateFn = jest.fn().mockImplementation(() => {
        throw 'string error'
      })

      const retryFn = createDeobfuscationRetry(deobfuscateFn)

      let thrownError: SecurityError | null = null
      try {
        retryFn(new Uint8Array([1]))
      } catch (error) {
        thrownError = <SecurityError>error
      }

      expect(thrownError).not.toBeNull()
      expect(thrownError?.originalCause?.message).toBe('string error')
    })

    it('handles Error with empty message', () => {
      const emptyMessageError = new Error('')
      const deobfuscateFn = jest.fn().mockImplementation(() => {
        throw emptyMessageError
      })

      const retryFn = createDeobfuscationRetry(deobfuscateFn)

      let thrownError: SecurityError | null = null
      try {
        retryFn(new Uint8Array([1]))
      } catch (error) {
        thrownError = <SecurityError>error
      }

      expect(thrownError).not.toBeNull()
      expect(thrownError?.message).toContain('unknown error')
    })

    it('limits attempts by timeOffsets length when shorter than maxAttempts', () => {
      const deobfuscateFn = jest.fn().mockImplementation(() => {
        throw new Error('Fail')
      })

      const customConfig = {
        maxAttempts: 10,
        timeOffsets: [0, 100],
      }

      const retryFn = createDeobfuscationRetry(deobfuscateFn, customConfig)

      expect(() => retryFn(new Uint8Array([1]))).toThrow()
      expect(deobfuscateFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('logSecurityError', () => {
    let consoleErrorSpy: jest.SpyInstance
    let consoleWarnSpy: jest.SpyInstance

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    })

    afterEach(() => {
      consoleErrorSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })

    it('does not log when debug is false', () => {
      const errorData: SecurityErrorEventData = {
        message: 'Test error',
        code: 'unknown',
      }

      logSecurityError('test-channel', errorData, false)

      expect(consoleErrorSpy).not.toHaveBeenCalled()
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('logs unknown errors with console.error', () => {
      const cause = new Error('Original')
      const errorData: SecurityErrorEventData = {
        message: 'Unknown error occurred',
        code: 'unknown',
        cause,
      }

      logSecurityError('my-channel', errorData, true)

      expect(consoleErrorSpy).toHaveBeenCalledWith('[nexus] my-channel security error:', 'Unknown error occurred', cause)
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('logs known errors with console.warn', () => {
      const errorData: SecurityErrorEventData = {
        message: 'Decryption issue',
        code: 'decryption_failed',
      }

      logSecurityError('secure-channel', errorData, true)

      expect(consoleWarnSpy).toHaveBeenCalledWith('[nexus] secure-channel security error:', '[decryption_failed]', 'Decryption issue')
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('logs deobfuscation_failed with console.warn', () => {
      const errorData: SecurityErrorEventData = {
        message: 'Time window issue',
        code: 'deobfuscation_failed',
      }

      logSecurityError('channel', errorData, true)

      expect(consoleWarnSpy).toHaveBeenCalledWith('[nexus] channel security error:', '[deobfuscation_failed]', 'Time window issue')
    })

    it('logs transport_error with console.warn', () => {
      const errorData: SecurityErrorEventData = {
        message: 'Connection lost',
        code: 'transport_error',
      }

      logSecurityError('channel', errorData, true)

      expect(consoleWarnSpy).toHaveBeenCalledWith('[nexus] channel security error:', '[transport_error]', 'Connection lost')
    })
  })
})
