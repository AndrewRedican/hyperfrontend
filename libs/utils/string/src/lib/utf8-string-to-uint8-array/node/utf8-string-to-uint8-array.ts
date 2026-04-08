import { createUint8Array } from '@hyperfrontend/immutable-api-utils/built-in-copy/typed-arrays'

/**
 * Converts a UTF-8 string to a Uint8Array (Node.js implementation).
 *
 * @param text - The UTF-8 string to convert
 * @returns The encoded Uint8Array
 *
 * @example
 * ```typescript
 * const bytes = utf8StringToUint8Array('Hello')
 * // => Uint8Array([72, 101, 108, 108, 111])
 * ```
 */
export function utf8StringToUint8Array(text: string): Uint8Array {
  return createUint8Array(Buffer.from(text, 'utf8'))
}
