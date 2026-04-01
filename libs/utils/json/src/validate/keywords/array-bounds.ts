import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { addError, shouldContinue } from '../context'
import { isEqual } from '../utils/deep-equal'

/**
 * Validates array length and uniqueItems constraints.
 *
 * @param instance - Array being validated
 * @param schema - Schema containing array bounds
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateArrayBounds(instance: unknown[], schema: Schema, ctx: ValidationContext): boolean {
  let valid = true

  if (schema.minItems !== undefined && instance.length < schema.minItems) {
    addError(ctx, `Array must have at least ${schema.minItems} items, got ${instance.length}`, instance, 'minItems', {
      limit: schema.minItems,
      actual: instance.length,
    })
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  if (schema.maxItems !== undefined && instance.length > schema.maxItems) {
    addError(ctx, `Array must have at most ${schema.maxItems} items, got ${instance.length}`, instance, 'maxItems', {
      limit: schema.maxItems,
      actual: instance.length,
    })
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  if (schema.uniqueItems === true) {
    for (let i = 0; i < instance.length; i++) {
      for (let j = i + 1; j < instance.length; j++) {
        if (isEqual(instance[i], instance[j])) {
          addError(ctx, `Array items must be unique. Duplicate found at indices ${i} and ${j}`, instance, 'uniqueItems')
          valid = false
          if (!shouldContinue(ctx)) return false
        }
      }
    }
  }

  return valid
}
