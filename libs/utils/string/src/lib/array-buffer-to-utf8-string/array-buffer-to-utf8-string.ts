import { getUtf8Decoder } from '../utf8-decoder'

/**
 * Converts an ArrayBuffer to a UTF-8 encoded string.
 *
 * @param uint8Array - The ArrayBuffer to convert
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
export function arrayBufferToUtf8String(uint8Array: ArrayBuffer): string {
  return getUtf8Decoder().decode(uint8Array)
}
