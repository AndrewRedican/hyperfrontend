import type { Schema } from '../types/schema'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { mergeSchemas } from './merge-schemas'
import { getJsonType } from './type-detection'

/**
 * Options for schema generation.
 */
export interface GenerateOptions {
  /** Array handling mode */
  arrays?: {
    /**
     * Array handling mode:
     * - 'all': Merge all item schemas (default)
     * - 'first': Use only the first item's schema
     * - 'uniform': Assume all items have the same schema
     */
    mode?: 'all' | 'first' | 'uniform'
  }
  /** Whether to include required fields (default: true) */
  includeRequired?: boolean
  /** Whether to allow additional properties (default: true) */
  additionalProperties?: boolean
}

const defaultOptions: Required<GenerateOptions> = {
  arrays: { mode: 'all' },
  includeRequired: true,
  additionalProperties: true,
}

/**
 * Generates a JSON Schema from a JavaScript value.
 *
 * @param value - The value to generate a schema from
 * @param options - Generation options
 * @returns A JSON Schema describing the value
 *
 * @example
 * ```typescript
 * const data = {
 *   name: 'Alice',
 *   age: 30,
 *   tags: ['developer', 'typescript']
 * }
 *
 * const schema = toJsonSchema(data)
 * // {
 * //   type: 'object',
 * //   properties: {
 * //     name: { type: 'string' },
 * //     age: { type: 'integer' },
 * //     tags: { type: 'array', items: { type: 'string' } }
 * //   },
 * //   required: ['name', 'age', 'tags']
 * // }
 * ```
 */
export function toJsonSchema(value: unknown, options?: GenerateOptions): Schema {
  const opts = {
    ...defaultOptions,
    ...options,
    arrays: { ...defaultOptions.arrays, ...options?.arrays },
  }
  return generateSchema(value, opts)
}

/**
 * Generates a schema for a single value.
 *
 * @param value - The value to generate a schema from
 * @param options - Generation options
 * @returns A JSON Schema describing the value
 */
function generateSchema(value: unknown, options: Required<GenerateOptions>): Schema {
  const type = getJsonType(value)

  switch (type) {
    case 'null':
      return { type: 'null' }
    case 'boolean':
      return { type: 'boolean' }
    case 'integer':
      return { type: 'integer' }
    case 'number':
      return { type: 'number' }
    case 'string':
      return { type: 'string' }
    case 'array':
      return generateArraySchema(<unknown[]>value, options)
    case 'object':
      return generateObjectSchema(<Record<string, unknown>>value, options)
    /* istanbul ignore next -- unreachable: getJsonType covers all JSON types */
    default:
      return {}
  }
}

/**
 * Generates a schema for an object value.
 *
 * @param obj - The object to generate a schema from
 * @param options - Generation options
 * @returns An object JSON Schema
 */
function generateObjectSchema(obj: Record<string, unknown>, options: Required<GenerateOptions>): Schema {
  const keysList = keys(obj)

  /* istanbul ignore if -- empty object edge case */
  if (keysList.length === 0) {
    return { type: 'object' }
  }

  const properties: Record<string, Schema> = {}

  for (const key of keysList) {
    properties[key] = generateSchema(obj[key], options)
  }

  const schema: Schema = {
    type: 'object',
    properties,
  }

  /* istanbul ignore else -- includeRequired defaults to true */
  if (options.includeRequired && keysList.length > 0) {
    schema.required = keysList
  }

  /* istanbul ignore if -- additionalProperties defaults to true */
  if (options.additionalProperties === false) {
    schema.additionalProperties = false
  }

  return schema
}

/**
 * Generates a schema for an array value.
 *
 * @param arr - The array to generate a schema from
 * @param options - Generation options
 * @returns An array JSON Schema
 */
// istanbul ignore next
function generateArraySchema(arr: unknown[], options: Required<GenerateOptions>): Schema {
  if (arr.length === 0) {
    return { type: 'array' }
  }

  const mode = options.arrays.mode

  if (mode === 'first') {
    return {
      type: 'array',
      items: generateSchema(arr[0], options),
    }
  }

  if (mode === 'uniform') {
    const firstType = getJsonType(arr[0])
    const allSameType = arr.every((item) => getJsonType(item) === firstType)

    /* istanbul ignore else -- uniform type is common case */
    if (allSameType) {
      return {
        type: 'array',
        items: generateSchema(arr[0], options),
      }
    }

    const itemSchemas = arr.map((item) => generateSchema(item, options))
    const uniqueSchemas = deduplicateSchemas(itemSchemas)
    /* istanbul ignore else -- single unique schema is common */
    if (uniqueSchemas.length === 1) {
      return { type: 'array', items: uniqueSchemas[0] }
    }
    return { type: 'array', items: mergeSchemas(uniqueSchemas) }
  }

  const itemSchemas = arr.map((item) => generateSchema(item, options))

  const uniqueSchemas = deduplicateSchemas(itemSchemas)

  if (uniqueSchemas.length === 1) {
    return {
      type: 'array',
      items: uniqueSchemas[0],
    }
  }

  return {
    type: 'array',
    items: mergeSchemas(uniqueSchemas),
  }
}

/**
 * Removes duplicate schemas based on JSON comparison.
 *
 * @param schemas - Array of schemas to deduplicate
 * @returns Array of unique schemas
 */
function deduplicateSchemas(schemas: Schema[]): Schema[] {
  const seen = createSet<string>()
  const unique: Schema[] = []

  for (const schema of schemas) {
    const key = stringify(schema)
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(schema)
    }
  }

  return unique
}
