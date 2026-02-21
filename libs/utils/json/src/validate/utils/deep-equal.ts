/**
 * Performs deep equality check for JSON values.
 *
 * Used for enum validation and uniqueItems validation.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns true if values are deeply equal, false otherwise
 */
export function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) {
        if (!isEqual(a[i], b[i])) return false
      }
      return true
    }

    if (Array.isArray(a) || Array.isArray(b)) return false

    const keysA = Object.keys(<object>a)
    const keysB = Object.keys(<object>b)
    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false
      if (!isEqual((<Record<string, unknown>>a)[key], (<Record<string, unknown>>b)[key])) return false
    }
    return true
  }

  return false
}
