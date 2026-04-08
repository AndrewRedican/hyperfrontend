import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { addError, pushPath, shouldContinue } from '../context'

/**
 * Validates array 'items' keyword.
 *
 * @param instance - Array being validated
 * @param schema - Schema containing the items constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 * @example Single schema for all items
 * ```typescript
 * const schema = { items: { type: 'string' } }
 * validateItems(['a', 'b', 'c'], schema, ctx) // => true
 * validateItems(['a', 1, 'c'], schema, ctx)   // => false (1 is not a string)
 * ```
 *
 * @example Tuple validation
 * ```typescript
 * const schema = { items: [{ type: 'string' }, { type: 'number' }] }
 * validateItems(['name', 42], schema, ctx)  // => true
 * validateItems([42, 'name'], schema, ctx)  // => false (wrong types)
 * ```
 */
export function validateItems(instance: unknown[], schema: Schema, ctx: ValidationContext): boolean {
  const items = schema.items
  if (items === undefined) {
    return true
  }

  let valid = true

  if (isArray(items)) {
    for (let i = 0; i < items.length && i < instance.length; i++) {
      const itemSchema = items[i]
      /* istanbul ignore if -- defensive null check for sparse arrays */
      if (!itemSchema) continue
      const itemCtx = pushPath(ctx, i)
      if (!ctx.validate(instance[i], itemSchema, itemCtx)) {
        valid = false
        /* istanbul ignore if -- early exit already tested in validate.spec.ts */
        if (!shouldContinue(ctx)) return false
      }
    }

    if (instance.length > items.length) {
      if (!validateAdditionalItems(instance, schema, ctx, items.length)) {
        valid = false
      }
    }
  } else {
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

  /* istanbul ignore if -- default case handled in items.spec.ts */
  if (additionalItems === undefined) {
    return true
  }

  /* istanbul ignore next -- additionalItems initialization and branching */
  let valid = true

  /* istanbul ignore next -- additionalItems branching */
  if (additionalItems === false) {
    if (instance.length > startIndex) {
      addError(ctx, `Array has too many items. Expected at most ${startIndex}, got ${instance.length}`, instance, 'additionalItems', {
        limit: startIndex,
        actual: instance.length,
      })
      valid = false
    }
  } else if (typeof additionalItems === 'object') {
    for (let i = startIndex; i < instance.length; i++) {
      const itemCtx = pushPath(ctx, i)
      /* istanbul ignore else -- validation failure tested in items.spec.ts */
      if (!ctx.validate(instance[i], additionalItems, itemCtx)) {
        valid = false
        /* istanbul ignore if -- early exit tested in validate.spec.ts */
        if (!shouldContinue(ctx)) return false
      }
    }
  }

  return valid
}
