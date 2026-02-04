/**
 * Filters message origin against whitelist/blacklist
 *
 * @param origin - The origin to check
 * @param whitelist - List of allowed origins (takes precedence)
 * @param blacklist - List of blocked origins
 * @returns true if origin is allowed, false otherwise
 */
export function filterOrigin(origin: string, whitelist: readonly string[] = [], blacklist: readonly string[] = []): boolean {
  // Whitelist takes precedence - if defined and not empty, origin must be in it
  if (whitelist && whitelist.length > 0) {
    return whitelist.includes(origin)
  }

  // Check blacklist - if defined and not empty, origin must NOT be in it
  if (blacklist && blacklist.length > 0) {
    return !blacklist.includes(origin)
  }

  // No restrictions - allow by default
  return true
}
