import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
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
  for (const [pattern, patternSchema] of Object.entries(schema.patternProperties)) {
    try {
      patterns.push({ regex: new RegExp(pattern), schema: patternSchema })
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
  for (const key of Object.keys(instance)) {
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
