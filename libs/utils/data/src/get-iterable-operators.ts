import type { DataType, IterableOperators, RegisteredIterableClassEntry } from './models'
import { registeredIterableClasses } from './shared/consts'

/**
 * Retrieves iterable operators for a given data type.
 *
 * @param dataType - The type of data to get operators for
 * @returns Object containing getKeys, read, write, remove, and instantiate operators
 *
 * @example
 * ```typescript
 * const ops = getIterableOperators('array')
 * const keys = ops.getKeys([1, 2, 3]) // ['0', '1', '2']
 * ```
 */
export const getIterableOperators = <T extends string = DataType>(dataType: T): IterableOperators => {
  const { getKeys, read, write, remove, instantiate } = <RegisteredIterableClassEntry<unknown>>(
    registeredIterableClasses.find((e) => e.classRef.name.toLowerCase() === dataType.toLowerCase())
  )
  return { getKeys, read, write, remove, instantiate }
}
