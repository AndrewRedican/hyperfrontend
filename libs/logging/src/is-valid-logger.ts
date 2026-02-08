import type { Logger } from './create-logger'
import { getType } from '@hyperfrontend/data-utils'

/**
 * Validates whether an object is a properly structured Logger instance.
 * Checks for the presence and type of all required logger methods.
 *
 * @param logger - The object to validate
 * @returns True if the object is a valid logger, false otherwise
 */
export function isValidLogger(logger: unknown): boolean {
  const l = logger as Logger
  return (
    getType(l) === 'object' &&
    !Array.isArray(l) &&
    getType(l.error) === 'function' &&
    getType(l.warn) === 'function' &&
    getType(l.log) === 'function' &&
    getType(l.info) === 'function' &&
    getType(l.debug) === 'function' &&
    getType(l.setLogLevel) === 'function' &&
    getType(l.getLogLevel) === 'function'
  )
}
