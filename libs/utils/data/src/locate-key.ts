import type { Callback, DepthConfig } from './models'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { getIterableOperators } from './get-iterable-operators'
import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'
import { traverse } from './traverse'

/**
 * Returns a list of locations where the key name matches a pattern or an exact value anywhere in the data structure of the target.
 * A depth option is available to narrow down the iteration scope.
 * It supports other iterable data types, provided these have been made known using registerIterableClass.
 *
 * @param target - The target value to search within
 * @param pattern - The string or regular expression pattern to match against key names
 * @param options - Optional configuration to control traversal depth
 * @returns An array of paths to locations where the key pattern was found
 */
export const locateKey = (target: unknown, pattern: string | RegExp, options?: DepthConfig): string[][] => {
  const patternIsString = typeof pattern === 'string'
  if (!patternIsString && !(pattern instanceof RegExp)) throw createError('Expected pattern to be either a string of a regular expression.')
  const match = patternIsString ? (key: string) => key === pattern : (key: string) => pattern.test(key)
  const callback: Callback = (key, value, path, state) => {
    const type = getType(value)
    if (!isIterableType(type)) return
    const { getKeys } = getIterableOperators(type)
    getKeys(value).forEach((nextKey) => match(nextKey) && state.locations.push([...path, nextKey]))
  }
  return traverse(target, callback, <DepthConfig>{ depth: [0, '*'], ...options }, { locations: [] }).locations
}
