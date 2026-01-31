/**
 * Converts URL-safe base64 encoding back to standard base64 encoding.
 * Restores standard characters and adds padding if needed.
 *
 * @param urlSafeBase64 - The URL-safe base64 encoded string to convert
 * @returns The standard base64 encoded string with proper padding
 */
export function urlSafeBase64ToBase64(urlSafeBase64: string): string {
  let normalizedBase64 = urlSafeBase64.replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalizedBase64.length % 4
  if (pad) {
    normalizedBase64 = normalizedBase64.padEnd(normalizedBase64.length + (4 - pad), '=')
  }
  return normalizedBase64
}
