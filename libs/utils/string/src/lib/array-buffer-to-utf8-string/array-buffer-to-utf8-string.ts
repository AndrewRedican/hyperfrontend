import { UTF8_DECODER } from '../shared-consts'

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
  return UTF8_DECODER.decode(uint8Array)
}
