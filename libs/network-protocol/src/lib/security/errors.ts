import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze, values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Why a protocol rejected a frame or a session.
 *
 * - `unsupported-version`: the frame's version byte is not this protocol's
 * - `replayed`: the frame's counter is not above the last accepted one
 * - `authentication-failed`: the frame's tag does not verify under the session's keys
 * - `malformed`: the frame authenticated but does not carry a packet
 * - `counter-exhausted`: the session has sealed every counter value it can represent
 * - `invalid-session`: the session cannot be keyed from the material it holds
 */
export const ProtocolErrorCode = freeze({
  UnsupportedVersion: 'unsupported-version',
  Replayed: 'replayed',
  AuthenticationFailed: 'authentication-failed',
  Malformed: 'malformed',
  CounterExhausted: 'counter-exhausted',
  InvalidSession: 'invalid-session',
} as const)

/** One of the protocol rejection codes */
export type ProtocolErrorCode = (typeof ProtocolErrorCode)[keyof typeof ProtocolErrorCode]

/** An error a protocol raises, carrying a machine-readable code beside its message */
export interface ProtocolError extends Error {
  /** Why the protocol rejected the input */
  readonly code: ProtocolErrorCode
}

/** A mutable view of a protocol error while it is being built */
interface ProtocolErrorDraft extends Error {
  /** The rejection code being attached */
  code: ProtocolErrorCode
}

/**
 * Creates a protocol error with a machine-readable code.
 *
 * @param code - Why the protocol rejected the input
 * @param message - Human-readable detail
 * @returns An error whose `code` survives the pipeline's drop report
 *
 * @example Rejecting a replayed frame
 * ```typescript
 * throw createProtocolError('replayed', 'Frame counter 7 is not above the last accepted counter 9')
 * ```
 */
export function createProtocolError(code: ProtocolErrorCode, message: string): ProtocolError {
  const error = createError(message) as ProtocolErrorDraft
  error.name = 'ProtocolError'
  error.code = code
  return error
}

/**
 * Reads the protocol error code off an error, when it carries one.
 *
 * @param error - Any thrown value
 * @returns The code, or null when the value is not a protocol error
 *
 * @example Mapping a drop to its cause
 * ```typescript
 * getProtocolErrorCode(drop.cause)
 * // => 'authentication-failed'
 * ```
 */
export function getProtocolErrorCode(error: unknown): ProtocolErrorCode | null {
  if (typeof error !== 'object' || error === null) {
    return null
  }
  const code = (error as Partial<ProtocolError>).code
  return typeof code === 'string' && (values(ProtocolErrorCode) as string[]).includes(code) ? (code as ProtocolErrorCode) : null
}
