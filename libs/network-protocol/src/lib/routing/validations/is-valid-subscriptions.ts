/**
 * Validates whether the provided value is a valid subscriptions collection.
 * Subscriptions must be stored in a WeakMap instance.
 *
 * @param subscriptions - The value to validate as a subscriptions collection
 * @returns True if the value is a WeakMap, false otherwise
 *
 * @example Validating a subscriptions collection
 * ```typescript
 * isValidSubscriptions(new WeakMap())
 * // => true
 *
 * isValidSubscriptions(new Map())
 * // => false
 * ```
 */
export function isValidSubscriptions(subscriptions: unknown): boolean {
  return subscriptions instanceof WeakMap
}
