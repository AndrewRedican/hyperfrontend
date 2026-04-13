import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { abs } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { addError, shouldContinue } from '../context'

/**
 * Validates number range and multipleOf constraints.
 *
 * @param instance - Number being validated
 * @param schema - Schema containing number constraints
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 * @example Validating number constraints
 * ```typescript
 * const schema = { minimum: 0, maximum: 100, multipleOf: 5 }
 * validateNumberBounds(50, schema, ctx)  // => true
 * validateNumberBounds(-1, schema, ctx)  // => false (below minimum)
 * validateNumberBounds(101, schema, ctx) // => false (above maximum)
 * validateNumberBounds(17, schema, ctx)  // => false (not multiple of 5)
 * ```
 */
export function validateNumberBounds(instance: number, schema: Schema, ctx: ValidationContext): boolean {
  let valid = true

  if (schema.minimum !== undefined) {
    const isExclusive = schema.exclusiveMinimum === true
    if (isExclusive ? instance <= schema.minimum : instance < schema.minimum) {
      const comparison = isExclusive ? 'greater than' : 'at least'
      addError(ctx, `Number must be ${comparison} ${schema.minimum}, got ${instance}`, instance, 'minimum', {
        limit: schema.minimum,
        exclusive: isExclusive,
        actual: instance,
      })
      valid = false
      if (!shouldContinue(ctx)) return false
    }
  }

  if (schema.maximum !== undefined) {
    const isExclusive = schema.exclusiveMaximum === true
    if (isExclusive ? instance >= schema.maximum : instance > schema.maximum) {
      const comparison = isExclusive ? 'less than' : 'at most'
      addError(ctx, `Number must be ${comparison} ${schema.maximum}, got ${instance}`, instance, 'maximum', {
        limit: schema.maximum,
        exclusive: isExclusive,
        actual: instance,
      })
      valid = false
      if (!shouldContinue(ctx)) return false
    }
  }

  if (schema.multipleOf !== undefined && schema.multipleOf > 0) {
    const remainder = abs(instance % schema.multipleOf)
    const epsilon = 1e-10
    if (remainder > epsilon && schema.multipleOf - remainder > epsilon) {
      addError(ctx, `Number must be a multiple of ${schema.multipleOf}, got ${instance}`, instance, 'multipleOf', {
        multipleOf: schema.multipleOf,
        actual: instance,
      })
      valid = false
      if (!shouldContinue(ctx)) return false
    }
  }

  return valid
}
