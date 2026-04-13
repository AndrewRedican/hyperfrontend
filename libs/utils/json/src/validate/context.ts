import type { Schema } from '../types/schema'
import type { ValidationError, PatternSafetyChecker } from '../types/validation'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Schema validator function type.
 * Used for dependency injection to avoid circular imports.
 */
export type SchemaValidator = (instance: unknown, schema: Schema, ctx: ValidationContext) => boolean

/**
 * Validation context tracks current path and collects errors.
 */
export interface ValidationContext {
  /** Current JSON Pointer path */
  readonly path: string
  /** Collected validation errors */
  readonly errors: ValidationError[]
  /** Root schema for $ref resolution */
  readonly rootSchema: Schema
  /** Resolved definitions from root schema */
  readonly definitions: Map<string, Schema>
  /** Whether to collect all errors or stop at first */
  readonly collectAllErrors: boolean
  /** Whether to report errors for invalid regex patterns */
  readonly strictPatterns: boolean
  /** Optional pattern safety checker for ReDoS detection */
  readonly patternSafetyChecker?: PatternSafetyChecker
  /** Schema validator function (injected to avoid circular deps) */
  readonly validate: SchemaValidator
}

/**
 * Creates a new validation context.
 *
 * @param rootSchema - The root schema being validated against
 * @param validator - The schema validator function
 * @param collectAllErrors - Whether to collect all errors (default: true)
 * @param strictPatterns - Whether to report errors for invalid regex patterns (default: false)
 * @param patternSafetyChecker - Optional pattern safety checker for ReDoS detection
 * @returns A new validation context
 * @example Creating validation context
 * ```typescript
 * const schema = { type: 'string' }
 * const ctx = createValidationContext(schema, validateSchema)
 * // ctx.path === ''
 * // ctx.errors === []
 * // ctx.collectAllErrors === true
 * ```
 */
export function createValidationContext(
  rootSchema: Schema,
  validator?: SchemaValidator,
  collectAllErrors = true,
  strictPatterns = false,
  patternSafetyChecker?: PatternSafetyChecker
): ValidationContext {
  const definitions = createMap<string, Schema>()

  if (rootSchema.definitions) {
    for (const [name, schema] of entries(rootSchema.definitions)) {
      definitions.set(`#/definitions/${name}`, schema)
    }
  }

  return {
    path: '',
    errors: [],
    rootSchema,
    definitions,
    collectAllErrors,
    strictPatterns,
    patternSafetyChecker,
    validate: validator,
  }
}

/**
 * Creates a child context with updated path.
 *
 * @param ctx - Parent context
 * @param segment - Path segment to append
 * @returns New context with updated path
 * @example Creating child context with path
 * ```typescript
 * const ctx = createValidationContext(schema, validate)
 * const childCtx = pushPath(ctx, 'items')
 * // childCtx.path === '/items'
 * const nestedCtx = pushPath(childCtx, 0)
 * // nestedCtx.path === '/items/0'
 * ```
 */
export function pushPath(ctx: ValidationContext, segment: string | number): ValidationContext {
  const escapedSegment = String(segment).replace(/~/g, '~0').replace(/\//g, '~1')
  return {
    ...ctx,
    path: `${ctx.path}/${escapedSegment}`,
  }
}

/**
 * Adds a validation error to the context.
 *
 * @param ctx - Validation context
 * @param message - Human-readable error message
 * @param instance - The failing value
 * @param code - Optional error code for programmatic handling
 * @param params - Optional additional parameters
 * @example Adding validation error
 * ```typescript
 * const ctx = createValidationContext(schema, validate)
 * addError(ctx, 'Value must be a string', 42, 'type', { expected: 'string' })
 * // ctx.errors[0].message === 'Value must be a string'
 * // ctx.errors[0].code === 'type'
 * ```
 */
export function addError(
  ctx: ValidationContext,
  message: string,
  instance?: unknown,
  code?: string,
  params?: Record<string, unknown>
): void {
  ctx.errors.push({
    message,
    path: ctx.path || '/',
    instance,
    code,
    params,
  })
}

/**
 * Checks if we should continue validation after an error.
 *
 * @param ctx - Validation context
 * @returns true if we should continue, false if we should stop
 * @example Checking error collection mode
 * ```typescript
 * const ctx = createValidationContext(schema, validate, true) // collectAllErrors: true
 * addError(ctx, 'First error', 'value', 'error')
 * shouldContinue(ctx) // => true (keep collecting errors)
 *
 * const ctx2 = createValidationContext(schema, validate, false) // collectAllErrors: false
 * addError(ctx2, 'First error', 'value', 'error')
 * shouldContinue(ctx2) // => false (stop at first error)
 * ```
 */
export function shouldContinue(ctx: ValidationContext): boolean {
  return ctx.collectAllErrors || ctx.errors.length === 0
}
