/**
 * Generates a simple hash code from a string input.
 * Uses a basic hash algorithm suitable for non-cryptographic purposes.
 *
 * @param input - The string to hash
 * @returns A 6-character alphanumeric hash string
 *
 * @example
 * ```typescript
 * simpleHash('user@example.com')
 * // => 'a1b2c3'
 *
 * simpleHash('hello world')
 * // => 'd4e5f6'
 * ```
 */
export function simpleHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  let hashStr = (hash & 0xffffffff).toString(36)
  if (hashStr.length > 6) {
    hashStr = hashStr.substr(0, 6)
  } else {
    hashStr = hashStr.padEnd(6, '0')
  }
  return hashStr
}
