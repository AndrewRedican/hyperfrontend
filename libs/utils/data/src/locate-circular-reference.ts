import type { ReferenceStack } from './models'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { CircularReference } from './circular-reference'
import { getIterableOperators } from './get-iterable-operators'
import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'
import { referenceStack } from './reference-stack'
import { getConfig, setConfig } from './shared/consts'

const invalidmaxResults = 'Invalid maxResults argument.'

/**
 * Recursively searches for circular references in an object graph.
 *
 * @param target - The value to search
 * @param maxResults - Maximum number of results to find
 * @param path - Current path in the object graph
 * @param stack - Reference stack for tracking visited objects
 * @param result - Array to collect found circular references
 * @param root - Whether this is the root call
 * @returns Array of CircularReference objects found
 *
 * @example Recursively locating circular references
 * ```typescript
 * const stack = referenceStack()
 * locateCircularReferenceRecursive(obj, 1, [], stack, [], true)
 * ```
 */
export const locateCircularReferenceRecursive = (
  target: unknown,
  maxResults: '*' | number,
  path: string[],
  stack: ReferenceStack,
  result: CircularReference[],
  root = false
): CircularReference[] => {
  if (result.length === maxResults) return result
  if (stack.exists(target)) {
    result.push(new CircularReference(<[string, ...string[]]>path, path.slice(0, <number>stack.lastSeen(target))))
    return result
  }
  const type = getType(target)
  if (!isIterableType(type)) return result
  stack.add(target)
  const { getKeys, read } = getIterableOperators(type)
  const keys = getKeys(target)
  keys.forEach((key) => locateCircularReferenceRecursive(read(target, key), maxResults, [...path, key], stack, result))
  if (root) stack.clear()
  return result
}

/**
 * Returns a list of locations where circular references occur.
 * It supports other iterable data types, provided these have been made known using registerIterableClass.
 *
 * @param target - The value to search for circular references
 * @param maxResults - Maximum number of circular references to find (number or '*' for all)
 * @returns An array of CircularReference objects indicating locations of circular references
 *
 * @example Locating circular references
 * ```typescript
 * const obj = { a: {} }
 * obj.a.self = obj
 * locateCircularReference(obj) // [CircularReference { location: ['a', 'self'], target: [] }]
 * ```
 */
export const locateCircularReference = (target: unknown, maxResults: '*' | number = 1): CircularReference[] => {
  const resultsType = typeof maxResults
  if (!['string', 'number'].includes(resultsType)) throw createError(invalidmaxResults)
  if (resultsType === 'string' && maxResults !== '*') throw createError(invalidmaxResults)
  if (resultsType === 'number' && (<number>maxResults < 1 || [NaN, Infinity].includes(<number>maxResults)))
    throw createError(invalidmaxResults)
  const originalSupportStatus = getConfig().detectCircularReferences
  if (!originalSupportStatus) {
    setConfig({ detectCircularReferences: true })
  }
  const result = locateCircularReferenceRecursive(target, maxResults, [], referenceStack(), [], true)
  if (!originalSupportStatus) {
    setConfig({ detectCircularReferences: false })
  }
  return result
}
