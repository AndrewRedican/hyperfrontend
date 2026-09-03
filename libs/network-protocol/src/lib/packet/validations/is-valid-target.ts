import { getType } from '@hyperfrontend/data-utils'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'

/**
 * Validates whether the provided value is a valid packet target identifier.
 * The target must be a 36-character UUID v4 string.
 *
 * @param target - The value to validate as a packet target
 * @returns True if the value is a valid UUID v4 string, false otherwise
 *
 * @example Validating packet targets
 * ```typescript
 * isValidTarget('6ba7b810-9dad-11d1-80b4-00c04fd430c8')
 * // => true
 *
 * isValidTarget('invalid')
 * // => false
 * ```
 */
export function isValidTarget(target: unknown): boolean {
  return getType(target) === 'string' && (target as string).length === 36 && isUuidV4(target as string)
}
