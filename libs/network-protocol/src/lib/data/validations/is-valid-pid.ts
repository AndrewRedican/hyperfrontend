import { getType } from '@hyperfrontend/data-utils'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'

/**
 * Validates whether the provided value is a valid protocol ID (PID).
 * The PID must be a 36-character string in UUID v4 format.
 *
 * @param pid - The value to validate as a protocol ID
 * @returns True if the value is a valid UUID v4 string, false otherwise
 *
 * @example Validating protocol IDs
 * ```typescript
 * isValidPid('550e8400-e29b-41d4-a716-446655440000')
 * // => true
 *
 * isValidPid('not-a-uuid')
 * // => false
 * ```
 */
export function isValidPid(pid: unknown): boolean {
  return getType(pid) === 'string' && (<string>pid).length === 36 && isUuidV4(<string>pid)
}
