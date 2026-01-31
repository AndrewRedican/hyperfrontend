import type { Callback, Options } from './models'
import { traverse } from './traverse'
import { getType } from './get-type'

/**
 * Returns a list of locations where a text value matches a pattern or an exact value anywhere in the data structure of the target.
 * A depth option is available to narrow down the iteration scope.
 * It supports other iterable data types, provided these have been made known using registerIterableClass.
 *
 * @param target - The target value to search within
 * @param pattern - The string or regular expression pattern to match against text values
 * @param options - Optional configuration to control traversal depth
 * @returns An array of paths to locations where the text pattern was found
 */
export const locateText = (target: unknown, pattern: string | RegExp, options?: Options): string[][] => {
  const patternIsString = typeof pattern === 'string'
  if (!patternIsString && !(pattern instanceof RegExp)) throw new Error('Expected pattern to be either a string of a regular expression.')
  const match = patternIsString ? (text: string) => text === pattern : (key: string) => pattern.test(key)
  const callback: Callback = (key, value, path, state) =>
    getType(value) === 'string' && match(value as string) && state.locations.push(path)
  return traverse(target, callback, { depth: [0, '*'], ...options } as Options, { locations: [] }).locations
}
