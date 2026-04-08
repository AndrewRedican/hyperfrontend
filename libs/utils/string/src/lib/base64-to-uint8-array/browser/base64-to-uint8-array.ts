import { atob } from '@hyperfrontend/immutable-api-utils/built-in-copy/encoding'
import { binaryStringToBytes } from '../../utils/binary-string-to-bytes'
import { urlSafeBase64ToBase64 } from '../../utils/url-safe-base64-to-base64'

/**
 * Converts a base64 encoded string to a Uint8Array (browser implementation).
 * Supports both standard and URL-safe base64 encoding.
 *
 * @param base64 - The base64 encoded string to convert
 * @returns The decoded Uint8Array
 *
 * @example Standard base64
 * ```typescript
 * const bytes = base64ToUint8Array('SGVsbG8=')
 * // => Uint8Array([72, 101, 108, 108, 111]) // 'Hello'
 * ```
 *
 * @example URL-safe base64 (without padding)
 * ```typescript
 * const bytes = base64ToUint8Array('SGVsbG8')
 * // => Uint8Array([72, 101, 108, 108, 111]) // 'Hello'
 * ```
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  return binaryStringToBytes(atob(urlSafeBase64ToBase64(base64)))
}
