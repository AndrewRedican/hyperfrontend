import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { entries, keys, hasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createRegExp } from '@hyperfrontend/immutable-api-utils/built-in-copy/regexp'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { addError, pushPath, shouldContinue } from '../context'

/**
 * Validates object 'properties' keyword.
 *
 * @param instance - Object being validated
 * @param schema - Schema containing the properties constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateProperties(instance: Record<string, unknown>, schema: Schema, ctx: ValidationContext): boolean {
  if (!schema.properties) {
    return true
  }

  let valid = true
  for (const [key, propSchema] of entries(schema.properties)) {
    if (hasOwn(instance, key)) {
      const propCtx = pushPath(ctx, key)
      if (!ctx.validate(instance[key], propSchema, propCtx)) {
        valid = false
        if (!shouldContinue(ctx)) return false
      }
    }
  }

  return valid
}

/**
 * Validates object 'required' keyword.
 *
 * @param instance - Object being validated
 * @param schema - Schema containing the required constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateRequired(instance: Record<string, unknown>, schema: Schema, ctx: ValidationContext): boolean {
  if (!schema.required) {
    return true
  }

  let valid = true
  for (const key of schema.required) {
    if (!hasOwn(instance, key)) {
      addError(ctx, `Missing required property: ${key}`, undefined, 'required', { missing: key })
      valid = false
      if (!shouldContinue(ctx)) return false
    }
  }

  return valid
}

/**
 * Validates object 'additionalProperties' keyword.
 *
 * @param instance - Object being validated
 * @param schema - Schema containing the additionalProperties constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateAdditionalProperties(instance: Record<string, unknown>, schema: Schema, ctx: ValidationContext): boolean {
  const additionalProperties = schema.additionalProperties
  if (additionalProperties === undefined) {
    return true
  }

  /* istanbul ignore next -- definedKeys initialization */
  // Collect defined property names
  const definedKeys = createSet<string>()

  /* istanbul ignore next -- schema.properties may not exist */
  if (schema.properties) {
    for (const key of keys(schema.properties)) {
      definedKeys.add(key)
    }
  }

  // Collect pattern property regexes
  const patterns: RegExp[] = []
  /* istanbul ignore next -- patternProperties may not always be present */
  if (schema.patternProperties) {
    for (const pattern of keys(schema.patternProperties)) {
      // Skip unsafe patterns if a checker is configured (already reported in patternProperties validator)
      if (ctx.patternSafetyChecker) {
        const safetyResult = ctx.patternSafetyChecker(pattern)
        if (!safetyResult.safe) {
          continue // Skip this unsafe pattern
        }
      }

      try {
        // eslint-disable-next-line workspace/no-unsafe-regex -- Pattern safety validated above when safePatterns enabled
        patterns.push(createRegExp(pattern))
        /* istanbul ignore next -- invalid regex patterns handled in patternProperties validator */
      } catch {
        // Invalid regex, skip
      }
    }
  }

  let valid = true

  for (const key of keys(instance)) {
    // Skip if property is defined in 'properties'
    if (definedKeys.has(key)) {
      continue
    }

    // Skip if property matches any pattern in 'patternProperties'
    if (patterns.some((p) => p.test(key))) {
      continue
    }

    // This is an additional property
    if (additionalProperties === false) {
      addError(ctx, `Additional property not allowed: ${key}`, instance[key], 'additionalProperties', {
        property: key,
      })
      valid = false
      /* istanbul ignore if -- early exit tested in validate.spec.ts */
      if (!shouldContinue(ctx)) return false
    } else if (typeof additionalProperties === 'object') {
      const propCtx = pushPath(ctx, key)
      if (!ctx.validate(instance[key], additionalProperties, propCtx)) {
        valid = false
        /* istanbul ignore if -- early exit tested in validate.spec.ts */
        if (!shouldContinue(ctx)) return false
      }
    }
    // If additionalProperties === true, any additional property is allowed
  }

  return valid
}
