import { getType } from '@hyperfrontend/data-utils'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'

/**
 * Validates whether the provided value is a valid packet origin identifier.
 * The origin must be a 36-character UUID v4 string.
 *
 * @param origin - The value to validate as a packet origin
 * @returns True if the value is a valid UUID v4 string, false otherwise
 *
 * @example Validating packet origins
 * ```typescript
 * isValidOrigin('550e8400-e29b-41d4-a716-446655440000')
 * // => true
 *
 * isValidOrigin('not-a-uuid')
 * // => false
 * ```
 */
export function isValidOrigin(origin: unknown): boolean {
  return getType(origin) === 'string' && (<string>origin).length === 36 && isUuidV4(<string>origin)
}
