import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'

/**
 * Checks if the target is iterable.
 *
 * @param target - The target to check.
 * @returns `true` if the target is iterable, `false` otherwise.
 *
 * @example Checking if value is iterable
 * ```typescript
 * isIterable([1, 2]) // true
 * isIterable({ a: 1 }) // true
 * isIterable('string') // false
 * ```
 */
export const isIterable = (target: unknown): boolean => isIterableType(getType(target))
