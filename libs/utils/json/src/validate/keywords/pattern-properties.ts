import type { Schema } from '../../types'
import type { ValidationContext } from '../context'
import { pushPath, shouldContinue } from '../context'

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
    } catch {
      // Invalid regex, skip
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
