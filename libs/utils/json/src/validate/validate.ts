import type { Schema, ValidationResult, ValidateOptions } from '../types'
import type { ValidationContext } from './context'
import { createValidationContext, shouldContinue } from './context'
import { resolveRef } from './resolve-ref'
import {
  validateType,
  validateProperties,
  validateRequired,
  validateAdditionalProperties,
  validatePatternProperties,
  validateItems,
  validateArrayBounds,
  validateStringBounds,
  validateNumberBounds,
  validateEnum,
  validateObjectBounds,
  validateDependencies,
  validateFormat,
  validateAllOf,
  validateAnyOf,
  validateOneOf,
  validateNot,
} from './keywords'

/**
 * Validates a value against a JSON Schema.
 *
 * @param instance - The value to validate
 * @param schema - The JSON Schema to validate against
 * @param options - Validation options
 * @returns Validation result with valid flag and any errors
 *
 * @example
 * ```typescript
 * const schema = { type: 'string', minLength: 1 }
 * const result = validate('hello', schema)
 * console.log(result.valid) // true
 * ```
 */
export function validate(instance: unknown, schema: Schema, options?: ValidateOptions): ValidationResult {
  const ctx = createValidationContext(schema, validateSchema, options?.collectAllErrors ?? true)
  const valid = validateSchema(instance, schema, ctx)
  return {
    valid,
    errors: ctx.errors,
  }
}

/**
 * Internal recursive validation function.
 *
 * @param instance - Value being validated
 * @param schema - Schema to validate against
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateSchema(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  // Handle $ref
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, ctx)
    if (!resolved) {
      // Could not resolve reference - treat as valid
      return true
    }
    return validateSchema(instance, resolved, ctx)
  }

  let valid = true

  // Type validation
  if (!validateType(instance, schema, ctx)) {
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  // Enum validation
  if (!validateEnum(instance, schema, ctx)) {
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  // String-specific validations
  if (typeof instance === 'string') {
    if (!validateStringBounds(instance, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
    if (!validateFormat(instance, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
  }

  // Number-specific validations
  if (typeof instance === 'number') {
    if (!validateNumberBounds(instance, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
  }

  // Array-specific validations
  if (Array.isArray(instance)) {
    if (!validateItems(instance, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
    if (!validateArrayBounds(instance, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
  }

  // Object-specific validations
  if (instance !== null && typeof instance === 'object' && !Array.isArray(instance)) {
    const obj = <Record<string, unknown>>instance

    if (!validateProperties(obj, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
    if (!validateRequired(obj, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
    if (!validatePatternProperties(obj, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
    if (!validateAdditionalProperties(obj, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
    if (!validateObjectBounds(obj, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
    if (!validateDependencies(obj, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
  }

  // Composition keywords
  if (!validateAllOf(instance, schema, ctx)) {
    valid = false
    if (!shouldContinue(ctx)) return false
  }
  if (!validateAnyOf(instance, schema, ctx)) {
    valid = false
    if (!shouldContinue(ctx)) return false
  }
  if (!validateOneOf(instance, schema, ctx)) {
    valid = false
    if (!shouldContinue(ctx)) return false
  }
  if (!validateNot(instance, schema, ctx)) {
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  return valid
}
