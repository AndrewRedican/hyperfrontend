import type { Schema, JsonType } from '../types'

/**
 * Merges multiple schemas into a single unified schema.
 * Used when generating schemas from arrays with mode: 'all'.
 *
 * @param schemas - Array of schemas to merge
 * @returns A single merged schema, possibly using anyOf
 */
export function mergeSchemas(schemas: Schema[]): Schema {
  if (schemas.length === 0) {
    return {}
  }

  if (schemas.length === 1) {
    const [first] = schemas
    return first ?? {}
  }

  // Group schemas by type
  const typeGroups = new Map<JsonType | 'mixed', Schema[]>()

  for (const schema of schemas) {
    const type = <JsonType | undefined>schema.type
    const key: JsonType | 'mixed' = type ?? 'mixed'
    const group = typeGroups.get(key) ?? []
    group.push(schema)
    typeGroups.set(key, group)
  }

  // If all schemas have the same type, try to merge them
  if (typeGroups.size === 1) {
    const [[type, group]] = [...typeGroups.entries()]
    if (type && type !== 'mixed' && group) {
      return mergeSchemasByType(type, group)
    }
  }

  // Multiple types - use anyOf or a type array
  const uniqueTypes = new Set<JsonType>()
  for (const schema of schemas) {
    if (schema.type) {
      if (Array.isArray(schema.type)) {
        schema.type.forEach((t) => uniqueTypes.add(t))
      } else {
        uniqueTypes.add(schema.type)
      }
    }
  }

  if (uniqueTypes.size > 0 && uniqueTypes.size <= schemas.length) {
    // Check if all schemas are just type definitions
    const allSimpleTypes = schemas.every((s) => Object.keys(s).length === 1 && s.type)
    if (allSimpleTypes) {
      const types = [...uniqueTypes]
      return types.length === 1 ? { type: types[0] } : { type: types }
    }
  }

  // Fall back to anyOf for complex cases
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
  if (schemas.length === 1) {
    const [first] = schemas
    return first ?? {}
  }

  switch (type) {
    case 'object':
      return mergeObjectSchemas(schemas)
    case 'array':
      return mergeArraySchemas(schemas)
    default:
      // For primitives, just return the type
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
      for (const [key, propSchema] of Object.entries(schema.properties)) {
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
  for (const [key, propSchemas] of Object.entries(mergedProperties)) {
    properties[key] = mergeSchemas(propSchemas)
  }

  // A property is required only if it's required in all schemas
  const required = Object.keys(requiredCounts).filter((key) => requiredCounts[key] === schemas.length)

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
      if (Array.isArray(schema.items)) {
        itemSchemas.push(...schema.items)
      } else {
        itemSchemas.push(schema.items)
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
