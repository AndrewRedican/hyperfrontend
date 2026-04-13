import { UTF8_DECODER } from '../shared-consts'

/**
 * Converts a Uint8Array to a UTF-8 encoded string.
 *
 * @param uint8Array - The Uint8Array to convert
 * @returns The decoded UTF-8 string
 *
 * @example Converting Uint8Array to string
 * ```typescript
 * const bytes = new Uint8Array([72, 101, 108, 108, 111])
 * const text = uint8ArrayToUtf8String(bytes)
 * // => 'Hello'
 * ```
 */
export function uint8ArrayToUtf8String(uint8Array: Uint8Array): string {
  return UTF8_DECODER.decode(uint8Array)
}
