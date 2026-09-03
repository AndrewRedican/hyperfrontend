import type {
  TraversalCircular,
  TraversalNonCircular,
  Traversal,
  TraversalCreator,
  TraversalArgs,
  TraverseConfig,
  Condition,
  Callback,
  DepthConfig,
} from './models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { getKeysFromIterable } from './get-keys-from-iterable'
import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'
import { referenceStack } from './reference-stack'
import { getConfig } from './shared/consts'

const errorMessage = (thing: string, type: string) => `Expected ${thing} to be ${type}.`

const nextIterationDetails = (path: string[], key: string, value: unknown) => ({
  nextPath: [...path, key],
  nextValue: (value as Record<string, unknown>)[key],
})

const circularDependencyTraversal: TraversalCircular = (
  condition,
  callback,
  config,
  key,
  path,
  value,
  parent,
  state,
  stack,
  root = false
) => {
  if (stack.exists(value)) return state
  const ok = condition(config, key, value, path, parent)
  /* node:coverage ignore next */
  if (config.exitEarly) return state
  if (ok) callback(key, value, path, state, parent)
  stack.add(value)
  const type = getType(value)
  if (!isIterableType(type)) return state
  const keys = getKeysFromIterable(value, type)
  keys.forEach((key) => {
    const { nextPath, nextValue } = nextIterationDetails(path, key, value)
    circularDependencyTraversal(condition, callback, config, key, nextPath, nextValue, value, state, stack)
  })
  if (root) stack.clear()
  return state
}

const nonCircularDependencyTraversal: TraversalNonCircular = (condition, callback, config, key, path, value, parent, state) => {
  const ok = condition(config, key, value, path, parent)
  /* node:coverage ignore next */
  if (config.exitEarly) return state
  if (ok) callback(key, value, path, state, parent)
  const type = getType(value)
  if (!isIterableType(type)) return state
  const keys = getKeysFromIterable(value, type)
  keys.forEach((key) => {
    const { nextPath, nextValue } = nextIterationDetails(path, key, value)
    nonCircularDependencyTraversal(condition, callback, config, key, nextPath, nextValue, value, state)
  })
  return state
}

const traversal: Traversal = (target, condition, callback, options, state) => {
  if (typeof callback !== 'function') throw createError(errorMessage('callback', 'a function'))
  if (!(typeof options === 'object' && !isArray(options))) throw createError(errorMessage('options', 'an object'))
  if (!isArray(options.depth)) throw createError(errorMessage('options.depth', 'an array'))
  const [startDepth, maxDepth] = options.depth
  if (startDepth !== void 0 && typeof startDepth !== 'number') throw createError(errorMessage('options.depth.0', 'a number'))
  if (maxDepth !== void 0) {
    const maxDepthType = typeof maxDepth
    if (!['number', 'string'].includes(maxDepthType)) throw createError(errorMessage('options.depth.1', 'a number or a string'))
    if (maxDepthType === 'string' && maxDepth !== '*') throw createError("Only valid string value in options.depth.1 is '*'.")
  }
  const config = {
    depth: freeze([options.depth[0] ?? 0, options.depth[1] ?? '*']),
    exitEarly: false,
  } as TraverseConfig
  const initialArgs = [condition, callback, config, '', [], target, void 0, state] as TraversalArgs
  if (getConfig().detectCircularReferences) return circularDependencyTraversal(...initialArgs, referenceStack(), true)
  return nonCircularDependencyTraversal(...initialArgs)
}

/**
 * A higher-order function that takes a single predicate function to generate an algorithm that traverses data points
 * on a data structure. See traverse.
 *
 * @param condition - Predicate function to determine whether to traverse a data point
 * @returns A traversal function configured with the condition
 *
 * @example Creating custom traversal
 * ```typescript
 * const customTraverse = createTraversal((config, key, value) => value !== null)
 * customTraverse(data, callback, options)
 * ```
 */
export const createTraversal: TraversalCreator<unknown> = (condition) => (target, callback, options, state) =>
  traversal(target, condition, callback, options ?? { depth: [0, '*'] }, state ?? {})

const condition: Condition = (config, key, value, path) => !(path.length < config.depth[0] || (config.depth[1] as number) < path.length)

const traverseBetweenDepthRange = createTraversal(condition)

/**
 * Invokes a callback function for every data point in the data structure of the target value to let you do read and write operations.
 * A depth option is available to narrow down the iteration scope.
 *
 * @param target - The value to traverse
 * @param callback - Function to invoke for each data point
 * @param options - Optional configuration to control traversal depth
 * @param state - Optional state object to maintain across traversal callbacks
 * @returns The state object after traversal completes
 *
 * @example Traversing data structure
 * ```typescript
 * traverse({ a: { b: 1 } }, (key, value, path) => {
 *   console.log(path.join('.'), '=', value)
 * })
 * ```
 */
export const traverse = <T = unknown, S extends Record<string, unknown> = Record<string, unknown>>(
  target: T,
  callback: Callback,
  options?: DepthConfig,
  state?: S
): S => traverseBetweenDepthRange(target, callback, options, state)
