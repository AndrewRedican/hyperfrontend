import { getType } from '@hyperfrontend/data-utils'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'

/**
 * Validates whether the provided value is a valid data message ID.
 * The ID must be a 36-character string in UUID v4 format.
 *
 * @param id - The value to validate as a data message ID
 * @returns True if the value is a valid UUID v4 string, false otherwise
 *
 * @example
 * ```typescript
 * isValidId('550e8400-e29b-41d4-a716-446655440000')
 * // => true
 *
 * isValidId('invalid-id')
 * // => false
 * ```
 */
export function isValidId(id: unknown): boolean {
  return getType(id) === 'string' && (<string>id).length === 36 && isUuidV4(<string>id)
}
