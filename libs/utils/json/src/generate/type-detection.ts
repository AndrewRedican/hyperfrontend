import type { JsonType } from '../types/schema'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'

/**
 * Gets the JSON Schema type of a JavaScript value.
 *
 * @param value - The value to determine the type of
 * @returns The JSON Schema type
 * @example
 * ```typescript
 * getJsonType('hello')    // => 'string'
 * getJsonType(42)         // => 'integer'
 * getJsonType(3.14)       // => 'number'
 * getJsonType(true)       // => 'boolean'
 * getJsonType(null)       // => 'null'
 * getJsonType([1, 2, 3])  // => 'array'
 * getJsonType({ key: 1 }) // => 'object'
 * ```
 */
export function getJsonType(value: unknown): JsonType {
  if (value === null) return 'null'
  if (isArray(value)) return 'array'
  const t = typeof value
  switch (t) {
    case 'string':
      return 'string'
    case 'number':
      return isInteger(value) ? 'integer' : 'number'
    case 'boolean':
      return 'boolean'
    case 'object':
      return 'object'
    default:
      return 'null'
  }
}
