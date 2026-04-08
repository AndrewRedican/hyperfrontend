/**
 * Converts standard base64 encoding to URL-safe base64 encoding.
 * Optionally removes padding characters for more compact representation.
 *
 * @param base64 - The standard base64 encoded string
 * @param root0 - Configuration options
 * @param root0.urlSafe - Whether to apply URL-safe transformations (+ → -, / → _)
 * @param root0.keepPadding - Whether to preserve padding characters (=)
 * @returns The URL-safe base64 encoded string
 *
 * @example URL-safe with padding
 * ```typescript
 * const urlSafe = base64ToUrlSafeBase64('a+b/c==', { urlSafe: true, keepPadding: true })
 * // => 'a-b_c=='
 * ```
 *
 * @example URL-safe without padding (compact)
 * ```typescript
 * const compact = base64ToUrlSafeBase64('SGVsbG8=', { urlSafe: true, keepPadding: false })
 * // => 'SGVsbG8'
 * ```
 */
export function base64ToUrlSafeBase64(
  base64: string,
  {
    urlSafe,
    keepPadding,
  }: {
    /** Whether to apply URL-safe transformations */ urlSafe: boolean
    /** Whether to preserve padding characters */ keepPadding: boolean
  }
): string {
  if (urlSafe) {
    base64 = base64.replaceAll('+', '-').replaceAll('/', '_')
    if (keepPadding === false) {
      while (base64.endsWith('=')) {
        base64 = base64.slice(0, -1)
      }
    }
  }
  return base64
}
