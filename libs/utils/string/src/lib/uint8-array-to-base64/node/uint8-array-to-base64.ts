import { base64ToUrlSafeBase64 } from '../../utils/base64-to-url-safe-base64'

/**
 * Converts a Uint8Array to a base64 encoded string (Node.js implementation).
 * Supports optional URL-safe encoding and padding control.
 *
 * @param bytes - The Uint8Array to encode
 * @param urlSafe - Whether to use URL-safe base64 encoding (replaces + and / with - and _)
 * @param keepPadding - Whether to keep padding characters (=) in the output
 * @returns The base64 encoded string
 */
export function uint8ArrayToBase64(bytes: Uint8Array, urlSafe = false, keepPadding = false): string {
  return base64ToUrlSafeBase64(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64'), { urlSafe, keepPadding })
}
