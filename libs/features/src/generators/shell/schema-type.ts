import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { formatKey, quoteString } from './source-literal'

// note: JSON-schema scalar types mapped straight to their TypeScript equivalents; `integer` narrows to `number`.
const PRIMITIVES: Record<string, string> = {
  string: 'string',
  number: 'number',
  integer: 'number',
  boolean: 'boolean',
  null: 'null',
}

/**
 * Narrows an unknown value to a plain record.
 *
 * @param value - The value to test.
 * @returns `true` when the value is a non-null, non-array object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !isArray(value)
}

/**
 * Renders a JSON scalar as a TypeScript literal type.
 *
 * @param value - The candidate literal.
 * @returns The literal type source, or `null` for a non-scalar value.
 */
function literalType(value: unknown): string | null {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'string') {
    return quoteString(value)
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return stringify(value)
  }
  return null
}

/**
 * Renders an `enum` member list as a union of literal types.
 *
 * @param members - The allowed values listed by the schema.
 * @returns The union source, or `unknown` when any member is not a scalar.
 */
function enumType(members: unknown[]): string {
  const literals = members.map(literalType)
  // why: One non-scalar member would poison the union with `unknown`, which silently absorbs the useful literals — better to fall back for the whole enum.
  return literals.every((literal) => literal !== null) ? literals.join(' | ') : 'unknown'
}

/**
 * Renders an `object` schema as an inline type literal.
 *
 * @param schema - The schema record with optional `properties` and `required`.
 * @param indent - The current indentation prefix.
 * @returns The object type source; `Record<string, unknown>` without properties.
 */
function objectType(schema: Record<string, unknown>, indent: string): string {
  const properties = isRecord(schema['properties']) ? entries(schema['properties']) : []
  if (properties.length === 0) {
    return 'Record<string, unknown>'
  }
  const required: unknown[] = isArray(schema['required']) ? schema['required'] : []
  const inner = `${indent}  `
  const members = properties.map(
    ([key, member]) => `${inner}${formatKey(key)}${required.includes(key) ? '' : '?'}: ${schemaToType(member, inner)}`
  )
  return `{\n${members.join('\n')}\n${indent}}`
}

/**
 * Renders an `array` schema as an element-type array.
 *
 * @param schema - The schema record with an optional single `items` schema.
 * @param indent - The current indentation prefix.
 * @returns The array type source; `unknown[]` without a single `items` schema.
 */
function arrayType(schema: Record<string, unknown>, indent: string): string {
  const items = schema['items']
  if (!isRecord(items)) {
    return 'unknown[]'
  }
  const element = schemaToType(items, indent)
  return element.includes('|') ? `(${element})[]` : `${element}[]`
}

/**
 * Projects a JSON-schema-like payload description into TypeScript type source.
 *
 * Bounded mapping: scalar `type`s, `object` with `properties`/`required`,
 * `array` with a single `items` schema, `enum`, and `const` are projected;
 * anything else (including a missing schema) falls back to `unknown`, so a
 * generated type is never wrong — at worst it is loose.
 *
 * @param schema - The schema value to project.
 * @param indent - Indentation prefix applied to nested object members.
 * @returns The TypeScript type as source text.
 *
 * @example Projecting an action payload schema
 * ```typescript
 * schemaToType({ type: 'object', properties: { tz: { type: 'string' } }, required: ['tz'] })
 * // => '{\n  tz: string\n}'
 * ```
 */
export function schemaToType(schema: unknown, indent = ''): string {
  if (!isRecord(schema)) {
    return 'unknown'
  }
  const enumMembers = schema['enum']
  if (isArray(enumMembers) && enumMembers.length > 0) {
    return enumType(enumMembers)
  }
  if ('const' in schema) {
    return literalType(schema['const']) ?? 'unknown'
  }
  const type = schema['type']
  if (typeof type !== 'string') {
    return 'unknown'
  }
  const primitive = PRIMITIVES[type]
  if (primitive !== undefined) {
    return primitive
  }
  if (type === 'object') {
    return objectType(schema, indent)
  }
  if (type === 'array') {
    return arrayType(schema, indent)
  }
  return 'unknown'
}
