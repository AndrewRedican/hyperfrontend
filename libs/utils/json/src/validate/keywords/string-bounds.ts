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
 * @example Validating string constraints
 * ```typescript
 * const schema = { minLength: 3, maxLength: 10, pattern: '^[a-z]+$' }
 * validateStringBounds('hello', schema, ctx) // => true
 * validateStringBounds('hi', schema, ctx)    // => false (too short)
 * validateStringBounds('Hello', schema, ctx) // => false (contains uppercase)
 * ```
 */
export function validateStringBounds(instance: string, schema: Schema, ctx: ValidationContext): boolean {
  let valid = true
  const length = countCodePoints(instance)

  if (schema.minLength !== undefined && length < schema.minLength) {
    addError(ctx, `String must be at least ${schema.minLength} characters, got ${length}`, instance, 'minLength', {
      limit: schema.minLength,
      actual: length,
    })
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  if (schema.maxLength !== undefined && length > schema.maxLength) {
    addError(ctx, `String must be at most ${schema.maxLength} characters, got ${length}`, instance, 'maxLength', {
      limit: schema.maxLength,
      actual: length,
    })
    valid = false
    if (!shouldContinue(ctx)) return false
  }

  if (schema.pattern !== undefined) {
    if (ctx.patternSafetyChecker) {
      const safetyResult = ctx.patternSafetyChecker(schema.pattern)
      if (!safetyResult.safe) {
        addError(ctx, `Unsafe regex pattern: ${safetyResult.reason ?? 'Pattern may cause ReDoS'}`, instance, 'pattern', {
          pattern: schema.pattern,
          reason: safetyResult.reason,
        })
        valid = false
        if (!shouldContinue(ctx)) return false
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
      // why: strictPatterns mode verified in validate.spec.ts
      if (ctx.strictPatterns) {
        // why: error reporting for invalid regex
        addError(ctx, `Invalid regex pattern: ${schema.pattern}`, instance, 'pattern', {
          pattern: schema.pattern,
          // why: error message extraction ternary
          error: e instanceof Error ? e.message : 'Invalid regex',
        })
        valid = false
        // why: early exit tested in validate.spec.ts
        if (!shouldContinue(ctx)) return false
      }
    }
  }

  return valid
}

/**
 * Counts the characters of a string the way Draft 4 defines string length: by code point, not by UTF-16 unit.
 *
 * @param value - String to measure
 * @returns Number of code points, with each surrogate pair counted once
 */
function countCodePoints(value: string): number {
  let count = 0
  for (let index = 0; index < value.length; index++) {
    const unit = value.charCodeAt(index)
    const next = value.charCodeAt(index + 1)
    // why: a high surrogate followed by a low surrogate encodes one character across two units
    if (unit >= 0xd800 && unit <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) index++
    count++
  }
  return count
}
