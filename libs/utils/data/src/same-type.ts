import type { DataType } from './models'
import { getType } from './get-type'

/**
 * Checks if two targets are of the same data type.
 * @param targetA The first target to compare
 * @param targetB The second target to compare
 * @returns The common data type if both targets are of the same type; otherwise, false.
 */
export const sameType = <T extends string = DataType>(targetA: unknown, targetB: unknown): T | false => {
  const firstType = getType<T>(targetA)
  const secondType = getType<T>(targetB)
  return firstType === secondType ? firstType : false
}
