/* eslint-disable @typescript-eslint/no-unused-vars */
import { getIterableOperators } from './get-iterable-operators'
import { getType } from './get-type'
import { isIterableType } from './is-iterable-type'
import { ReferenceStack } from './models'
import { referenceStack } from './reference-stack'
import { SelectiveCopyOptions, SelectiveCopyPredicate, DataPointOperation, DataPoint, ReferenceLoop } from './selective-copy.model'
import { getConfig } from './shared/consts'

export const selectiveCopyRecursive = <T extends Record<string, unknown>>(
  target: T,
  path: string[],
  includeKey: SelectiveCopyPredicate,
  skipFunctions: boolean,
  recordSkip: DataPointOperation
): Partial<T> => {
  const type = getType(target)
  if (!isIterableType(type)) return target
  const { instantiate, getKeys, read, write } = getIterableOperators(type)
  const iterableInstance = instantiate()
  const keys = getKeys(target)
  for (let i = 0; i < keys.length; i += 1) {
    const nextKey = keys[i]
    // Filter out __proto__ to prevent prototype pollution attacks
    if (nextKey === '__proto__') continue
    const nextTarget = read(target, nextKey)
    const nextPath = path.concat(nextKey)
    const nextType = getType(nextTarget)
    if (!includeKey(nextTarget, nextPath, nextKey, nextType) || (skipFunctions && nextType === 'function')) {
      recordSkip(nextTarget, nextPath, nextKey, nextType)
      continue
    }
    write(
      iterableInstance,
      selectiveCopyRecursive(nextTarget as Record<string, unknown>, nextPath, includeKey, skipFunctions, recordSkip),
      nextKey
    )
  }
  return iterableInstance as Partial<T>
}

/**
 * Creates a clone of the target. Options can be provided to selectively copy values.
 * This algorithm is able detect circular references, and optionally clone them.
 *
 * @param target - The object to clone
 * @param path - The current path in the data structure
 * @param includeKey - Predicate function to determine if a key should be included
 * @param skipFunctions - Whether to skip function values
 * @param recordSkip - Callback to record skipped data points
 * @param stack - Reference stack for tracking circular references
 * @param circularRefs - Array to store circular reference information
 * @param root - Whether this is the root call
 * @returns A partial clone of the target object
 */
export const selectiveCopyForCircularReferencesRecursive = <T extends Record<string, unknown>>(
  target: T,
  path: string[],
  includeKey: SelectiveCopyPredicate,
  skipFunctions: boolean,
  recordSkip: DataPointOperation,
  stack: ReferenceStack,
  circularRefs: ReferenceLoop[],
  root = false
): Partial<T> => {
  if (root) {
    stack.add(target)
  }
  const type = getType(target)
  if (!isIterableType(type)) return target
  const { instantiate, getKeys, read, write } = getIterableOperators(type)
  const iterableInstance = instantiate()
  const keys = getKeys(target)
  for (let i = 0; i < keys.length; i += 1) {
    const nextKey = keys[i]
    // Filter out __proto__ to prevent prototype pollution attacks
    if (nextKey === '__proto__') continue
    const nextTarget = read(target, nextKey)
    const nextPath = path.concat(nextKey)
    const nextType = getType(nextTarget)
    if (!includeKey(nextTarget, nextPath, nextKey, nextType) || (skipFunctions && nextType === 'function')) {
      recordSkip(nextTarget, nextPath, nextKey, nextType)
      continue
    }
    const hasCircularRef = stack.exists(nextTarget)
    if (hasCircularRef) {
      circularRefs.push({
        startPath: nextPath,
        destinationPath: nextPath.slice(0, stack.lastSeen(nextTarget) as number),
      })
      continue
    }
    stack.add(nextTarget)
    write(
      iterableInstance,
      selectiveCopyForCircularReferencesRecursive(
        nextTarget as Record<string, unknown>,
        nextPath,
        includeKey,
        skipFunctions,
        recordSkip,
        stack,
        circularRefs
      ),
      nextKey
    )
  }
  if (root) {
    circularRefs.forEach(({ startPath, destinationPath }) => {
      let [start, destination] = [iterableInstance, iterableInstance] as [Record<string, unknown>, Record<string, unknown>]

      for (let i = 0; i < startPath.length - 1; i += 1) {
        /* istanbul ignore else */
        if (startPath[i] !== '__proto__') {
          start = start[startPath[i]] as Record<string, unknown>
        }
      }

      for (let j = 0; j < destinationPath.length; j += 1) {
        /* istanbul ignore else */
        if (destinationPath[j] !== '__proto__') {
          destination = destination[destinationPath[j]] as Record<string, unknown>
        }
      }

      // Set the circular reference
      const lastKey = startPath[startPath.length - 1]
      /* istanbul ignore else -- __proto__ is already filtered during iteration, this is defensive */
      if (lastKey !== '__proto__') {
        start[lastKey] = destination
      }
    })
    stack.clear()
  }
  return iterableInstance as Partial<T>
}

/**
 * Creates a clone of the target. Options can be provided to selectively copy values.
 * Due to JavaScript language limitations context of bound functions is not known, thus functions cannot be reliably cloned.
 * This algorithm instead copies function references by default instead. For the same reason getters and setters are not replicate, only their
 * return values. This algorithm can replicate circular references, when configured to do so.
 * It supports other iterable data types, provided these have been made known using registerIterableClass.
 *
 * @param target - The value to clone
 * @param options - Configuration options for selective copying
 * @returns An object containing the cloned value and array of skipped data points
 */
export const selectiveCopy = <T = unknown>(target: T, options?: SelectiveCopyOptions): { clone: Partial<T>; skipped: DataPoint[] } => {
  if (options !== void 0 && getType(options) !== 'object') throw new Error('Invalid options argument.')
  if (!options) options = {}
  if (!options.skipFunctions) options.skipFunctions = false
  const keys = ['includeKeys', 'excludeKeys', 'include', 'exclude']
  let found = ''
  for (let i = 0; i < keys.length; i += 1) {
    const included = keys[i] in options
    if (found && included) throw new Error(`Options ${found} and ${keys[i]} are mutually exclusive.`)
    if (included) found = keys[i]
  }
  const { includeKeys, excludeKeys, include, exclude, skipFunctions } = options as Required<SelectiveCopyOptions>
  let includeKey: SelectiveCopyPredicate = (target, path, key, dataType) => true
  switch (found) {
    case 'includeKeys':
      includeKey = (target, path, key, dataType) => (path.length === 1 ? includeKeys.includes(key as string) : true)
      break
    case 'excludeKeys':
      includeKey = (target, path, key, dataType) => (path.length === 1 ? !excludeKeys.includes(key as string) : true)
      break
    case 'include':
      includeKey = include
      break
    case 'exclude':
      includeKey = (target, path, key, dataType) => !exclude(target, path, key, dataType)
      break
  }
  const skipped: DataPoint[] = []
  const recordSkip: DataPointOperation = (target, path, key, dataType) => skipped.push({ target, path, key, dataType })
  let clone: T
  if (getConfig().detectCircularReferences) {
    clone = selectiveCopyForCircularReferencesRecursive(
      target as Record<string, unknown>,
      [],
      includeKey,
      skipFunctions,
      recordSkip,
      referenceStack(),
      [],
      true
    ) as T
  } else {
    clone = selectiveCopyRecursive(target as Record<string, unknown>, [], includeKey, skipFunctions, recordSkip) as T
  }
  return { clone, skipped }
}
