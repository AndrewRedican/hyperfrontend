import { traverse } from './traverse'
import type { Callback, Options } from './models'

/**
 * Returns the total depth of a value's data structure,
 * and returns a list of locations that are the most deeply nested.
 * It supports other iterable data types, provided these have been made known using registerIterableClass.
 *
 * @param target - The target value to analyze for depth
 * @returns A tuple containing the maximum depth and an array of paths to the deepest locations
 */
export const getDepth = (target: unknown): [number, string[][]] => {
  const trackDepth: Callback = (key, value, path, state) => {
    if (state.depth < path.length) {
      state.depth = path.length
      state.locations = [path]
      return
    }
    if (state.depth === path.length) {
      state.locations.push(path)
    }
  }
  const options: Options = { depth: [0, '*'] }
  const state = { depth: 0, locations: [] }
  const { depth, locations } = traverse(target, trackDepth, options, state)
  return [depth, locations]
}
