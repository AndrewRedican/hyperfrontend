import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Helper to check if a string is empty after trimming
 *
 * @param str - The string to check
 * @returns True if string is empty after trimming
 */
function isEmpty(str: string): boolean {
  return str.trim().length === 0
}

/**
 * Validates a channel or broker name.
 *
 * @param name - The name to validate
 * @throws {Error} Error if name is invalid
 *
 * @example Validating channel name
 * ```typescript
 * validateName('my-channel') // valid
 * validateName('') // throws Error
 * ```
 */
export function validateName(name: string): void {
  if (name === null || name === undefined) {
    throw createError('Name cannot be null or undefined')
  }

  if (typeof name !== 'string') {
    throw createError('Name must be a string')
  }

  if (isEmpty(name)) {
    throw createError('Name cannot be empty')
  }
}
