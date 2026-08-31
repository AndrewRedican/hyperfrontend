import type { Logger } from './create-logger'
import { getType } from '@hyperfrontend/data-utils'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'

/**
 * Validates whether an object is a properly structured Logger instance.
 * Checks for the presence and type of all required logger methods.
 *
 * @param logger - The object to validate
 * @returns True if the object is a valid logger, false otherwise
 *
 * @example Validating a logger instance
 * ```typescript
 * const logger = createLogger(console.error)
 * isValidLogger(logger) // => true
 * isValidLogger({}) // => false
 * ```
 */
export function isValidLogger(logger: unknown): boolean {
  const l = logger as Logger
  return (
    getType(l) === 'object' &&
    !isArray(l) &&
    getType(l.error) === 'function' &&
    getType(l.warn) === 'function' &&
    getType(l.log) === 'function' &&
    getType(l.info) === 'function' &&
    getType(l.debug) === 'function' &&
    getType(l.setLogLevel) === 'function' &&
    getType(l.getLogLevel) === 'function'
  )
}
