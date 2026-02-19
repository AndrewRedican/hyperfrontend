import type { JsonType } from '../types'

/**
 * Gets the JSON Schema type of a JavaScript value.
 *
 * @param value - The value to determine the type of
 * @returns The JSON Schema type
 */
export function getJsonType(value: unknown): JsonType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  const t = typeof value
  switch (t) {
    case 'string':
      return 'string'
    case 'number':
      return Number.isInteger(value) ? 'integer' : 'number'
    case 'boolean':
      return 'boolean'
    case 'object':
      return 'object'
    default:
      // For functions, symbols, undefined - treat as null
      return 'null'
  }
}
