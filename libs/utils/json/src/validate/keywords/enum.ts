import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { addError } from '../context'

/**
 * Performs deep equality check for enum validation.
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

  const allowedValues = schema.enum.map((v) => JSON.stringify(v)).join(', ')
  addError(ctx, `Value must be one of: ${allowedValues}`, instance, 'enum', {
    allowedValues: schema.enum,
  })

  return false
}
