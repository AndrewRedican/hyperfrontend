import type { Schema, ValidationError } from '../types'

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
  /** Schema validator function (injected to avoid circular deps) */
  readonly validate: SchemaValidator
}

/**
 * Creates a new validation context.
 *
 * @param rootSchema - The root schema being validated against
 * @param validator - The schema validator function
 * @param collectAllErrors - Whether to collect all errors (default: true)
 * @returns A new validation context
 */
export function createValidationContext(rootSchema: Schema, validator: SchemaValidator, collectAllErrors = true): ValidationContext {
  const definitions = new Map<string, Schema>()

  // Pre-populate definitions from root schema
  if (rootSchema.definitions) {
    for (const [name, schema] of Object.entries(rootSchema.definitions)) {
      definitions.set(`#/definitions/${name}`, schema)
    }
  }

  return {
    path: '',
    errors: [],
    rootSchema,
    definitions,
    collectAllErrors,
    validate: validator,
  }
}

/**
 * Creates a child context with updated path.
 *
 * @param ctx - Parent context
 * @param segment - Path segment to append
 * @returns New context with updated path
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
 */
export function shouldContinue(ctx: ValidationContext): boolean {
  return ctx.collectAllErrors || ctx.errors.length === 0
}
