import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { SecurityErrorEventData } from '../types/events'
import type { SecurityErrorCode } from '../types/security'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createSecurityErrorEventData, logSecurityError, readProtocolErrorCode } from './errors'

const FRAME_VERDICTS: readonly SecurityErrorCode[] = [
  'unsupported-version',
  'replayed',
  'authentication-failed',
  'malformed',
  'counter-exhausted',
  'invalid-session',
]

interface CodedError extends Error {
  code?: unknown
}

interface LoggerHarness {
  logger: Logger
  error: Mock
  warn: Mock
}

function createCodedError(code: unknown, message = 'verdict'): CodedError {
  const error: CodedError = createError(message)
  error.code = code
  return error
}

function createLoggerHarness(): LoggerHarness {
  const error = jest.fn()
  const warn = jest.fn()
  const logger: Logger = {
    error,
    warn,
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    setLogLevel: jest.fn(),
    getLogLevel: jest.fn(),
    channel: jest.fn(),
    timed: jest.fn(),
    timedAsync: jest.fn(),
  }
  return { logger, error, warn }
}

describe('security/errors', () => {
  describe('readProtocolErrorCode', () => {
    for (const code of FRAME_VERDICTS) {
      it(`reads the '${code}' verdict off a coded error`, () => {
        expect(readProtocolErrorCode(createCodedError(code))).toBe(code)
      })
    }

    it('reads the verdict off a plain coded object', () => {
      expect(readProtocolErrorCode({ code: 'replayed' })).toBe('replayed')
    })

    it('returns undefined for an error without a code', () => {
      expect(readProtocolErrorCode(createError('boom'))).toBeUndefined()
    })

    it('returns undefined for a transport code', () => {
      expect(readProtocolErrorCode(createCodedError('hello-rejected'))).toBeUndefined()
    })

    it('returns undefined for an unrecognised code', () => {
      expect(readProtocolErrorCode(createCodedError('decryption_failed'))).toBeUndefined()
    })

    it('returns undefined for a non-string code', () => {
      expect(readProtocolErrorCode(createCodedError(42))).toBeUndefined()
    })

    it('returns undefined for null', () => {
      expect(readProtocolErrorCode(null)).toBeUndefined()
    })

    it('returns undefined for undefined', () => {
      expect(readProtocolErrorCode(undefined)).toBeUndefined()
    })

    it('returns undefined for a string', () => {
      expect(readProtocolErrorCode('replayed')).toBeUndefined()
    })
  })

  describe('createSecurityErrorEventData', () => {
    it("keeps a coded error's verdict", () => {
      const error = createCodedError('malformed', 'Frame too short')

      expect(createSecurityErrorEventData(error)).toEqual({ message: 'Frame too short', code: 'malformed', cause: error })
    })

    it('reports an uncoded error as unknown', () => {
      const error = createError('Something unexpected')

      expect(createSecurityErrorEventData(error)).toEqual({ message: 'Something unexpected', code: 'unknown', cause: error })
    })

    it('reports an error with an unrecognised code as unknown', () => {
      const error = createCodedError('ECONNRESET', 'Connection reset')

      expect(createSecurityErrorEventData(error)).toEqual({ message: 'Connection reset', code: 'unknown', cause: error })
    })

    it('reports a string as unknown without a cause', () => {
      expect(createSecurityErrorEventData('string error')).toStrictEqual({ message: 'string error', code: 'unknown' })
    })

    it('reports a number as unknown', () => {
      expect(createSecurityErrorEventData(42)).toStrictEqual({ message: '42', code: 'unknown' })
    })

    it('reports null as unknown', () => {
      expect(createSecurityErrorEventData(null)).toStrictEqual({ message: 'null', code: 'unknown' })
    })

    it('reports undefined as unknown', () => {
      expect(createSecurityErrorEventData(undefined)).toStrictEqual({ message: 'undefined', code: 'unknown' })
    })

    it('reports a plain object as unknown', () => {
      expect(createSecurityErrorEventData({ custom: 'error' })).toStrictEqual({ message: '[object Object]', code: 'unknown' })
    })
  })

  describe('logSecurityError', () => {
    it('logs an unknown error with its cause through logger.error', () => {
      const { logger, error } = createLoggerHarness()
      const cause = createError('Original')
      const errorData: SecurityErrorEventData = { message: 'Unknown error occurred', code: 'unknown', cause }

      logSecurityError(logger, 'my-channel', errorData)

      expect(error).toHaveBeenCalledWith('my-channel security error:', 'Unknown error occurred', cause)
    })

    it('logs an unknown error without a cause through logger.error', () => {
      const { logger, error } = createLoggerHarness()

      logSecurityError(logger, 'my-channel', { message: 'Unknown error occurred', code: 'unknown' })

      expect(error).toHaveBeenCalledWith('my-channel security error:', 'Unknown error occurred', undefined)
    })

    it('does not warn for an unknown error', () => {
      const { logger, warn } = createLoggerHarness()

      logSecurityError(logger, 'my-channel', { message: 'Unknown error occurred', code: 'unknown' })

      expect(warn).not.toHaveBeenCalled()
    })

    it('logs a protocol verdict through logger.warn', () => {
      const { logger, warn } = createLoggerHarness()

      logSecurityError(logger, 'secure-channel', { message: 'Frame counter went backwards', code: 'replayed' })

      expect(warn).toHaveBeenCalledWith('secure-channel security error:', '[replayed]', 'Frame counter went backwards')
    })

    it('logs a transport code through logger.warn', () => {
      const { logger, warn } = createLoggerHarness()

      logSecurityError(logger, 'secure-channel', { message: 'No confirmation arrived', code: 'security-unconfirmed' })

      expect(warn).toHaveBeenCalledWith('secure-channel security error:', '[security-unconfirmed]', 'No confirmation arrived')
    })

    it('does not log a coded error through logger.error', () => {
      const { logger, error } = createLoggerHarness()

      logSecurityError(logger, 'secure-channel', { message: 'Frame counter went backwards', code: 'replayed' })

      expect(error).not.toHaveBeenCalled()
    })
  })
})
