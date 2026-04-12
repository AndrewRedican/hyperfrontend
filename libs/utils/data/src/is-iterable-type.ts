import type { DataType } from './models'
import { getIterableTypes } from './get-iterable-types'

/**
 * Checks if the provided data type is registered as an iterable type.
 *
 * @param dataType - The data type to check
 * @returns `true` if the data type is iterable, otherwise `false`
 *
 * @example Checking iterable types
 * ```typescript
 * isIterableType('array') // true
 * isIterableType('object') // true
 * isIterableType('string') // false
 * ```
 */
export const isIterableType = <T extends string = DataType>(dataType: T): boolean => getIterableTypes<T>().includes(dataType)
