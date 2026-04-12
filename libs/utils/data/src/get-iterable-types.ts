import type { DataType } from './models'
import { registeredIterableClasses } from './shared/consts'

/**
 * Returns a list of iterable data types. By default 'array' and 'object' are included.,
 * but can be extended by using `registerIterableClass`.
 *
 * @returns Array of iterable data types.
 *
 * @example Listing registered iterable types
 * ```typescript
 * getIterableTypes() // ['array', 'object', ...registered types]
 * ```
 */
export const getIterableTypes = <T extends string = DataType>(): T[] =>
  registeredIterableClasses.map(({ classRef }) => {
    const name = classRef.name
    if (name === Object.name) return <T>'object'
    if (name === Array.name) return <T>'array'
    return <T>name
  })
