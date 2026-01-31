import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether a sender meets the required criteria of being a function.
 *
 * @param sender - The sender to validate
 * @returns True if the sender is valid, false otherwise
 */
export function isValidSender(sender: unknown): boolean {
  return getType(sender) === 'function'
}
