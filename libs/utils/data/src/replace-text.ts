import type { Callback, DepthConfig } from './models'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { getIterableOperators } from './get-iterable-operators'
import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'
import { traverse } from './traverse'

/**
 * Edits any text by replacing any string or substring that matches a pattern or an exact value anywhere in the data structure of the target
 * and returns the location of the original text that were edited.
 * A depth option is available to narrow down the iteration scope.
 * It supports other iterable data types, provided these have been made known using registerIterableClass.
 *
 * @param target - The target value to modify
 * @param pattern - The string or regular expression pattern to match against text values
 * @param text - The replacement text for matching values
 * @param options - Optional configuration to control traversal depth
 * @returns An array of paths to locations where text was replaced
 *
 * @example Replacing text in structure
 * ```typescript
 * const obj = { a: 'hello world', b: { c: 'hello' } }
 * replaceText(obj, 'hello', 'hi') // [['a'], ['b', 'c']]
 * ```
 */
export const replaceText = (target: unknown, pattern: string | RegExp, text: string, options?: DepthConfig): string[][] => {
  const patternIsString = typeof pattern === 'string'
  if (!patternIsString && !(pattern instanceof RegExp)) throw createError('Expected pattern to be either a string of a regular expression.')
  if (typeof text !== 'string') throw createError('Expected name to be a string.')
  const match = patternIsString ? (text: string) => text.includes(pattern) : (text: string) => pattern.test(text)
  const replace = (original: string) => original.replace(pattern, text)
  const callback: Callback = (key, value, path, state) => {
    const type = getType(value)
    if (!isIterableType(type)) return
    const { getKeys, read, write } = getIterableOperators(type)
    getKeys(value).forEach((nextKey) => {
      const nextValue = read(value, nextKey)
      if (getType(nextValue) !== 'string' || !match(<string>nextValue)) return
      write(value, replace(<string>nextValue), nextKey)
      state.locations.push([...path, nextKey])
    })
  }
  return traverse(target, callback, <DepthConfig>{ depth: [0, '*'], ...options }, { locations: [] }).locations
}
