import { btoa, createTextEncoder } from '@hyperfrontend/immutable-api-utils/built-in-copy/encoding'
import { base64ToUrlSafeBase64 } from '../../utils/base64-to-url-safe-base64'
import { bytesToBinaryString } from '../../utils/bytes-to-binary-string'

/**
 * Encodes a UTF-8 string to base64 format (browser implementation).
 * Supports optional URL-safe encoding and padding control.
 *
 * @param text - The UTF-8 string to encode
 * @param urlSafe - Whether to use URL-safe base64 encoding (replaces + and / with - and _)
 * @param keepPadding - Whether to keep padding characters (=) in the output
 * @returns The base64 encoded string
 *
 * @example Standard base64
 * ```typescript
 * const encoded = toBase64('Hello, World!')
 * // => 'SGVsbG8sIFdvcmxkIQ=='
 * ```
 *
 * @example URL-safe without padding (for URLs/tokens)
 * ```typescript
 * const token = toBase64('{"userId":123}', true, false)
 * // => 'eyJ1c2VySWQiOjEyM30'
 * ```
 */
export function toBase64(text: string, urlSafe = false, keepPadding = false): string {
  return base64ToUrlSafeBase64(btoa(bytesToBinaryString(createTextEncoder().encode(text))), { urlSafe, keepPadding })
}
