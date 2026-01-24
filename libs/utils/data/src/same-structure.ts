import type { DataType } from './models'
import { sameType } from './same-type'
import { isIterableType } from './is-iterable-type'
import { getKeysFromIterable } from './get-keys-from-iterable'
import { getConfig } from './shared/consts'

/**
 * Checks whether two targets have the same structure.
 * @remarks
 * For iterable types (arrays, sets, maps, and objects), it checks whether they have the same keys.
 * For other types, it simply checks whether they are of the same type.
 * It supports configuration via `getConfig().samePositionOfOwnProperties` to determine whether the order of keys matters for objects.
 * If supports other registered iterable classes as well. See `registerIterableClass`.
 * @param targetA data to compare
 * @param targetB data to compare
 * @returns The data type if both targets have the same structure, otherwise `false`.
 */
export const sameStructure = (targetA: unknown, targetB: unknown): DataType | false => {
  const typeMatch = sameType(targetA, targetB)
  if (typeMatch === false) return false
  if (isIterableType(typeMatch)) {
    const aKeys = getKeysFromIterable(targetA, typeMatch)
    const bKeys = getKeysFromIterable(targetB, typeMatch)
    const aKeyCount = aKeys.length
    const bKeyCount = bKeys.length
    if (aKeyCount !== bKeyCount) return false
    if (aKeyCount === 0) return typeMatch
    if (getConfig().samePositionOfOwnProperties) {
      for (let i = 0; i < aKeyCount; i += 1) {
        if (aKeys[i] !== bKeys[i]) return false
      }
    } else {
      for (let i = 0; i < aKeyCount; i += 1) {
        if (!bKeys.includes(aKeys[i])) return false
      }
    }
  }
  return typeMatch
}
