import type { DataType, IterableOperators } from './models'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { getIterableOperators } from './get-iterable-operators'
import { getType } from './get-type'
import { DefaultValueOptions } from './get-value.model'
import { isIterableType } from './is-iterable-type'

/**
 * Gets the value at the specified path from the target.
 *
 * @param target - The target to get the value from.
 * @param path - The path to the value.
 * @param defaultValue - The default value to return if the path does not exist or an error occurs.
 * @returns The value at the specified path or the default value.
 * @throws {Error} Will throw an error if the path is not a non-empty array of strings and no default value for errors is provided.
 * @remarks
 * - If `defaultValue.onMissingKey` is provided, it will be returned when a key in the path is missing.
 * - If `defaultValue.onError` is provided, it will be returned when any error occurs during the retrieval process.
 */
export const getValue = <T = unknown>(target: unknown, path: [string, ...string[]], defaultValue?: DefaultValueOptions<T>): T => {
  if (isArray(path) === false) {
    throw new Error('Expected path to be a non-empty array of strings.')
  }
  if (path.length === 0) return <T>target
  const hasOnMissingKeyDefault = !!(defaultValue && 'onMissingKey' in defaultValue)
  const hasOnErrorDefault = !!(defaultValue && 'onError' in defaultValue)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scope: any
  let scopeType: DataType
  let scopeIterable: boolean
  let scopeOperators: IterableOperators
  try {
    scope = target
    for (let index = 0; index < path.length; index += 1) {
      const key = path[index]
      if (typeof key !== 'string') {
        throw new Error(`Expected path[${index}] to be a string, got ${typeof key}.`)
      }
      scopeType = getType(scope)
      scopeIterable = isIterableType(scopeType)
      /* instanbul ignore next */
      if (!scopeIterable && hasOnMissingKeyDefault) {
        scope = defaultValue.onMissingKey
        break
      }
      scopeOperators = getIterableOperators(scopeType)
      if (scopeIterable && !scopeOperators.getKeys(scope).includes(key) && hasOnMissingKeyDefault) {
        scope = defaultValue.onMissingKey
        break
      }
      scope = scopeOperators.read(scope, key)
    }
  } catch (error) {
    if (hasOnErrorDefault) {
      scope = defaultValue.onError
    } else {
      throw error
    }
  }
  return scope
}
