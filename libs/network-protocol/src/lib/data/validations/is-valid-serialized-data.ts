import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether the provided value is valid serialized data.
 * Serialized data must be a non-empty string.
 *
 * @param data - The value to validate as serialized data
 * @returns True if the value is a non-empty string, false otherwise
 *
 * @example Validating serialized data
 * ```typescript
 * isValidSerializedData('{"key":"value"}')
 * // => true
 *
 * isValidSerializedData('')
 * // => false
 * ```
 */
export function isValidSerializedData(data: unknown): boolean {
  return getType(data) === 'string' && (<string>data).length > 0
}
