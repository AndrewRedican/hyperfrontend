import type { UnknownClass } from './models'
import { registeredClasses } from './shared/consts'

/**
 * Removes one or more registered classes used to identify values as distinct data types.
 *
 * @param classRefs - One or more class references to deregister. If none provided, all registered classes will be deregistered.
 *
 * @example
 * ```typescript
 * deregisterClassTypes(MyCustomClass)
 * deregisterClassTypes() // clears all
 * ```
 */
export const deregisterClassTypes = (...classRefs: UnknownClass<unknown>[]): void => {
  if (classRefs.length === 0) {
    while (registeredClasses.length !== 0) registeredClasses.shift()
    return
  }
  const indexes = classRefs
    .map((classRef) => registeredClasses.indexOf(classRef))
    .filter((index) => index >= 0)
    .sort()
  while (indexes.length !== 0) {
    registeredClasses.splice(indexes[indexes.length - 1], 1)
    indexes.pop()
  }
}
