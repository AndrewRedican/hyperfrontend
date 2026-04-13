/**
 * Security error handling utilities.
 *
 * Provides functions for handling, categorizing, and emitting security-related
 * errors during message encryption/decryption operations.
 *
 * @module security/errors
 */

import type { Logger } from '@hyperfrontend/logging'
import type { SecurityErrorEventData } from '../types/events'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { setPrototypeOf } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Error codes for security-related failures.
 */
export type SecurityErrorCode = 'decryption_failed' | 'deobfuscation_failed' | 'transport_error' | 'unknown'

/**
 * Security error class with additional metadata for programmatic handling.
 *
 * @example Creating security error
 * ```typescript
 * throw new SecurityError('Decryption failed', 'decryption_failed', originalError)
 * ```
 */
export class SecurityError extends Error {
  readonly code: SecurityErrorCode
  readonly originalCause?: Error

  constructor(message: string, code: SecurityErrorCode, cause?: Error) {
    super(message)
    this.name = 'SecurityError'
    this.code = code
    this.originalCause = cause
    setPrototypeOf(this, SecurityError.prototype)
  }
}

/**
 * Creates security error event data from an error.
 *
 * Converts various error types into a standardized SecurityErrorEventData
 * structure for emitting via channel events.
 *
 * @param error - The error to convert
 * @returns Standardized security error event data
 *
 * @example Converting errors to event data
 * ```typescript
 * try {
 *   decrypt(payload)
 * } catch (error) {
 *   const eventData = createSecurityErrorEventData(error)
 *   channel.notifyEvent('security-error', eventData)
 * }
 * ```
 */
export function createSecurityErrorEventData(error: unknown): SecurityErrorEventData {
  if (error instanceof SecurityError) {
    return {
      message: error.message,
      code: error.code,
      cause: error.originalCause,
    }
  }

  if (error instanceof Error) {
    const code = categorizeError(error)
    return {
      message: error.message,
      code,
      cause: error,
    }
  }

  return {
    message: String(error),
    code: 'unknown',
  }
}

/**
 * Categorizes an error into a security error code.
 *
 * Analyzes the error message to determine the appropriate category.
 * This is used when errors from network-protocol are caught.
 *
 * @param error - The error to categorize
 * @returns The appropriate security error code
 *
 * @internal
 */
function categorizeError(error: Error): SecurityErrorCode {
  const message = error.message.toLowerCase()

  if (message.includes('decrypt') || message.includes('invalid key') || message.includes('corrupted') || message.includes('cipher')) {
    return 'decryption_failed'
  }

  if (
    message.includes('deobfuscat') ||
    message.includes('time window') ||
    message.includes('clock skew') ||
    message.includes('timestamp')
  ) {
    return 'deobfuscation_failed'
  }

  if (message.includes('transport') || message.includes('connection') || message.includes('network')) {
    return 'transport_error'
  }

  return 'unknown'
}

/**
 * Configuration for retry logic on time-window deobfuscation.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number
  /** Time offsets to try (in milliseconds) */
  timeOffsets: readonly number[]
}

/**
 * Default retry configuration for deobfuscation failures.
 *
 * Attempts deobfuscation with different time offsets to handle
 * minor clock skew between sender and receiver.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  timeOffsets: [0, -1000, 1000],
}

/**
 * Creates a retry wrapper for deobfuscation functions.
 *
 * Wraps a deobfuscation function with retry logic that attempts
 * different time offsets to handle clock skew.
 *
 * @param deobfuscateFn - The deobfuscation function to wrap
 * @param config - Retry configuration
 * @returns A wrapped function that retries on failure
 *
 * @example Handling clock skew with retries
 * ```typescript
 * const robustDeobfuscate = createDeobfuscationRetry(
 *   (data, offset) => deobfuscate(data, offset),
 *   { maxAttempts: 3, timeOffsets: [0, -1000, 1000] }
 * )
 *
 * const result = robustDeobfuscate(encryptedData)
 * ```
 */
export function createDeobfuscationRetry<T>(
  deobfuscateFn: (data: Uint8Array, timeOffset: number) => T,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): (data: Uint8Array) => T {
  return (data: Uint8Array): T => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < config.maxAttempts && attempt < config.timeOffsets.length; attempt++) {
      const timeOffset = config.timeOffsets[attempt]

      try {
        return deobfuscateFn(data, timeOffset)
      } catch (error) {
        lastError = error instanceof Error ? error : createError(String(error))
      }
    }

    throw new SecurityError(
      `Deobfuscation failed after ${config.maxAttempts} attempts: ${lastError?.message || 'unknown error'}`,
      'deobfuscation_failed',
      lastError ?? undefined
    )
  }
}

/**
 * Logs a security error with appropriate formatting.
 *
 * Uses logger.error for actual errors and logger.warn for
 * retryable/expected failures.
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
    logger.error(prefix, error.message, error.cause)
  } else {
    logger.warn(prefix, `[${error.code}]`, error.message)
  }
}
