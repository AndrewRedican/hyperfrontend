import type { Callback, DepthConfig } from './models'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { getIterableOperators } from './get-iterable-operators'
import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'
import { traverse } from './traverse'

/**
 * Renames any key names that match a pattern or an exact value anywhere in the data structure of the target
 * and returns the location of keys that were edited.
 * A depth option is available to narrow down the iteration scope.
 * It supports other iterable data types, provided these have been made known using registerIterableClass.
 *
 * @param target - The target value to modify
 * @param pattern - The string or regular expression pattern to match against key names
 * @param name - The new name to assign to matching keys
 * @param options - Optional configuration to control traversal depth
 * @returns An array of paths to locations where keys were renamed
 *
 * @example Renaming keys in structure
 * ```typescript
 * const obj = { old: 1, nested: { old: 2 } }
 * renameKey(obj, 'old', 'new') // [['new'], ['nested', 'new']]
 * ```
 */
export const renameKey = (target: unknown, pattern: string | RegExp, name: string, options?: DepthConfig): string[][] => {
  const patternIsString = typeof pattern === 'string'
  if (!patternIsString && !(pattern instanceof RegExp)) throw createError('Expected pattern to be either a string of a regular expression.')
  if (typeof name !== 'string') throw createError('Expected name to be a string.')
  const match = patternIsString ? (key: string) => key === pattern : (key: string) => pattern.test(key)
  const rename = patternIsString ? () => name : (key: string) => key.replace(pattern, name)
  const callback: Callback = (key, value, path, state) => {
    const type = getType(value)
    if (!isIterableType(type)) return
    const { getKeys, read, write, remove } = getIterableOperators(type)
    getKeys(value).forEach((nextKey) => {
      if (!match(nextKey)) return
      const newKey = rename(nextKey)
      write(value, read(value, nextKey), newKey)
      remove(value, nextKey)
      state.locations.push([...path, newKey])
    })
  }
  return traverse(target, callback, { depth: [0, '*'], ...options } as DepthConfig, { locations: [] }).locations
}
