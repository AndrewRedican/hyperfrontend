/**
 * Converts standard base64 encoding to URL-safe base64 encoding.
 * Optionally removes padding characters for more compact representation.
 *
 * @param base64 - The standard base64 encoded string
 * @param root0 - Configuration options
 * @param root0.urlSafe - Whether to apply URL-safe transformations (+ → -, / → _)
 * @param root0.keepPadding - Whether to preserve padding characters (=)
 * @returns The URL-safe base64 encoded string
 */
export function base64ToUrlSafeBase64(base64: string, { urlSafe, keepPadding }: { urlSafe: boolean; keepPadding: boolean }): string {
  if (urlSafe) {
    base64 = base64.replace(/\+/g, '-').replace(/\//g, '_')
    if (keepPadding === false) {
      // Remove trailing = padding characters without regex to avoid ReDoS
      while (base64.endsWith('=')) {
        base64 = base64.slice(0, -1)
      }
    }
  }
  return base64
}
