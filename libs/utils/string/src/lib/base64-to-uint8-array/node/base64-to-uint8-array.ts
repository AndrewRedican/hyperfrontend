import { urlSafeBase64ToBase64 } from '../../utils/utils'

/**
 * Converts a base64 encoded string to a Uint8Array (Node.js implementation).
 * Supports both standard and URL-safe base64 encoding.
 *
 * @param base64 - The base64 encoded string to convert
 * @returns The decoded Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const buffer = Buffer.from(urlSafeBase64ToBase64(base64), 'base64')
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
}
