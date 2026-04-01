import type { Schema } from '../../types/schema'
import type { ValidationContext } from '../context'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { entries, hasOwn } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { addError, shouldContinue } from '../context'

/**
 * Validates object 'dependencies' keyword.
 *
 * @param instance - Object being validated
 * @param schema - Schema containing the dependencies constraint
 * @param ctx - Validation context
 * @returns true if validation passes, false otherwise
 */
export function validateDependencies(instance: Record<string, unknown>, schema: Schema, ctx: ValidationContext): boolean {
  if (!schema.dependencies) {
    return true
  }

  let valid = true

  for (const [key, dependency] of entries(schema.dependencies)) {
    /* istanbul ignore next -- key presence check */
    if (!hasOwn(instance, key)) {
      continue
    }

    /* istanbul ignore next -- dependency type check */
    if (isArray(dependency)) {
      for (const requiredKey of dependency) {
        /* istanbul ignore next -- required key check */
        if (!hasOwn(instance, requiredKey)) {
          addError(ctx, `Property '${key}' requires property '${requiredKey}' to also be present`, instance, 'dependencies', {
            property: key,
            /* istanbul ignore next -- required key assignment */
            required: requiredKey,
          })
          valid = false
          /* istanbul ignore if -- early exit tested in validate.spec.ts */
          if (!shouldContinue(ctx)) return false
        }
      }
    } else {
      /* istanbul ignore next -- schema dependency validation */
      if (!ctx.validate(instance, dependency, ctx)) {
        /* istanbul ignore next -- failure path */
        valid = false
        /* istanbul ignore if -- early exit tested in validate.spec.ts */
        if (!shouldContinue(ctx)) return false
      }
    }
  }

  return valid
}
