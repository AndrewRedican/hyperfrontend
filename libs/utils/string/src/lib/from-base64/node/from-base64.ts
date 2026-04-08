import { urlSafeBase64ToBase64 } from '../../utils/url-safe-base64-to-base64'

/**
 * Decodes a base64 encoded string to a UTF-8 string (Node.js implementation).
 * Supports both standard and URL-safe base64 encoding.
 *
 * @param text - The base64 encoded string to decode
 * @returns The decoded UTF-8 string
 *
 * @example Standard base64
 * ```typescript
 * const message = fromBase64('SGVsbG8sIFdvcmxkIQ==')
 * // => 'Hello, World!'
 * ```
 *
 * @example URL-safe base64
 * ```typescript
 * const token = fromBase64('eyJ1c2VySWQiOjEyM30')
 * // => '{"userId":123}'
 * ```
 */
export function fromBase64(text: string): string {
  return Buffer.from(urlSafeBase64ToBase64(text), 'base64').toString('utf8')
}
