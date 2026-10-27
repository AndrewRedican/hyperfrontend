/**
 * The errors the runner raises itself when a task cannot run as asked, whose message says all
 * there is to say, as against anything a task throws, whose stack is worth reading.
 *
 * @module runner/refusal
 */

import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/** The cause every refusal carries. */
const REFUSED = freeze({ refused: true })

/**
 * An error saying why a task cannot run.
 *
 * @param message - What is wrong and, where it helps, how to put it right
 * @returns The error, marked as the runner's own
 */
export function refusal(message: string): Error {
  return createError(message, { cause: REFUSED })
}

/**
 * The text reporting an error: a refusal's message, else the stack of what was thrown.
 *
 * @param error - What was thrown
 * @returns The message of a refusal, the stack of any other error, or the value as text
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  return error.cause === REFUSED ? error.message : (error.stack ?? error.message)
}
