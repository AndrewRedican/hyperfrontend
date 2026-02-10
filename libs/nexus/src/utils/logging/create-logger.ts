import type { LogLevel } from '@hyperfrontend/logging'
import { createLogger as createLoggerFromLib } from '@hyperfrontend/logging'
import { noop } from '@hyperfrontend/function-utils'

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
  setLogLevel(level: LogLevel): void
  getLogLevel(): LogLevel
}

/**
 * Creates a logger instance configured for nexus.
 *
 * If a custom logger is provided, it will be used directly.
 * Otherwise, a new logger will be created using the logging library.
 *
 * @param debug - Whether debug logging is enabled
 * @param customLogger - Optional custom logger implementing Logger interface
 * @returns Logger instance
 */
export function createLogger(debug: boolean, customLogger?: Logger): Logger {
  // If a custom logger is provided, use it directly
  if (customLogger) {
    return customLogger
  }

  const prefix = '[nexus]'
  const prefixArgs = (...args: unknown[]) => [prefix, ...args]

  const error = (...args: unknown[]) => console.error(...prefixArgs(...args))
  const warn = (...args: unknown[]) => console.warn(...prefixArgs(...args))
  const info = (...args: unknown[]) => console.info(...prefixArgs(...args))
  const debugFn = debug ? (...args: unknown[]) => console.debug(...prefixArgs(...args)) : noop

  const logger = createLoggerFromLib(error, warn, noop, info, debugFn)

  return {
    error: logger.error,
    warn: logger.warn,
    info: logger.info,
    debug: logger.debug,
    setLogLevel: logger.setLogLevel,
    getLogLevel: logger.getLogLevel,
  }
}
