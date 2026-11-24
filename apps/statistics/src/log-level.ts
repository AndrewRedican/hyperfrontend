import type { LogLevel } from '@hyperfrontend/logging'
import type { Reader } from '@hyperfrontend/server/environment'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isValidLogLevel } from '@hyperfrontend/logging'

/**
 * Reads how much the service writes of its own, as a level of the logging package.
 *
 * @returns A frozen reader that yields the level
 *
 * @example Reading a level from the environment
 * ```typescript
 * asLogLevel().read('info') // => 'info'
 * asLogLevel().read('verbose') // => undefined
 * ```
 */
export function asLogLevel(): Reader<LogLevel> {
  return freeze({
    expected: 'one of none, error, warn, log, info and debug',
    secret: false,
    read: (raw: string): LogLevel | undefined => (isValidLogLevel(raw) ? raw : undefined),
  })
}
