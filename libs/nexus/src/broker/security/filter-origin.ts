/**
 * Filters message origin against whitelist/blacklist
 *
 * @param origin - The origin to check
 * @param whitelist - List of allowed origins (takes precedence)
 * @param blacklist - List of blocked origins
 * @returns true if origin is allowed, false otherwise
 *
 * @example
 * ```typescript
 * filterOrigin('https://app.example.com', ['https://app.example.com'])
 * // => true
 *
 * filterOrigin('https://untrusted.com', [], ['https://untrusted.com'])
 * // => false
 * ```
 */
export function filterOrigin(origin: string, whitelist: readonly string[] = [], blacklist: readonly string[] = []): boolean {
  if (whitelist && whitelist.length > 0) {
    return whitelist.includes(origin)
  }

  if (blacklist && blacklist.length > 0) {
    return !blacklist.includes(origin)
  }

  return true
}
