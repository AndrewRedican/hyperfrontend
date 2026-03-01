import type { Schema } from '../types/schema'
import type { ValidationResult, ValidateOptions } from '../types/validation'
import type { ValidationContext } from './context'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createValidationContext, shouldContinue } from './context'
import { validateArrayBounds } from './keywords/array-bounds'
import { validateAllOf, validateAnyOf, validateOneOf, validateNot } from './keywords/composition'
import { validateDependencies } from './keywords/dependencies'
import { validateEnum } from './keywords/enum'
import { validateFormat } from './keywords/format'
import { validateItems } from './keywords/items'
import { validateNumberBounds } from './keywords/number-bounds'
import { validateObjectBounds } from './keywords/object-bounds'
import { validatePatternProperties } from './keywords/pattern-properties'
import { validateProperties, validateRequired, validateAdditionalProperties } from './keywords/properties'
import { validateStringBounds } from './keywords/string-bounds'
import { validateType } from './keywords/type'
import { resolveRef } from './resolve-ref'

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
  const ctx = createValidationContext(schema, validateSchema, options?.collectAllErrors ?? true, options?.strictPatterns ?? false)
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
    /* istanbul ignore if -- $ref resolution failures are tested in resolve-ref.spec.ts */
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
  if (isArray(instance)) {
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
  if (instance !== null && typeof instance === 'object' && !isArray(instance)) {
    const obj = <Record<string, unknown>>instance

    if (!validateProperties(obj, schema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
    if (!validateRequired(obj, schema, ctx)) {
      valid = false
      /* istanbul ignore if -- early exit tested elsewhere */
      if (!shouldContinue(ctx)) return false
    }
    /* istanbul ignore next -- patternProperties validation */
    if (!validatePatternProperties(obj, schema, ctx)) {
      valid = false
      /* istanbul ignore next -- early exit tested elsewhere */
      if (!shouldContinue(ctx)) return false
    }
    /* istanbul ignore next -- additionalProperties validation */
    if (!validateAdditionalProperties(obj, schema, ctx)) {
      valid = false
      /* istanbul ignore next -- early exit tested elsewhere */
      if (!shouldContinue(ctx)) return false
    }
    /* istanbul ignore next -- objectBounds validation */
    if (!validateObjectBounds(obj, schema, ctx)) {
      valid = false
      /* istanbul ignore next -- early exit tested elsewhere */
      if (!shouldContinue(ctx)) return false
    }
    /* istanbul ignore next -- dependencies validation */
    if (!validateDependencies(obj, schema, ctx)) {
      valid = false
      /* istanbul ignore next -- early exit tested elsewhere */
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
