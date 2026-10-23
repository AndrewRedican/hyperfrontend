/**
 * The text of a thrown value, whatever was thrown.
 *
 * @module engine/error-text
 */

/**
 * The message of an error, or the thrown value as text.
 *
 * @param error - What a `catch` received
 * @returns The error's message, or the value rendered as a string
 *
 * @example Describe whatever was thrown
 * ```ts
 * errorText(new Error('missing file')) // => 'missing file'
 * errorText('plain text') // => 'plain text'
 * ```
 */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : `${error as string}`
}
