import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether the provided value is a valid receive function.
 * The receive function must be callable.
 *
 * @param receive - The value to validate as a receive function
 * @returns True if the value is a function, false otherwise
 *
 * @example
 * ```typescript
 * isValidReceiveFn((packet) => console.log(packet))
 * // => true
 *
 * isValidReceiveFn(null)
 * // => false
 * ```
 */
export function isValidReceiveFn(receive: unknown) {
  return getType(receive) === 'function'
}
