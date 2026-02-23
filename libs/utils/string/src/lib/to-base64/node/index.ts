import { base64ToUrlSafeBase64 } from '../../utils'

/**
 * Encodes a UTF-8 string to base64 format (Node.js implementation).
 * Supports optional URL-safe encoding and padding control.
 *
 * @param text - The UTF-8 string to encode
 * @param urlSafe - Whether to use URL-safe base64 encoding (replaces + and / with - and _)
 * @param keepPadding - Whether to keep padding characters (=) in the output
 * @returns The base64 encoded string
 */
export function toBase64(text: string, urlSafe = false, keepPadding = false): string {
  return base64ToUrlSafeBase64(Buffer.from(text, 'utf8').toString('base64'), {
    urlSafe,
    keepPadding,
  })
}
