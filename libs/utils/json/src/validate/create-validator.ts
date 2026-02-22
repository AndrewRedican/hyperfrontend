import type { Schema, ValidationResult, ValidateOptions } from '../types'
import { validate } from './validate'

/**
 * Creates a reusable validator function from a JSON Schema.
 *
 * @param schema - JSON Schema to validate against
 * @param options - Validation options
 * @returns A function that validates data against the schema
 *
 * @example
 * ```typescript
 * const schema = {
 *   type: 'object',
 *   properties: {
 *     name: { type: 'string' },
 *     age: { type: 'integer', minimum: 0 }
 *   },
 *   required: ['name']
 * }
 *
 * const validateUser = createValidator(schema)
 * const result = validateUser({ name: 'Alice', age: 30 })
 * console.log(result.valid) // true
 * ```
 */
export function createValidator(schema: Schema, options?: ValidateOptions): (data: unknown) => ValidationResult {
  return (data: unknown): ValidationResult => validate(data, schema, options)
}
