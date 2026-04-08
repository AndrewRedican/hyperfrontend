/**
 * Converts URL-safe base64 encoding back to standard base64 encoding.
 * Restores standard characters and adds padding if needed.
 *
 * @param urlSafeBase64 - The URL-safe base64 encoded string to convert
 * @returns The standard base64 encoded string with proper padding
 *
 * @example Without padding (common in JWT tokens)
 * ```typescript
 * const standard = urlSafeBase64ToBase64('SGVsbG8')
 * // => 'SGVsbG8='
 * ```
 *
 * @example With URL-safe characters
 * ```typescript
 * const standard = urlSafeBase64ToBase64('a-b_c')
 * // => 'a+b/c='
 * ```
 */
export function urlSafeBase64ToBase64(urlSafeBase64: string): string {
  let normalizedBase64 = urlSafeBase64.replaceAll('-', '+').replaceAll('_', '/')
  const pad = normalizedBase64.length % 4
  if (pad) {
    normalizedBase64 = normalizedBase64.padEnd(normalizedBase64.length + (4 - pad), '=')
  }
  return normalizedBase64
}
