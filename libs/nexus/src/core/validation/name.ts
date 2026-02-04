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
 */
export function validateName(name: string): void {
  if (name === null || name === undefined) {
    throw new Error('Name cannot be null or undefined')
  }

  if (typeof name !== 'string') {
    throw new Error('Name must be a string')
  }

  if (isEmpty(name)) {
    throw new Error('Name cannot be empty')
  }
}
