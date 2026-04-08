import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether a sender meets the required criteria of being a function.
 *
 * @param sender - The sender to validate
 * @returns True if the sender is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidSender((packet) => transmit(packet)) // => true
 * isValidSender(null) // => false
 * ```
 */
export function isValidSender(sender: unknown): boolean {
  return getType(sender) === 'function'
}
