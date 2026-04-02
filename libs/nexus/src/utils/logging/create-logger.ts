import type { Logger, LogLevel } from '@hyperfrontend/logging'
import { logger, createLogger as createLoggerFromLib } from '@hyperfrontend/logging'

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
const createLoggerInternal = (options: NexusLoggerOptions): Logger => {
  const { level = 'error', prefix = DEFAULT_PREFIX, customLogger } = options
  if (customLogger) return customLogger
  logger.setLogLevel('debug')
  const nexusLogger = createLoggerFromLib(
    (...args: unknown[]) => logger.error(prefix, ...args),
    (...args: unknown[]) => logger.warn(prefix, ...args),
    (...args: unknown[]) => logger.log(prefix, ...args),
    (...args: unknown[]) => logger.info(prefix, ...args),
    (...args: unknown[]) => logger.debug(prefix, ...args)
  )
  nexusLogger.setLogLevel(level)
  return nexusLogger
}
