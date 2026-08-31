import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'
import { addError, pushPath, shouldContinue } from '../context'

/**
 * Compiled `patternProperties` entry: a regex paired with the schema to apply
 * to keys it matches.
 */
type CompiledPatternProperty = {
  /** Compiled regex pattern */
  regex: RegExp
  /** Schema to validate against */
  schema: Schema
}

/**
 * Validates object 'patternProperties' keyword.
 *
 * @param instance - Object being validated
 * @param schema - Schema containing the patternProperties constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 * @example Validating pattern properties
 * ```typescript
 * const schema = {
 *   patternProperties: {
 *     '^x-': { type: 'string' },  // extension properties must be strings
 *     '^\\d+$': { type: 'number' } // numeric keys must have number values
 *   }
 * }
 * validatePatternProperties({ 'x-custom': 'value', '42': 100 }, schema, ctx) // => true
 * validatePatternProperties({ 'x-custom': 123 }, schema, ctx) // => false (should be string)
 * ```
 */
export function validatePatternProperties(instance: Record<string, unknown>, schema: Schema, ctx: ValidationContext): boolean {
  if (!schema.patternProperties) {
    return true
  }

  let valid = true
  const patterns: Array<CompiledPatternProperty> = []

  for (const [pattern, patternSchema] of entries(schema.patternProperties)) {
    // why: patternSafetyChecker branch tested in validate.spec.ts
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
        continue
      }
    }

    try {
      // eslint-disable-next-line workspace/no-unsafe-regex -- Pattern safety validated above when safePatterns enabled
      patterns.push({ regex: createRegExp(pattern), schema: patternSchema })
    } catch (e) {
      // why: strictPatterns mode verified in validate.spec.ts
      if (ctx.strictPatterns) {
        // why: error reporting for invalid regex
        addError(ctx, `Invalid regex pattern in patternProperties: ${pattern}`, instance, 'patternProperties', {
          // why: error message extraction
          pattern,
          // why: ternary expression
          /* node:coverage ignore next 1 */
          error: e instanceof Error ? e.message : 'Invalid regex',
        })
        valid = false
        // why: early exit tested in validate.spec.ts
        /* node:coverage ignore next 1 */
        if (!shouldContinue(ctx)) return false
      }
    }
  }

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
