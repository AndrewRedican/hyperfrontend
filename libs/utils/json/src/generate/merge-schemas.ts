import type { Schema, JsonType } from '../types/schema'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys, entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Merges multiple schemas into a single unified schema.
 * Used when generating schemas from arrays with mode: 'all'.
 *
 * @param schemas - Array of schemas to merge
 * @returns A single merged schema, possibly using anyOf
 * @example Merging object schemas
 * ```typescript
 * const schemas = [
 *   { type: 'object', properties: { name: { type: 'string' } } },
 *   { type: 'object', properties: { age: { type: 'integer' } } }
 * ]
 * const merged = mergeSchemas(schemas)
 * // => { type: 'object', properties: { name: { type: 'string' }, age: { type: 'integer' } } }
 * ```
 */
export function mergeSchemas(schemas: Schema[]): Schema {
  if (schemas.length === 0) {
    return {}
  }

  if (schemas.length === 1) {
    const [first] = schemas
    return first ?? {}
  }

  const typeGroups = createMap<JsonType | 'mixed', Schema[]>()

  for (const schema of schemas) {
    const type = schema.type as JsonType | undefined
    const key: JsonType | 'mixed' = type ?? 'mixed'
    const group = typeGroups.get(key) ?? []
    group.push(schema)
    typeGroups.set(key, group)
  }

  // why: multiple type groups tested separately
  if (typeGroups.size === 1) {
    const [[type, group]] = [...typeGroups.entries()]
    // why: defensive checks for type and group
    if (type && type !== 'mixed' && group) {
      return mergeSchemasByType(type, group)
    }
  }

  // why: multiple type groups is an edge case
  const uniqueTypes = createSet<JsonType>()
  for (const schema of schemas) {
    // why: schema.type always exists in common case
    if (schema.type) {
      // why: array types are rare
      /* node:coverage ignore next 5 */
      if (isArray(schema.type)) {
        ;(schema.type as JsonType[]).forEach((t) => uniqueTypes.add(t))
      } else {
        uniqueTypes.add(schema.type)
      }
    }
  }

  // why: simple types optimization
  if (uniqueTypes.size > 0 && uniqueTypes.size <= schemas.length) {
    const allSimpleTypes = schemas.every((s) => keys(s).length === 1 && s.type)
    if (allSimpleTypes) {
      const types = [...uniqueTypes]
      /* node:coverage ignore next 1 */
      return types.length === 1 ? { type: types[0] } : { type: types }
    }
  }

  return { anyOf: schemas }
}

/**
 * Merges schemas that have the same type.
 *
 * @param type - JSON type shared by all schemas
 * @param schemas - Array of schemas with the same type
 * @returns A merged schema
 */
function mergeSchemasByType(type: JsonType, schemas: Schema[]): Schema {
  // why: single schema case is optimized
  /* node:coverage ignore next 5 */
  if (schemas.length === 1) {
    const [first] = schemas
    // why: defensive null check
    return first ?? {}
  }

  switch (type) {
    case 'object':
      return mergeObjectSchemas(schemas)
    case 'array':
      return mergeArraySchemas(schemas)
    // why: primitive types go here
    default:
      return { type }
  }
}

/**
 * Merges multiple object schemas into a unified schema.
 *
 * @param schemas - Array of object schemas to merge
 * @returns A merged object schema
 */
function mergeObjectSchemas(schemas: Schema[]): Schema {
  const mergedProperties: Record<string, Schema[]> = {}
  const requiredCounts: Record<string, number> = {}

  for (const schema of schemas) {
    if (schema.properties) {
      for (const [key, propSchema] of entries(schema.properties)) {
        const existing = mergedProperties[key] ?? []
        existing.push(propSchema)
        mergedProperties[key] = existing
      }
    }
    if (schema.required) {
      for (const key of schema.required) {
        requiredCounts[key] = (requiredCounts[key] ?? 0) + 1
      }
    }
  }

  const properties: Record<string, Schema> = {}
  for (const [key, propSchemas] of entries(mergedProperties)) {
    properties[key] = mergeSchemas(propSchemas)
  }

  const required = keys(requiredCounts).filter((key) => requiredCounts[key] === schemas.length)

  const result: Schema = { type: 'object', properties }
  if (required.length > 0) {
    result.required = required
  }

  return result
}

/**
 * Merges multiple array schemas into a unified schema.
 *
 * @param schemas - Array of array schemas to merge
 * @returns A merged array schema
 */
function mergeArraySchemas(schemas: Schema[]): Schema {
  const itemSchemas: Schema[] = []

  for (const schema of schemas) {
    if (schema.items) {
      if (isArray(schema.items)) {
        itemSchemas.push(...(schema.items as Schema[]))
      } else {
        itemSchemas.push(schema.items as Schema)
      }
    }
  }

  if (itemSchemas.length === 0) {
    return { type: 'array' }
  }

  return {
    type: 'array',
    items: mergeSchemas(itemSchemas),
  }
}
