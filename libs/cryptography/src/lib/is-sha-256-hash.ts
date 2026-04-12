import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether the provided value is a valid SHA-256 hash string.
 * Checks for exactly 64 hexadecimal characters (case-insensitive).
 *
 * @param hash - The value to validate as a SHA-256 hash
 * @returns True if the value is a valid SHA-256 hash string, false otherwise
 *
 * @example Validating SHA-256 hashes
 * ```typescript
 * isSHA256Hash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
 * // => true
 *
 * isSHA256Hash('invalid')
 * // => false
 * ```
 */
export function isSHA256Hash(hash: unknown): boolean {
  return getType(hash) === 'string' ? /^[a-f0-9]{64}$/i.test(<string>hash) : false
}
