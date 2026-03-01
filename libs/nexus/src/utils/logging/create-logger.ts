import type { Logger, LogLevel } from '@hyperfrontend/logging'
import { createLogger as createLoggerFromLib } from '@hyperfrontend/logging'

// Re-export for consumers
export type { Logger, LogLevel }

/**
 * Options for creating a nexus logger.
 */
export interface NexusLoggerOptions {
  /** Minimum log level to emit (default: 'error') */
  readonly level?: LogLevel
  /** Prefix for log messages (default: '[nexus]') */
  readonly prefix?: string
  /** Custom logger instance to use instead of creating one */
  readonly customLogger?: Logger
}

const DEFAULT_PREFIX = '[nexus]'

/**
 * Creates a logger instance configured for nexus.
 *
 * If a custom logger is provided, it will be used directly.
 * Otherwise, a new logger will be created using the logging library.
 *
 * @param options - Logger configuration options
 * @returns Logger instance
 */
export function createLogger(options: NexusLoggerOptions = {}): Logger {
  return createLoggerInternal(options)
}

/**
 * Internal helper to create a logger with given options.
 *
 * @param options - Logger configuration options
 * @returns Configured logger instance
 * @internal
 */
function createLoggerInternal(options: NexusLoggerOptions): Logger {
  const { level = 'error', prefix = DEFAULT_PREFIX, customLogger } = options

  // If a custom logger is provided, use it directly
  if (customLogger) {
    return customLogger
  }

  const prefixArgs = (...args: unknown[]) => [prefix, ...args]

  const error = (...args: unknown[]) => console.error(...prefixArgs(...args))
  const warn = (...args: unknown[]) => console.warn(...prefixArgs(...args))
  const log = (...args: unknown[]) => console.log(...prefixArgs(...args))
  const info = (...args: unknown[]) => console.info(...prefixArgs(...args))
  const debug = (...args: unknown[]) => console.debug(...prefixArgs(...args))

  const logger = createLoggerFromLib(error, warn, log, info, debug)

  // Set the log level
  logger.setLogLevel(level)

  return logger
}
