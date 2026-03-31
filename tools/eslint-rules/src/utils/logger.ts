import type { Logger, LogLevel } from '@hyperfrontend/logging'
import { logger as nxLogger } from '@nx/devkit'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createLogger } from '@hyperfrontend/logging'
import { sanitize } from '@hyperfrontend/project-scope/core/logger'

export type { LogLevel, Logger } from '@hyperfrontend/logging'

/**
 * A scoped logger instance with namespace prefix and secret sanitization.
 * Uses `@nx/devkit` logger under the hood for proper Nx integration.
 */
export interface ScopedLogger {
  /** Log at error level */
  error: (message: string, meta?: object) => void
  /** Log at warn level */
  warn: (message: string, meta?: object) => void
  /** Log at log level */
  log: (message: string, meta?: object) => void
  /** Log at info level */
  info: (message: string, meta?: object) => void
  /** Log at debug level */
  debug: (message: string, meta?: object) => void
  /** Set the current log level */
  setLogLevel: (level: LogLevel) => void
  /** Get the current log level */
  getLogLevel: () => LogLevel
}

/**
 * Options for creating a scoped logger.
 */
export interface ScopedLoggerOptions {
  /**
   * Initial log level.
   *
   * @default 'error'
   */
  level?: LogLevel
}

/**
 * Formats a log message with optional metadata.
 *
 * @param namespace - Logger namespace for prefixing (e.g., 'eslint-rules', 'eslint-rules:deepest-import-path')
 * @param message - The main log message
 * @param meta - Optional metadata object to include in the log
 * @returns A formatted log message string with namespace prefix and sanitized metadata
 */
function formatMessage(namespace: string, message: string, meta?: object): string {
  const prefix = `[${namespace}]`
  if (meta && keys(meta).length > 0) {
    const sanitizedMeta = sanitize(meta)
    return `${prefix} ${message} ${stringify(sanitizedMeta)}`
  }
  return `${prefix} ${message}`
}

/**
 * Creates a scoped logger that uses `@nx/devkit` logger under the hood.
 * Provides namespace prefixing and automatic secret sanitization.
 *
 * @param namespace - Logger namespace (e.g., 'eslint-rules', 'eslint-rules:deepest-import-path')
 * @param options - Logger configuration options
 * @returns A configured scoped logger instance
 *
 * @example
 * ```typescript
 * const logger = createNxScopedLogger('eslint-rules')
 * logger.setLogLevel('debug')
 * logger.debug('Processing file', { file: 'index.ts' })
 * // Output: [eslint-rules] Processing file {"file":"index.ts"}
 * ```
 */
export function createNxScopedLogger(namespace: string, options: ScopedLoggerOptions = {}): ScopedLogger {
  const { level = 'error' } = options

  const createLogFn =
    (baseFn: (message: string) => void) =>
    (message: string, meta?: object): void => {
      baseFn(formatMessage(namespace, message, meta))
    }

  const baseLogger: Logger = createLogger(
    createLogFn((msg) => nxLogger.error(msg)),
    createLogFn((msg) => nxLogger.warn(msg)),
    createLogFn((msg) => nxLogger.log(msg)),
    createLogFn((msg) => nxLogger.info(msg)),
    createLogFn((msg) => nxLogger.debug(msg))
  )

  baseLogger.setLogLevel(level)

  return freeze({
    error: (message: string, meta?: object) => baseLogger.error(message, meta),
    warn: (message: string, meta?: object) => baseLogger.warn(message, meta),
    log: (message: string, meta?: object) => baseLogger.log(message, meta),
    info: (message: string, meta?: object) => baseLogger.info(message, meta),
    debug: (message: string, meta?: object) => baseLogger.debug(message, meta),
    setLogLevel: baseLogger.setLogLevel,
    getLogLevel: baseLogger.getLogLevel,
  })
}

/**
 * Scoped logger for eslint-rules.
 * Uses `@nx/devkit` logger under the hood with 'eslint-rules' prefix.
 */
export const logger: ScopedLogger = createNxScopedLogger('eslint-rules')

/**
 * Create a sub-scoped logger for a specific rule or module.
 *
 * @param scope - The scope name (e.g., 'deepest-import-path')
 * @returns A scoped logger instance
 *
 * @example
 * ```typescript
 * const ruleLogger = createRuleLogger('deepest-import-path')
 * ruleLogger.debug('Processing file', { file: 'index.ts' })
 * // Output: [eslint-rules:deepest-import-path] Processing file {"file":"index.ts"}
 * ```
 */
export function createRuleLogger(scope: string): ScopedLogger {
  return createNxScopedLogger(`eslint-rules:${scope}`)
}
