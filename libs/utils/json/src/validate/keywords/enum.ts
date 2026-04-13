import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { addError } from '../context'
import { isEqual } from '../utils/deep-equal'

/**
 * Validates enum constraint.
 *
 * @param instance - Value being validated
 * @param schema - Schema containing the enum constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 * @example Validating enum values
 * ```typescript
 * const schema = { enum: ['draft', 'published', 'archived'] }
 * validateEnum('published', schema, ctx) // => true
 * validateEnum('deleted', schema, ctx)   // => false (not in enum)
 * ```
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
