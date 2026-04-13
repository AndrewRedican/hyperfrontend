import type { UnknownClass } from './models'
import { deregisterClassTypes } from './deregister-class-types'
import { registeredIterableClasses } from './shared/consts'

/**
 * Removes one or more registered iterable classes.
 * Removes all registered iterable classes except built-ins (Array and Object) when no references are provided.
 *
 * @param classRefs - The class constructors to deregister
 *
 * @example Deregistering iterable classes
 * ```typescript
 * deregisterIterableClass(MyCollection)
 * deregisterIterableClass() // clears all except Array/Object
 * ```
 */
export const deregisterIterableClass = <T = unknown>(...classRefs: UnknownClass<T>[]): void => {
  if (classRefs.length === 0) {
    for (let i = registeredIterableClasses.length - 1; i >= 0; i--) {
      const classRef = registeredIterableClasses[i].classRef
      if (![Array, Object].includes(<ArrayConstructor | ObjectConstructor>(<unknown>classRef))) {
        registeredIterableClasses.splice(i, 1)
      }
    }
  } else {
    const indexes = classRefs
      .map((classRef) => registeredIterableClasses.findIndex((entry) => entry.classRef === classRef))
      .filter((index) => index >= 0)
      .sort()
    while (indexes.length > 0) {
      registeredIterableClasses.splice(indexes[indexes.length - 1], 1)
      indexes.pop()
    }
  }
  deregisterClassTypes(...classRefs)
}
