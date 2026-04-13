import { createTextEncoder } from '@hyperfrontend/immutable-api-utils/built-in-copy/encoding'

/**
 * Converts a UTF-8 string to a Uint8Array (browser implementation).
 *
 * @param text - The UTF-8 string to convert
 * @returns The encoded Uint8Array
 *
 * @example Encoding string to bytes (browser)
 * ```typescript
 * const bytes = utf8StringToUint8Array('Hello')
 * // => Uint8Array([72, 101, 108, 108, 111])
 * ```
 */
export function utf8StringToUint8Array(text: string): Uint8Array {
  return createTextEncoder().encode(text)
}
