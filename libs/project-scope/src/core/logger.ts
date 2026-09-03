import type { Logger, LogLevel } from '@hyperfrontend/logging'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { error, warn, log, info, debug } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { freeze, entries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { createLogger as createBaseLogger } from '@hyperfrontend/logging'

/** Re-export LogLevel for convenience */
export type { LogLevel } from '@hyperfrontend/logging'

/**
 * Global log level registry.
 * Tracks all created scoped loggers to allow global log level changes.
 */
const loggerRegistry: Set<ScopedLogger> = createSet()

/**
 * Current global log level override.
 * When set to a value other than null, all registered loggers use this level.
 */
let globalLogLevel: LogLevel | null = null

/**
 * Set the log level for all registered scoped loggers.
 * This is useful for enabling verbose logging across the entire library.
 *
 * @param level - The log level to set globally
 *
 * @example Enabling debug logging globally
 * ```typescript
 * import { setGlobalLogLevel } from '@hyperfrontend/project-scope/core'
 *
 * // Enable debug logging for all project-scope modules
 * setGlobalLogLevel('debug')
 * ```
 */
export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level
  for (const logger of loggerRegistry) {
    logger.setLogLevel(level)
  }
}

/**
 * Get the current global log level.
 *
 * @returns The global log level, or null if not set
 *
 * @example Getting current log level
 * ```typescript
 * setGlobalLogLevel('debug')
 * const level = getGlobalLogLevel()
 * // => 'debug'
 * ```
 */
export function getGlobalLogLevel(): LogLevel | null {
  return globalLogLevel
}

/**
 * Reset the global log level override.
 * Each logger will retain its current level but new loggers will use their default.
 *
 * @example Resetting the global log level
 * ```typescript
 * setGlobalLogLevel('debug')
 * // ... perform debugging ...
 * resetGlobalLogLevel()
 * // Global override removed, loggers use individual levels
 * ```
 */
export function resetGlobalLogLevel(): void {
  globalLogLevel = null
}

/** Redacted placeholder for sensitive values */
const REDACTED = '[REDACTED]'

/**
 * Patterns that indicate a sensitive key name.
 * Keys containing these patterns will have their values sanitized.
 */
const SENSITIVE_KEY_PATTERNS: ReadonlyArray<RegExp> = [
  /token/i,
  /key/i,
  /password/i,
  /secret/i,
  /credential/i,
  /auth/i,
  /bearer/i,
  /api[_-]?key/i,
  /private/i,
  /passphrase/i,
]

/**
 * Checks if a key name indicates sensitive data.
 *
 * @param key - Key name to check
 * @returns True if the key indicates sensitive data
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

/**
 * Sanitizes an object by replacing sensitive values with REDACTED.
 * This function recursively processes nested objects and arrays.
 *
 * @param obj - Object to sanitize
 * @returns New object with sensitive values redacted
 *
 * @example Sanitizing sensitive data
 * ```typescript
 * const config = { apiKey: 'secret123', endpoint: 'https://api.example.com' }
 * const safe = sanitize(config)
 * // => { apiKey: '[REDACTED]', endpoint: 'https://api.example.com' }
 * ```
 */
export function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (isArray(obj)) {
    return (obj as unknown[]).map((item) => sanitize(item))
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of entries(obj as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        result[key] = REDACTED
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitize(value)
      } else {
        result[key] = value
      }
    }
    return result
  }

  return obj
}

/**
 * Formats a log message with optional metadata.
 *
 * @param namespace - Logger namespace prefix
 * @param message - Log message
 * @param meta - Optional metadata object
 * @returns Formatted log string
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
 * Options for creating a scoped logger.
 */
export interface ScopedLoggerOptions {
  /**
   * Initial log level.
   * Messages below this level will not be logged.
   *
   * @default 'error'
   */
  level?: LogLevel
  /**
   * Whether to sanitize sensitive data in metadata.
   *
   * @default true
   */
  sanitizeSecrets?: boolean
}

/**
 * A scoped logger instance with namespace prefix and secret sanitization.
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
 * Creates a scoped logger with namespace prefix and optional secret sanitization.
 * All log messages will be prefixed with [namespace] and sensitive metadata
 * values will be automatically redacted.
 *
 * @param namespace - Logger namespace (e.g., 'project-scope', 'analyze')
 * @param options - Logger configuration options
 * @returns A configured scoped logger instance
 *
 * @example Creating a scoped logger
 * ```typescript
 * const logger = createScopedLogger('project-scope')
 * logger.setLogLevel('debug')
 *
 * // Basic logging
 * logger.info('Starting analysis', { path: './project' })
 *
 * // Sensitive data is automatically redacted
 * logger.debug('Config loaded', { apiKey: 'secret123' })
 * // Output: [project-scope] Config loaded {"apiKey":"[REDACTED]"}
 * ```
 */
export function createScopedLogger(namespace: string, options: ScopedLoggerOptions = {}): ScopedLogger {
  const { level = 'error', sanitizeSecrets = true } = options

  const createLogFn =
    (baseFn: (...args: unknown[]) => void) =>
    (message: string, meta?: object): void => {
      const processedMeta = sanitizeSecrets && meta ? (sanitize(meta) as object) : meta
      baseFn(formatMessage(namespace, message, processedMeta))
    }

  const baseLogger: Logger = createBaseLogger(
    createLogFn(error),
    createLogFn(warn),
    createLogFn(log),
    createLogFn(info),
    createLogFn(debug)
  )

  baseLogger.setLogLevel(globalLogLevel ?? level)

  const scopedLogger: ScopedLogger = freeze({
    error: (message: string, meta?: object) => baseLogger.error(message, meta),
    warn: (message: string, meta?: object) => baseLogger.warn(message, meta),
    log: (message: string, meta?: object) => baseLogger.log(message, meta),
    info: (message: string, meta?: object) => baseLogger.info(message, meta),
    debug: (message: string, meta?: object) => baseLogger.debug(message, meta),
    setLogLevel: baseLogger.setLogLevel,
    getLogLevel: baseLogger.getLogLevel,
  })

  loggerRegistry.add(scopedLogger)

  return scopedLogger
}

/**
 * Default logger instance for the project-scope library.
 * Use this for general logging within the library.
 *
 * @example Using the default logger
 * ```typescript
 * import { logger } from '@hyperfrontend/project-scope/core'
 *
 * logger.setLogLevel('debug')
 * logger.debug('Analyzing project', { path: './src' })
 * ```
 */
export const logger: ScopedLogger = createScopedLogger('project-scope')
