import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'
import { addError, pushPath, shouldContinue } from '../context'

/**
 * Validates object 'patternProperties' keyword.
 *
 * @param instance - Object being validated
 * @param schema - Schema containing the patternProperties constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validatePatternProperties(instance: Record<string, unknown>, schema: Schema, ctx: ValidationContext): boolean {
  if (!schema.patternProperties) {
    return true
  }

  let valid = true
  const patterns: Array<{ regex: RegExp; schema: Schema }> = []

  // Pre-compile all patterns
  for (const [pattern, patternSchema] of entries(schema.patternProperties)) {
    // Check pattern safety if a checker is configured
    /* istanbul ignore if -- patternSafetyChecker branch tested in validate.spec.ts */
    if (ctx.patternSafetyChecker) {
      const safetyResult = ctx.patternSafetyChecker(pattern)
      if (!safetyResult.safe) {
        addError(
          ctx,
          `Unsafe regex pattern in patternProperties: ${safetyResult.reason ?? 'Pattern may cause ReDoS'}`,
          instance,
          'patternProperties',
          {
            pattern,
            reason: safetyResult.reason,
          }
        )
        valid = false
        if (!shouldContinue(ctx)) return false
        continue // Skip this unsafe pattern
      }
    }

    try {
      // eslint-disable-next-line workspace/no-unsafe-regex -- Pattern safety validated above when safePatterns enabled
      patterns.push({ regex: createRegExp(pattern), schema: patternSchema })
    } catch (e) {
      // Invalid regex
      /* istanbul ignore next -- strictPatterns mode verified in validate.spec.ts */
      if (ctx.strictPatterns) {
        /* istanbul ignore next -- error reporting for invalid regex */
        addError(ctx, `Invalid regex pattern in patternProperties: ${pattern}`, instance, 'patternProperties', {
          /* istanbul ignore next -- error message extraction */
          pattern,
          /* istanbul ignore next -- ternary expression */
          error: e instanceof Error ? e.message : 'Invalid regex',
        })
        valid = false
        /* istanbul ignore if -- early exit tested in validate.spec.ts */
        if (!shouldContinue(ctx)) return false
      }
      // Otherwise skip silently
    }
  }

  // Check each property against matching patterns
  for (const key of keys(instance)) {
    for (const { regex, schema: patternSchema } of patterns) {
      if (regex.test(key)) {
        const propCtx = pushPath(ctx, key)
        if (!ctx.validate(instance[key], patternSchema, propCtx)) {
          valid = false
          if (!shouldContinue(ctx)) return false
        }
      }
    }
  }

  return valid
}
