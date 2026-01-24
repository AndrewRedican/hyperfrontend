import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'

/**
 * Checks if the target is iterable.
 * @param target - The target to check.
 * @returns `true` if the target is iterable, `false` otherwise.
 */
export const isIterable = (target: unknown): boolean => isIterableType(getType(target))
