import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { addError, shouldContinue } from '../context'

/**
 * Validates string length and pattern constraints.
 *
 * @param instance - String being validated
 * @param schema - Schema containing string constraints
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateStringBounds(instance: string, schema: Schema, ctx: ValidationContext): boolean {
  let valid = true

  if (schema.minLength !== undefined && instance.length < schema.minLength) {
    addError(ctx, `String must be at least ${schema.minLength} characters, got ${instance.length}`, instance, 'minLength', {
      limit: schema.minLength,
      actual: instance.length,
    })
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  if (schema.maxLength !== undefined && instance.length > schema.maxLength) {
    addError(ctx, `String must be at most ${schema.maxLength} characters, got ${instance.length}`, instance, 'maxLength', {
      limit: schema.maxLength,
      actual: instance.length,
    })
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  if (schema.pattern !== undefined) {
    try {
      const regex = new RegExp(schema.pattern)
      if (!regex.test(instance)) {
        addError(ctx, `String does not match pattern: ${schema.pattern}`, instance, 'pattern', {
          pattern: schema.pattern,
        })
        valid = false
        if (!shouldContinue(ctx)) return false
      }
    } catch {
      // Invalid regex pattern - skip validation
    }
  }

  return valid
}
