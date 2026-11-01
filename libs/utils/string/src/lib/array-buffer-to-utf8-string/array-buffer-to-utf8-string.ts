import { getUtf8Decoder } from '../utf8-decoder'

/**
 * Converts an ArrayBuffer or SharedArrayBuffer to a UTF-8 encoded string.
 *
 * @param buffer - The buffer to convert
 * @returns The decoded UTF-8 string
 *
 * @example Converting ArrayBuffer to string
 * ```typescript
 * const encoder = new TextEncoder()
 * const buffer = encoder.encode('Hello, World!').buffer
 * const decoded = arrayBufferToUtf8String(buffer)
 * // => 'Hello, World!'
 * ```
 */
export function arrayBufferToUtf8String(buffer: ArrayBufferLike): string {
  return getUtf8Decoder().decode(buffer)
}
