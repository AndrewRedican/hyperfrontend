import { isObject } from './_utils'

/**
 * Validates broker or channel settings.
 *
 * @param settings - The settings object to validate
 * @throws {Error} Error if settings are invalid
 */
export function validateSettings(settings: unknown): void {
  if (settings === null || settings === undefined) {
    // Settings are optional, so null/undefined is OK
    return
  }

  if (!isObject(settings)) {
    throw new Error('Settings must be an object')
  }

  // Validate queueMessages if present
  if ('queueMessages' in settings && typeof settings.queueMessages !== 'boolean') {
    throw new Error('Setting queueMessages must be a boolean')
  }

  // Validate debug if present
  if ('debug' in settings && typeof settings.debug !== 'boolean') {
    throw new Error('Setting debug must be a boolean')
  }

  // Validate origin if present
  if ('origin' in settings && typeof settings.origin !== 'string') {
    throw new Error('Setting origin must be a string')
  }

  // Validate contract if present
  if ('contract' in settings && settings.contract !== null && !isObject(settings.contract)) {
    throw new Error('Setting contract must be an object')
  }
}
