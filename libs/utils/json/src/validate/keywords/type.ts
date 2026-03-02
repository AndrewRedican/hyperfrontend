import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { globalIsFinite, isInteger } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { addError } from '../context'

/**
 * Type checking functions for JSON Schema types.
 */
const typeCheckers: Record<string, (value: unknown) => boolean> = {
  string: (v) => typeof v === 'string',
  number: (v) => typeof v === 'number' && globalIsFinite(v),
  integer: (v) => typeof v === 'number' && globalIsFinite(v) && isInteger(v),
  boolean: (v) => typeof v === 'boolean',
  array: (v) => isArray(v),
  object: (v) => v !== null && typeof v === 'object' && !isArray(v),
  null: (v) => v === null,
}

/**
 * Gets the actual JSON type of a value for error messages.
 *
 * @param value - The value to get the type of
 * @returns The JSON type as a string
 */
function getActualType(value: unknown): string {
  if (value === null) return 'null'
  if (isArray(value)) return 'array'
  const t = typeof value
  if (t === 'number') {
    const num = <number>value
    /* istanbul ignore next -- NaN/Infinity edge case */
    if (!globalIsFinite(num)) return 'number' // NaN/Infinity
    return isInteger(num) ? 'integer' : 'number'
  }
  return t
}

/**
 * Validates the 'type' keyword.
 *
 * @param instance - Value being validated
 * @param schema - Schema containing the type constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateType(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  const schemaType = schema.type
  if (schemaType === undefined) {
    return true
  }

  const types = isArray(schemaType) ? schemaType : [schemaType]

  for (const type of types) {
    const checker = typeCheckers[type]
    /* istanbul ignore if -- defensive check for unknown type */
    if (checker && checker(instance)) {
      // Special case: 'integer' should also pass 'number' check
      return true
    }
    // If type is 'number' and value is an integer, it's still valid
    /* istanbul ignore if -- defensive fallback for integer/number coercion */
    if (type === 'number' && typeCheckers['integer']?.(instance)) {
      return true
    }
  }

  const actualType = getActualType(instance)
  const expectedTypes = types.join(' or ')
  addError(ctx, `Expected type ${expectedTypes} but got ${actualType}`, instance, 'type', {
    expected: types,
    actual: actualType,
  })

  return false
}
