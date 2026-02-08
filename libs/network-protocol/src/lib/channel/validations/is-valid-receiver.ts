import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether a receiver meets the required criteria of being a function.
 *
 * @param receiver - The receiver to validate
 * @returns True if the receiver is valid, false otherwise
 */
export function isValidReceiver(receiver: unknown): boolean {
  return getType(receiver) === 'function'
}
