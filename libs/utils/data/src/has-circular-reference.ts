import type { ReferenceStack } from './models'
import { getIterableOperators } from './get-iterable-operators'
import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'
import { referenceStack } from './reference-stack'
import { getConfig, setConfig } from './shared/consts'

const hasCircularReferenceRecursive = (target: unknown, stack: ReferenceStack): boolean => {
  if (stack.exists(target)) return true
  const type = getType(target)
  if (!isIterableType(type)) return false
  stack.add(target)
  const { getKeys, read } = getIterableOperators(type)
  const keys = getKeys(target)
  const result = keys.some((key) => hasCircularReferenceRecursive(read(target, key), stack))
  stack.remove(target)
  return result
}

/**
 * Returns true for values that have circular references.
 * A reference that is shared between two branches is not a cycle; only a value that contains itself is.
 * It supports other iterable data types, provided these have been made known using registerIterableClass.
 *
 * @param target - The value to check for circular references
 * @returns True if the value contains circular references, false otherwise
 *
 * @example Detecting circular references
 * ```typescript
 * const obj = { a: {} }
 * obj.a.self = obj
 * hasCircularReference(obj) // true
 * hasCircularReference({ a: 1 }) // false
 * ```
 */
export const hasCircularReference = (target: unknown): boolean => {
  const originalSupportStatus = getConfig().detectCircularReferences
  if (!originalSupportStatus) {
    setConfig({ detectCircularReferences: true })
  }
  const stack = referenceStack()
  try {
    return hasCircularReferenceRecursive(target, stack)
  } finally {
    if (!originalSupportStatus) {
      setConfig({ detectCircularReferences: false })
    }
    stack.clear()
  }
}
