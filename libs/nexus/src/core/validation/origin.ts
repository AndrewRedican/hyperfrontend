import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { isEmpty } from './_utils'

/**
 * Validates an origin URL.
 *
 * @param origin - The origin to validate
 * @throws {Error} Error if origin is invalid
 */
export function validateOrigin(origin: string): void {
  if (origin === null || origin === undefined) {
    throw createError('Origin cannot be null or undefined')
  }

  if (typeof origin !== 'string') {
    throw createError('Origin must be a string')
  }

  if (isEmpty(origin)) {
    throw createError('Origin cannot be empty')
  }

  if (origin === '*') {
    return
  }

  try {
    const url = createURL(origin)
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw createError('Origin must use http or https protocol')
    }
  } catch (error) {
    throw createError(`Invalid origin URL: ${(<Error>error).message}`)
  }
}
