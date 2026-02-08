import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether the provided value is a valid SHA-256 hash string.
 * Checks for exactly 64 hexadecimal characters (case-insensitive).
 *
 * @param hash - The value to validate as a SHA-256 hash
 * @returns True if the value is a valid SHA-256 hash string, false otherwise
 */
export function isSHA256Hash(hash: unknown): boolean {
  return getType(hash) === 'string' ? /^[a-f0-9]{64}$/i.test(<string>hash) : false
}
