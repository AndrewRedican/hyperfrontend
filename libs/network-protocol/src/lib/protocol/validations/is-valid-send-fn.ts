import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether the provided value is a valid send function.
 * The send function must be callable.
 *
 * @param send - The value to validate as a send function
 * @returns True if the value is a function, false otherwise
 */
export function isValidSendFn(send: unknown) {
  return getType(send) === 'function'
}
