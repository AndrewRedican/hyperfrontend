import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { addError } from '../context'
import { isEqual } from '../utils/deep-equal'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * Validates enum constraint.
 *
 * @param instance - Value being validated
 * @param schema - Schema containing the enum constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateEnum(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  if (!schema.enum) {
    return true
  }

  for (const enumValue of schema.enum) {
    if (isEqual(instance, enumValue)) {
      return true
    }
  }

  const allowedValues = schema.enum.map((v) => stringify(v)).join(', ')
  addError(ctx, `Value must be one of: ${allowedValues}`, instance, 'enum', {
    allowedValues: schema.enum,
  })

  return false
}
