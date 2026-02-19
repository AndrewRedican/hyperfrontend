import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { addError, shouldContinue } from '../context'

/**
 * Performs deep equality check for uniqueItems validation.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns true if values are deeply equal, false otherwise
 */
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) {
        if (!isEqual(a[i], b[i])) return false
      }
      return true
    }

    if (Array.isArray(a) || Array.isArray(b)) return false

    const keysA = Object.keys(<object>a)
    const keysB = Object.keys(<object>b)
    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false
      if (!isEqual((<Record<string, unknown>>a)[key], (<Record<string, unknown>>b)[key])) return false
    }
    return true
  }

  return false
}

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
    // Check for duplicates
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
