import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isUuidV4 } from '@hyperfrontend/random-generator-utils'
import { isObject } from './_utils'

/**
 * Validates an action structure.
 *
 * @param action - The action to validate
 * @throws {Error} Error if action is invalid
 */
export function validateAction(action: unknown): void {
  if (!action) {
    throw createError('Action cannot be null or undefined')
  }

  if (!isObject(action)) {
    throw createError('Action must be an object')
  }

  const actionRecord = <Record<string, unknown>>action

  if (!actionRecord['type'] || typeof actionRecord['type'] !== 'string') {
    throw createError('Action must have a string type')
  }

  if (!actionRecord['senderId'] || !isUuidV4(<string>actionRecord['senderId'])) {
    throw createError('Action must have a valid UUID senderId')
  }

  if (typeof actionRecord['timestamp'] !== 'number' || <number>actionRecord['timestamp'] <= 0) {
    throw createError('Action must have a valid positive timestamp')
  }

  // Validate processId if present
  if (actionRecord['processId'] !== undefined && actionRecord['processId'] !== null && !isUuidV4(<string>actionRecord['processId'])) {
    throw createError('Action processId must be a valid UUID when present')
  }
}
