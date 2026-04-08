import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { addError, shouldContinue } from '../context'

/**
 * Validates object bounds constraints (minProperties, maxProperties).
 *
 * @param instance - Object being validated
 * @param schema - Schema containing object bounds
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 * @example
 * ```typescript
 * const schema = { minProperties: 1, maxProperties: 3 }
 * validateObjectBounds({ a: 1, b: 2 }, schema, ctx) // => true
 * validateObjectBounds({}, schema, ctx)            // => false (no properties)
 * validateObjectBounds({ a: 1, b: 2, c: 3, d: 4 }, schema, ctx) // => false (too many)
 * ```
 */
export function validateObjectBounds(instance: Record<string, unknown>, schema: Schema, ctx: ValidationContext): boolean {
  let valid = true
  const propertyCount = keys(instance).length

  if (schema.minProperties !== undefined && propertyCount < schema.minProperties) {
    addError(ctx, `Object must have at least ${schema.minProperties} properties, got ${propertyCount}`, instance, 'minProperties', {
      limit: schema.minProperties,
      actual: propertyCount,
    })
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  if (schema.maxProperties !== undefined && propertyCount > schema.maxProperties) {
    addError(ctx, `Object must have at most ${schema.maxProperties} properties, got ${propertyCount}`, instance, 'maxProperties', {
      limit: schema.maxProperties,
      actual: propertyCount,
    })
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  return valid
}
