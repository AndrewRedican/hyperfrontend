import { isIterable, getType, getKeysFromIterable } from '@hyperfrontend/data-utils'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createWeakSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/weak-set'

/**
 * Checks whether an object has circular references using WeakSet.
 * Safe for use with frozen objects since it only reads, never mutates.
 *
 * @param value - The value to check
 * @param seen - WeakSet of already-seen references
 * @returns True if circular reference detected
 */
function hasCircular(value: unknown, seen: WeakSet<object>): boolean {
  if (!isIterable(value)) return false

  const obj = value as object

  if (seen.has(obj)) return true

  seen.add(obj)

  const type = getType(value)
  const keys = getKeysFromIterable(value, type)
  for (const key of keys) {
    if (hasCircular((value as Record<string, unknown>)[key], seen)) {
      return true
    }
  }

  return false
}

/**
 * Asserts that the given value does not contain circular references.
 * Throws an Error if a circular reference is detected.
 *
 * Uses WeakSet-based cycle detection that works safely with frozen objects.
 *
 * @param value - The value to check for circular references
 * @param paramName - Name of the parameter for error messaging
 * @throws {Error} if circular reference is detected
 *
 * @example Checking for circular references
 * ```typescript
 * const config = { a: 1, b: 2 }
 * assertNoCircularRef(config, 'config') // OK
 *
 * const circular: Record<string, unknown> = { a: 1 }
 * circular.self = circular
 * assertNoCircularRef(circular, 'config') // Throws Error
 * ```
 */
export function assertNoCircularRef(value: unknown, paramName: string): void {
  if (hasCircular(value, createWeakSet())) {
    throw createError(`Circular reference detected in parameter "${paramName}"`)
  }
}
