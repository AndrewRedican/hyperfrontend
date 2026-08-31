import type { DataType } from './models'
import { registeredIterableClasses } from './shared/consts'

/**
 * Gets the keys from an iterable target based on its data type.
 *
 * @param target - The target to get the keys from.
 * @param dataType - The data type of the target.
 * @returns The keys from the iterable target.
 *
 * @example Extracting keys from object
 * ```typescript
 * getKeysFromIterable({ a: 1, b: 2 }, 'object') // ['a', 'b']
 * ```
 */
export const getKeysFromIterable = <T extends string = DataType>(target: unknown, dataType: T): string[] => {
  if (dataType === 'array') dataType = Array.name as T
  if (dataType === 'object') dataType = Object.name as T
  const iterableClass = registeredIterableClasses.find(({ classRef }) => dataType === (classRef.name as T))
  if (iterableClass === undefined) return []
  return iterableClass.getKeys(target)
}
