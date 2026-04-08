import { isSHA256Hash } from '@hyperfrontend/cryptography/common'

/**
 * Validates whether the provided value is a valid schema hash.
 * The hash must be a valid SHA-256 hash string.
 *
 * @param schemaHash - The value to validate as a schema hash
 * @returns True if the value is a valid SHA-256 hash, false otherwise
 *
 * @example
 * ```typescript
 * isValidSchemaHash('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
 * // => true
 *
 * isValidSchemaHash('invalid-hash')
 * // => false
 * ```
 */
export function isValidSchemaHash(schemaHash: unknown): boolean {
  return isSHA256Hash(schemaHash)
}
