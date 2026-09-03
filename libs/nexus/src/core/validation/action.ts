import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'
import { isObject } from './_utils'

/**
 * Validates an action structure.
 *
 * @param action - The action to validate
 * @throws {Error} Error if action is invalid
 *
 * @example Validating action structure
 * ```typescript
 * validateAction({
 *   type: 'MESSAGE',
 *   senderId: '550e8400-e29b-41d4-a716-446655440000',
 *   timestamp: Date.now()
 * })
 * ```
 */
export function validateAction(action: unknown): void {
  if (!action) {
    throw createError('Action cannot be null or undefined')
  }

  if (!isObject(action)) {
    throw createError('Action must be an object')
  }

  const actionRecord = action as Record<string, unknown>

  if (!actionRecord['type'] || typeof actionRecord['type'] !== 'string') {
    throw createError('Action must have a string type')
  }

  if (!actionRecord['senderId'] || !isUuidV4(actionRecord['senderId'] as string)) {
    throw createError('Action must have a valid UUID senderId')
  }

  if (typeof actionRecord['timestamp'] !== 'number' || (actionRecord['timestamp'] as number) <= 0) {
    throw createError('Action must have a valid positive timestamp')
  }

  if (actionRecord['processId'] !== undefined && actionRecord['processId'] !== null && !isUuidV4(actionRecord['processId'] as string)) {
    throw createError('Action processId must be a valid UUID when present')
  }
}
