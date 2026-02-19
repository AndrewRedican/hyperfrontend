import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { addError, pushPath, shouldContinue } from '../context'

/**
 * Validates array 'items' keyword.
 *
 * @param instance - Array being validated
 * @param schema - Schema containing the items constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateItems(instance: unknown[], schema: Schema, ctx: ValidationContext): boolean {
  const items = schema.items
  if (items === undefined) {
    return true
  }

  let valid = true

  if (Array.isArray(items)) {
    // Tuple validation
    for (let i = 0; i < items.length && i < instance.length; i++) {
      const itemSchema = items[i]
      if (!itemSchema) continue
      const itemCtx = pushPath(ctx, i)
      if (!ctx.validate(instance[i], itemSchema, itemCtx)) {
        valid = false
        if (!shouldContinue(ctx)) return false
      }
    }

    // Handle additional items beyond the tuple
    if (instance.length > items.length) {
      if (!validateAdditionalItems(instance, schema, ctx, items.length)) {
        valid = false
      }
    }
  } else {
    // All items must match the single schema
    for (let i = 0; i < instance.length; i++) {
      const itemCtx = pushPath(ctx, i)
      if (!ctx.validate(instance[i], items, itemCtx)) {
        valid = false
        if (!shouldContinue(ctx)) return false
      }
    }
  }

  return valid
}

/**
 * Validates 'additionalItems' keyword for tuple arrays.
 *
 * @param instance - Array being validated
 * @param schema - Schema containing the additionalItems constraint
 * @param ctx - Validation context
 * @param startIndex - Index from which to start checking additional items
 * @returns true if validation passes, false otherwise
 */
function validateAdditionalItems(instance: unknown[], schema: Schema, ctx: ValidationContext, startIndex: number): boolean {
  const additionalItems = schema.additionalItems

  // If not specified, additional items are allowed
  if (additionalItems === undefined) {
    return true
  }

  let valid = true

  if (additionalItems === false) {
    // No additional items allowed
    if (instance.length > startIndex) {
      addError(ctx, `Array has too many items. Expected at most ${startIndex}, got ${instance.length}`, instance, 'additionalItems', {
        limit: startIndex,
        actual: instance.length,
      })
      valid = false
    }
  } else if (typeof additionalItems === 'object') {
    // Additional items must match the schema
    for (let i = startIndex; i < instance.length; i++) {
      const itemCtx = pushPath(ctx, i)
      if (!ctx.validate(instance[i], additionalItems, itemCtx)) {
        valid = false
        if (!shouldContinue(ctx)) return false
      }
    }
  }
  // If additionalItems === true, any additional items are allowed

  return valid
}
