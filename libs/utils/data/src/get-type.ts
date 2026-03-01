import type { DataType } from './models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { registeredClasses } from './shared/consts'

/**
 * Returns the data type of the target.
 * Uses native `typeof` operator, however, makes distinction between `null`, `array`, and `object`.
 * Also, when classes are registered via `registerClass`, it checks if objects are instance of any known registered class.
 *
 * @param target - The target to get the data type of.
 * @returns The data type of the target.
 */
export const getType = <T extends string = DataType>(target: unknown): T => {
  if (target === null) return <T>'null'
  const nativeDataType = typeof target
  if (nativeDataType === 'object') {
    if (isArray(target)) return <T>'array'
    for (const registeredClass of registeredClasses) {
      if (target instanceof registeredClass) return <T>registeredClass.name
    }
  }
  return <T>nativeDataType
}
