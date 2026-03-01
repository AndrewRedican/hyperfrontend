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
 */
export function isValidSchema(schema: unknown): boolean {
  return validate(schema, v4Schema as Schema).valid
}
