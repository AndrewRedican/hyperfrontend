import type { Schema } from '@hyperfrontend/json-utils'
import type { ValidationResult } from '../../types/validation'
import { createValidator as createJsonValidator } from '@hyperfrontend/json-utils'

/**
 * Creates a validator function from a JSON schema.
 * Returns a function that validates data against the schema.
 *
 * @param schema - JSON Schema to validate against
 * @returns Validator function that returns validation results
 *
 * @example Creating a schema validator
 * ```typescript
 * const validateUser = createValidator({
 *   type: 'object',
 *   properties: { name: { type: 'string' } },
 *   required: ['name']
 * })
 * const result = validateUser({ name: 'Alice' })
 * // => { valid: true, errors: [] }
 * ```
 */
export function createValidator(schema: Schema): (data: unknown) => ValidationResult {
  const validator = createJsonValidator(schema)

  return (data: unknown): ValidationResult => {
    const result = validator(data)

    return {
      valid: result.valid,
      errors: result.errors.map((error) => ({
        message: error.message,
        path: error.path,
        value: error.instance,
      })),
    }
  }
}
