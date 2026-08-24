import type { ExitCode } from '../models/exit-code'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/** An error that already knows how the process should exit because of it. */
export interface MediaError extends Error {
  /** Exit code the process uses when this error reaches the top. */
  exitCode: ExitCode
}

/**
 * Raise a failure that carries its own exit code.
 *
 * Attaching the code at the throw site is what lets a caller distinguish an
 * oversized asset from a missing browser without reading the message, which
 * matters as soon as anything automated reacts to the result.
 *
 * @param exitCode - How the process should exit because of this.
 * @param message - What went wrong, phrased as the action that fixes it.
 * @returns The error, ready to throw.
 */
export function mediaError(exitCode: ExitCode, message: string): MediaError {
  const error = <MediaError>createError(message)
  error.exitCode = exitCode
  return error
}

/**
 * Report whether a thrown value carries an exit code.
 *
 * @param value - The value that was caught.
 * @returns True when it is an error this module raised.
 */
export function isMediaError(value: unknown): value is MediaError {
  return value instanceof Error && typeof (<MediaError>value).exitCode === 'number'
}
