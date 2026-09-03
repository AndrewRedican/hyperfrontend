import type { Schema } from '../types/schema'
import type { ValidationContext } from './context'

/**
 * Resolves a $ref JSON Pointer to its target schema.
 *
 * @param ref - The $ref string (e.g., '#/definitions/Address')
 * @param ctx - Validation context containing root schema and definitions
 * @returns The resolved schema, or undefined if not found
 * @example Resolving schema references
 * ```typescript
 * const rootSchema = {
 *   definitions: {
 *     Address: { type: 'object', properties: { street: { type: 'string' } } }
 *   }
 * }
 * const ctx = createValidationContext(rootSchema, validate)
 * resolveRef('#/definitions/Address', ctx)
 * // => { type: 'object', properties: { street: { type: 'string' } } }
 * ```
 */
export function resolveRef(ref: string, ctx: ValidationContext): Schema | undefined {
  const cached = ctx.definitions.get(ref)
  if (cached) {
    return cached
  }

  if (!ref.startsWith('#')) {
    return undefined
  }

  if (ref === '#') {
    return ctx.rootSchema
  }

  const path = ref.slice(1)
  if (!path.startsWith('/')) {
    return undefined
  }

  const segments = path
    .split('/')
    .slice(1)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))

  let current: unknown = ctx.rootSchema
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }

  if (current && typeof current === 'object') {
    const resolved = current as Schema
    ctx.definitions.set(ref, resolved)
    return resolved
  }

  return undefined
}
