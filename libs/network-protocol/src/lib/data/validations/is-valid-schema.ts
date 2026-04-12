import type { Schema } from '@hyperfrontend/json-utils'
import { validate } from '@hyperfrontend/json-utils'
/* istanbul ignore next - JSON import causes coverage artifact */
import * as v4Schema from './v4.json'

/**
 * Validates whether the provided value is a valid JSON Schema v4 schema.
 * Uses the jsonschema validator to check compliance with the JSON Schema Draft v4 specification.
 *
 * @param schema - The value to validate as a JSON Schema
 * @returns True if the value is a valid JSON Schema v4 schema, false otherwise
 *
 * @example Validating JSON schemas
 * ```typescript
 * isValidSchema({ type: 'object', properties: { name: { type: 'string' } } })
 * // => true
 *
 * isValidSchema({ type: 'invalid-type' })
 * // => false
 * ```
 */
export function isValidSchema(schema: unknown): boolean {
  return validate(schema, <Schema>v4Schema).valid
}
