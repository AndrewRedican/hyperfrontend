import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { isObject } from './_utils'

/**
 * Validates broker or channel settings.
 *
 * @param settings - The settings object to validate
 * @throws {Error} Error if settings are invalid
 */
export function validateSettings(settings: unknown): void {
  if (settings === null || settings === undefined) {
    return
  }

  if (!isObject(settings)) {
    throw createError('Settings must be an object')
  }

  if ('queueMessages' in settings && typeof settings.queueMessages !== 'boolean') {
    throw createError('Setting queueMessages must be a boolean')
  }

  if ('debug' in settings && typeof settings.debug !== 'boolean') {
    throw createError('Setting debug must be a boolean')
  }

  if ('origin' in settings && typeof settings.origin !== 'string') {
    throw createError('Setting origin must be a string')
  }

  if ('contract' in settings && settings.contract !== null && !isObject(settings.contract)) {
    throw createError('Setting contract must be an object')
  }
}
