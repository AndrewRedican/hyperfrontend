import { getKeysFromIterable } from './get-keys-from-iterable'
import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'

/**
 * Checks if the target contains all specified keys.
 *
 * @param target - The target to check.
 * @param keys - The keys to check for.
 * @returns True if the target contains all specified keys, false otherwise.
 * @remarks
 * Works with objects, arrays, and registered iterable classes.
 * An empty keys array will always return `false`.
 */
export const containsKeys = (target: unknown, keys: string[]): boolean => {
  if (keys.length === 0) return false
  const dataType = getType(target)
  if (isIterableType(dataType) === false) return false
  const targetKeys = getKeysFromIterable(target, dataType)
  return !keys.some((k) => !targetKeys.includes(k))
}
