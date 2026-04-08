import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether the provided name is valid for protocol registration.
 * The name must be a non-empty string.
 *
 * @param name - The name to validate
 * @returns True if the name is a non-empty string, false otherwise
 *
 * @example
 * ```typescript
 * isValidName('websocket')
 * // => true
 *
 * isValidName('')
 * // => false
 * ```
 */
export function isValidName(name: string): boolean {
  return getType(name) === 'string' && name.length >= 1
}
