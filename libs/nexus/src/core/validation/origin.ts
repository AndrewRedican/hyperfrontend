import { isEmpty } from './_utils'

/**
 * Validates an origin URL.
 *
 * @param origin - The origin to validate
 * @throws {Error} Error if origin is invalid
 */
export function validateOrigin(origin: string): void {
  if (origin === null || origin === undefined) {
    throw new Error('Origin cannot be null or undefined')
  }

  if (typeof origin !== 'string') {
    throw new Error('Origin must be a string')
  }

  if (isEmpty(origin)) {
    throw new Error('Origin cannot be empty')
  }

  // Allow wildcard
  if (origin === '*') {
    return
  }

  // Validate as URL
  try {
    const url = new URL(origin)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Origin must use http or https protocol')
    }
  } catch (error) {
    throw new Error(`Invalid origin URL: ${(<Error>error).message}`)
  }
}
