import { urlSafeBase64ToBase64 } from '../../utils/utils'

/**
 * Decodes a base64 encoded string to a UTF-8 string (Node.js implementation).
 * Supports both standard and URL-safe base64 encoding.
 *
 * @param text - The base64 encoded string to decode
 * @returns The decoded UTF-8 string
 */
export function fromBase64(text: string): string {
  return Buffer.from(urlSafeBase64ToBase64(text), 'base64').toString('utf8')
}
