import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'
import { addError, shouldContinue } from '../context'

/**
 * Validates string length and pattern constraints.
 *
 * @param instance - String being validated
 * @param schema - Schema containing string constraints
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateStringBounds(instance: string, schema: Schema, ctx: ValidationContext): boolean {
  let valid = true

  if (schema.minLength !== undefined && instance.length < schema.minLength) {
    addError(ctx, `String must be at least ${schema.minLength} characters, got ${instance.length}`, instance, 'minLength', {
      limit: schema.minLength,
      actual: instance.length,
    })
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  if (schema.maxLength !== undefined && instance.length > schema.maxLength) {
    addError(ctx, `String must be at most ${schema.maxLength} characters, got ${instance.length}`, instance, 'maxLength', {
      limit: schema.maxLength,
      actual: instance.length,
    })
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  if (schema.pattern !== undefined) {
    // Check pattern safety if a checker is configured
    if (ctx.patternSafetyChecker) {
      const safetyResult = ctx.patternSafetyChecker(schema.pattern)
      if (!safetyResult.safe) {
        addError(ctx, `Unsafe regex pattern: ${safetyResult.reason ?? 'Pattern may cause ReDoS'}`, instance, 'pattern', {
          pattern: schema.pattern,
          reason: safetyResult.reason,
        })
        valid = false
        if (!shouldContinue(ctx)) return false
        // Skip executing the unsafe pattern
        return valid
      }
    }

    try {
      // eslint-disable-next-line workspace/no-unsafe-regex -- Pattern safety validated above when safePatterns enabled
      const regex = createRegExp(schema.pattern)
      if (!regex.test(instance)) {
        addError(ctx, `String does not match pattern: ${schema.pattern}`, instance, 'pattern', {
          pattern: schema.pattern,
        })
        valid = false
        if (!shouldContinue(ctx)) return false
      }
    } catch (e) {
      // Invalid regex pattern
      /* istanbul ignore next -- strictPatterns mode verified in validate.spec.ts */
      if (ctx.strictPatterns) {
        /* istanbul ignore next -- error reporting for invalid regex */
        addError(ctx, `Invalid regex pattern: ${schema.pattern}`, instance, 'pattern', {
          pattern: schema.pattern,
          /* istanbul ignore next -- error message extraction ternary */
          error: e instanceof Error ? e.message : 'Invalid regex',
        })
        valid = false
        /* istanbul ignore if -- early exit tested in validate.spec.ts */
        if (!shouldContinue(ctx)) return false
      }
      // Otherwise skip validation silently
    }
  }

  return valid
}
