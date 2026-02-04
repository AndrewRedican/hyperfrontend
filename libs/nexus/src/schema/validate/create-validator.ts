import { Validator, type Schema } from 'jsonschema'
import type { ValidationResult } from '../../types/validation'

/**
 * Creates a validator function from a JSON schema.
 * Returns a function that validates data against the schema.
 *
 * @param schema - JSON Schema to validate against
 * @returns Validator function that returns validation results
 */
export function createValidator(schema: Schema): (data: unknown) => ValidationResult {
  const validator = new Validator()

  return (data: unknown): ValidationResult => {
    const result = validator.validate(data, schema)

    return {
      valid: result.valid,
      errors: result.errors.map((error) => ({
        message: error.message,
        path: error.property,
        value: error.instance,
      })),
    }
  }
}
