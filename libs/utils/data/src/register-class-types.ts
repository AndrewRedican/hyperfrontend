import type { UnknownClass } from './models'
import { registeredClasses } from './shared/consts'

/**
 * Registers one or more classes which will be used to identify values as distinct data types.
 * @param classRefs - One or more class references to register.
 */
export const registerClassTypes = (...classRefs: UnknownClass[]): void =>
  classRefs.forEach((classRef) => !registeredClasses.includes(classRef) && registeredClasses.push(classRef))
