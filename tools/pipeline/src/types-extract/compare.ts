/**
 * One ordering for every sorted list the extraction writes, so generated files come out in the
 * same order whatever order their parts were found in.
 *
 * @module types-extract/compare
 */

/**
 * Compares two strings by code point.
 *
 * @param a - One string
 * @param b - The other
 * @returns Negative when `a` sorts first, positive when `b` does, zero when they are equal
 */
export function compareText(a: string, b: string): number {
  if (a < b) return -1
  return a > b ? 1 : 0
}
