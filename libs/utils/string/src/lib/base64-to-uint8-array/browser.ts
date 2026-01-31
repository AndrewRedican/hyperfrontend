import { binaryStringToBytes, urlSafeBase64ToBase64 } from '../utils'

/**
 * Converts a base64 encoded string to a Uint8Array (browser implementation).
 * Supports both standard and URL-safe base64 encoding.
 *
 * @param base64 - The base64 encoded string to convert
 * @returns The decoded Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  return binaryStringToBytes(atob(urlSafeBase64ToBase64(base64)))
}
