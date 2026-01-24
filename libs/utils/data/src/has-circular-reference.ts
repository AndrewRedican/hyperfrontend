import type { ReferenceStack } from './models'
import { referenceStack } from './reference-stack'
import { getConfig, setConfig } from './shared/consts'
import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'
import { getIterableOperators } from './get-iterable-operators'

const hasCircularReferenceRecursive = (target: unknown, stack: ReferenceStack, root = false): boolean => {
  if (stack.exists(target)) return true
  const type = getType(target)
  if (!isIterableType(type)) return false
  stack.add(target)
  const { getKeys, read } = getIterableOperators(type)
  const keys = getKeys(target)
  const result = keys.some((key) => hasCircularReferenceRecursive(read(target, key), stack))
  if (root) stack.clear()
  return result
}

/**
 * Returns true for values that have circular references.
 * It supports other iterable data types, provided these have been made known using registerIterableClass.
 */
export const hasCircularReference = (target: unknown): boolean => {
  const originalSupportStatus = getConfig().detectCircularReferences
  if (!originalSupportStatus) {
    setConfig({ detectCircularReferences: true })
  }
  const result = hasCircularReferenceRecursive(target, referenceStack(), true)
  if (!originalSupportStatus) {
    setConfig({ detectCircularReferences: false })
  }
  return result
}
