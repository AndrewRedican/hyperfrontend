import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { addError, createValidationContext, shouldContinue } from '../context'

/**
 * Validates 'allOf' keyword - all schemas must match.
 *
 * @param instance - Value being validated
 * @param schema - Schema containing the allOf constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateAllOf(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  const allOf = schema.allOf
  if (!allOf || allOf.length === 0) {
    return true
  }

  let valid = true
  for (let i = 0; i < allOf.length; i++) {
    const subSchema = allOf[i]
    /* istanbul ignore if -- defensive null check for sparse arrays */
    if (!subSchema) continue
    if (!ctx.validate(instance, subSchema, ctx)) {
      valid = false
      if (!shouldContinue(ctx)) return false
    }
  }

  return valid
}

/**
 * Validates 'anyOf' keyword - at least one schema must match.
 *
 * @param instance - Value being validated
 * @param schema - Schema containing the anyOf constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateAnyOf(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  const anyOf = schema.anyOf
  if (!anyOf || anyOf.length === 0) {
    return true
  }

  // Try each schema - if any matches, we pass
  for (const subSchema of anyOf) {
    const subCtx = createValidationContext(ctx.rootSchema, ctx.validate, false)
    // Copy path from parent context
    Object.defineProperty(subCtx, 'path', { value: ctx.path, writable: false })
    if (ctx.validate(instance, subSchema, subCtx)) {
      return true
    }
  }

  addError(ctx, 'Value does not match any of the allowed schemas (anyOf)', instance, 'anyOf')
  return false
}

/**
 * Validates 'oneOf' keyword - exactly one schema must match.
 *
 * @param instance - Value being validated
 * @param schema - Schema containing the oneOf constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateOneOf(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  const oneOf = schema.oneOf
  if (!oneOf || oneOf.length === 0) {
    return true
  }

  let matchCount = 0

  for (const subSchema of oneOf) {
    const subCtx = createValidationContext(ctx.rootSchema, ctx.validate, false)
    Object.defineProperty(subCtx, 'path', { value: ctx.path, writable: false })
    if (ctx.validate(instance, subSchema, subCtx)) {
      matchCount++
      if (matchCount > 1) break // Early exit if more than one match
    }
  }

  if (matchCount === 1) {
    return true
  }

  if (matchCount === 0) {
    addError(ctx, 'Value does not match any of the schemas (oneOf)', instance, 'oneOf')
  } else {
    addError(ctx, `Value matches ${matchCount} schemas but must match exactly one (oneOf)`, instance, 'oneOf', {
      matches: matchCount,
    })
  }

  return false
}

/**
 * Validates 'not' keyword - schema must NOT match.
 *
 * @param instance - Value being validated
 * @param schema - Schema containing the not constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateNot(instance: unknown, schema: Schema, ctx: ValidationContext): boolean {
  const not = schema.not
  if (!not) {
    return true
  }

  const subCtx = createValidationContext(ctx.rootSchema, ctx.validate, false)
  Object.defineProperty(subCtx, 'path', { value: ctx.path, writable: false })

  if (ctx.validate(instance, not, subCtx)) {
    // Schema matched when it shouldn't have
    addError(ctx, 'Value should NOT match the schema', instance, 'not')
    return false
  }

  return true
}
