/**
 * JSON Schema type values.
 */
export type JsonType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null'

/**
 * JSON Schema Draft v4 type definition.
 * Represents the structure of a JSON Schema document.
 */
export interface Schema {
  /** Schema identifier (Draft v4 uses 'id', not '$id') */
  id?: string
  /** Draft version */
  $schema?: string
  /** Reference to another schema */
  $ref?: string
  /** Human-readable title */
  title?: string
  /** Human-readable description */
  description?: string
  /** Default value */
  default?: unknown

  /** Type constraint */
  type?: JsonType | JsonType[]

  /** Enum constraint - value must be one of these */
  enum?: unknown[]

  /** Minimum string length */
  minLength?: number
  /** Maximum string length */
  maxLength?: number
  /** Regex pattern the string must match */
  pattern?: string
  /** String format (e.g., 'email', 'uri', 'date-time') */
  format?: string

  /** Minimum value */
  minimum?: number
  /** Maximum value */
  maximum?: number
  /** Whether minimum is exclusive (Draft v4 style) */
  exclusiveMinimum?: boolean
  /** Whether maximum is exclusive (Draft v4 style) */
  exclusiveMaximum?: boolean
  /** Value must be a multiple of this */
  multipleOf?: number

  /** Property schemas */
  properties?: Record<string, Schema>
  /** Required property names */
  required?: string[]
  /** Schema for additional properties, or false to disallow */
  additionalProperties?: boolean | Schema
  /** Pattern-based property schemas */
  patternProperties?: Record<string, Schema>
  /** Minimum number of properties */
  minProperties?: number
  /** Maximum number of properties */
  maxProperties?: number
  /** Property dependencies */
  dependencies?: Record<string, string[] | Schema>

  /** Schema for array items (single or tuple) */
  items?: Schema | Schema[]
  /** Schema for additional items beyond tuple */
  additionalItems?: boolean | Schema
  /** Minimum array length */
  minItems?: number
  /** Maximum array length */
  maxItems?: number
  /** Whether array items must be unique */
  uniqueItems?: boolean

  /** All schemas must match */
  allOf?: Schema[]
  /** At least one schema must match */
  anyOf?: Schema[]
  /** Exactly one schema must match */
  oneOf?: Schema[]
  /** Schema must NOT match */
  not?: Schema

  /** Reusable schema definitions */
  definitions?: Record<string, Schema>
}
