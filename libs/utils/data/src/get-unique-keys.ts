import type { Callback, DepthConfig } from './models'
import { traverse } from './traverse'
import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'
import { getIterableOperators } from './get-iterable-operators'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'

/**
 * Returns a list of unique key names that match a pattern or an exact value anywhere in the data structure of the target.
 * A depth option is available to narrow down the iteration scope.
 * It supports other iterable data types, provided these have been made known using registerIterableClass.
 *
 * @param target - The target value to search within
 * @param pattern - The string or regular expression pattern to match against key names (defaults to matching all keys)
 * @param options - Optional configuration to control traversal depth
 * @returns An array of unique key names that match the pattern
 */
export const getUniqueKeys = (target: unknown, pattern: string | RegExp = /.+/, options?: DepthConfig): string[] => {
  const patternIsString = typeof pattern === 'string'
  if (!patternIsString && !(pattern instanceof RegExp)) throw new Error('Expected pattern to be either a string of a regular expression.')
  const match = patternIsString ? (key: string) => key === pattern : (key: string) => pattern.test(key)
  const callback: Callback = (key, value, path, state) => {
    const type = getType(value)
    if (!isIterableType(type)) return
    const { getKeys } = getIterableOperators(type)
    getKeys(value).forEach((nextKey) => match(nextKey) && state.names.add(nextKey))
  }
  return from(
    traverse(target, callback, { depth: [0, '*'], ...options } as DepthConfig, {
      names: new Set<string>(),
    }).names.values()
  )
}
