/**
 * Security error handling utilities.
 *
 * Reads the machine-readable code off errors raised by the wire protocol,
 * shapes them into `security-error` event payloads, and logs them.
 *
 * @module security/errors
 */

import type { Logger } from '@hyperfrontend/logging'
import type { SecurityErrorEventData } from '../types/events'
import type { SecurityErrorCode } from '../types/security'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

// why: The wire protocol's verdicts are the only codes read off a foreign error; anything else is reported as unknown rather than guessed from its message.
const PROTOCOL_ERROR_CODES: ReadonlySet<string> = createSet<string>([
  'unsupported-version',
  'replayed',
  'authentication-failed',
  'malformed',
  'counter-exhausted',
  'invalid-session',
])

/** An error that may carry a machine-readable code */
interface CodedError {
  /** The error's code, when it has one */
  readonly code?: unknown
}

/**
 * Reads the wire protocol's verdict off an error it raised.
 *
 * @param error - The error a pipeline stage raised
 * @returns The protocol's error code, or undefined when the error carries none
 *
 * @example Mapping a dropped frame to its verdict
 * ```typescript
 * const code = readProtocolErrorCode(drop.cause) ?? 'transport-error'
 * ```
 */
export function readProtocolErrorCode(error: unknown): SecurityErrorCode | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }
  const code = (error as CodedError).code
  return typeof code === 'string' && PROTOCOL_ERROR_CODES.has(code) ? (code as SecurityErrorCode) : undefined
}

/**
 * Creates security error event data from an error.
 *
 * Errors raised by the wire protocol keep their code; any other error is
 * reported with the `'unknown'` code and its message.
 *
 * @param error - The error to convert
 * @returns Standardized security error event data
 *
 * @example Converting errors to event data
 * ```typescript
 * try {
 *   transport.receive(frame)
 * } catch (error) {
 *   channel.notifyEvent('security-error', createSecurityErrorEventData(error))
 * }
 * ```
 */
export function createSecurityErrorEventData(error: unknown): SecurityErrorEventData {
  if (error instanceof Error) {
    return {
      message: error.message,
      code: readProtocolErrorCode(error) ?? 'unknown',
      cause: error,
    }
  }

  return {
    message: String(error),
    code: 'unknown',
  }
}

/**
 * Logs a security error with appropriate formatting.
 *
 * Uses logger.error for errors without a recognised code and logger.warn
 * for the expected failures the codes name.
 *
 * @param logger - Logger instance to use for output
 * @param channelName - Name of the channel where error occurred
 * @param error - The security error event data containing message, code, and optional cause
 *
 * @example Logging security errors
 * ```typescript
 * logSecurityError(logger, 'my-channel', errorData)
 * ```
 */
export function logSecurityError(logger: Logger, channelName: string, error: SecurityErrorEventData): void {
  const prefix = `${channelName} security error:`

  if (error.code === 'unknown') {
    logger.error(prefix, error.message, error.cause as Error | undefined)
  } else {
    logger.warn(prefix, `[${error.code}]`, error.message)
  }
}
