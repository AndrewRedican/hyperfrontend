import type { LogLevel, SetLogLevel, GetLogLevel } from './create-log-level-config'
import { getType } from '@hyperfrontend/data-utils'
import { noop, createConditionalExecutionFunction, createErrorIgnoringFunction } from '@hyperfrontend/function-utils'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createLogLevelConfig } from './create-log-level-config'

/** Function signature for standard log output */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LogLevelFn = (...data: any[]) => void

/** Function signature for warning output */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WarnLevelFn = (...data: any[]) => void

/** Function signature for error output */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ErrorLevelFn = (...data: any[]) => void

/** Function signature for info output */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type InfoLevelFn = (...data: any[]) => void

/** Function signature for debug output */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DebugLevelFn = (...data: any[]) => void

/** Returns a sub-logger that prepends `[prefix]` to every message. */
export type ChannelFn = (prefix: string) => Logger

/** Wraps a sync call with timing. Logs completion or failure with elapsed ms. */
export type TimedFn = <T>(label: string, fn: () => T) => T

/** Wraps a promise-returning call with timing. Dumps stack trace on error to debug log. */
export type TimedAsyncFn = <T>(label: string, fn: () => Promise<T>) => Promise<T>

/** Logger interface with level-specific methods and level control */
export interface Logger {
  /** Standard log output */
  log: LogLevelFn
  /** Warning-level output */
  warn: WarnLevelFn
  /** Error-level output */
  error: ErrorLevelFn
  /** Info-level output */
  info: InfoLevelFn
  /** Debug-level output */
  debug: DebugLevelFn
  /** Sets the current log level */
  setLogLevel: SetLogLevel
  /** Gets the current log level */
  getLogLevel: GetLogLevel
  /** Returns a sub-logger that prepends `[prefix]` to every message. */
  channel: ChannelFn
  /** Wraps a sync call with timing. Logs completion or failure with elapsed ms. */
  timed: TimedFn
  /** Wraps a promise-returning call with timing. Dumps stack trace on error to debug log. */
  timedAsync: TimedAsyncFn
}

/** Keys of Logger that represent log functions */
export type LogFnName = Extract<keyof Logger, 'error' | 'warn' | 'log' | 'info' | 'debug'>

/** Union type of all log function signatures */
export type LogFunction = Logger[LogFnName]

/** Internal level-aware log functions plus shared level controls used by every channel. */
interface LoggerCore {
  /** Level-aware error function. */
  error: LogFunction
  /** Level-aware warn function. */
  warn: LogFunction
  /** Level-aware log function. */
  log: LogFunction
  /** Level-aware info function. */
  info: LogFunction
  /** Level-aware debug function. */
  debug: LogFunction
  /** Shared setter that mutates the level seen by every channel. */
  setLogLevel: SetLogLevel
  /** Shared getter for the current level. */
  getLogLevel: GetLogLevel
}

/**
 * Creates a logger instance with configurable log level filtering.
 * Each log function is wrapped to respect the current log level setting.
 *
 * @param error - Function to handle error-level logs (required)
 * @param warn - Function to handle warning-level logs (optional, defaults to noop)
 * @param log - Function to handle standard logs (optional, defaults to noop)
 * @param info - Function to handle info-level logs (optional, defaults to noop)
 * @param debug - Function to handle debug-level logs (optional, defaults to noop)
 * @returns A frozen logger object with log methods, level control, channel, and timing helpers
 * @throws {ErrorLevelFn} When any provided log function is invalid
 *
 * @example Creating a logger with log level filtering
 * ```typescript
 * const logger = createLogger(console.error, console.warn, console.log)
 * logger.setLogLevel('warn')
 * logger.warn('Connection timeout') // logs
 * logger.info('Request complete')   // suppressed (below 'warn' level)
 * ```
 *
 * @example Channeling and timing
 * ```typescript
 * const logger = createLogger(console.error, console.warn, console.log, console.info, console.debug)
 * logger.setLogLevel('debug')
 * const build = logger.channel('build')
 * await build.timedAsync('bundle', async () => bundle())
 * ```
 */
export function createLogger(
  error: ErrorLevelFn,
  warn: WarnLevelFn = noop,
  log: LogLevelFn = noop,
  info: InfoLevelFn = noop,
  debug: DebugLevelFn = noop
): Logger {
  if (notValidLogFn(error)) {
    throw createError(notFnMsg('error'))
  }
  if (notValidLogFn(warn)) {
    throw createError(notFnMsg('warn'))
  }
  if (notValidLogFn(log)) {
    throw createError(notFnMsg('log'))
  }
  if (notValidLogFn(info)) {
    throw createError(notFnMsg('info'))
  }
  if (notValidLogFn(debug)) {
    throw createError(notFnMsg('debug'))
  }
  const { setLogLevel, getLogLevel, shouldLog } = createLogLevelConfig()
  const wrapLogFn = (fn: LogFunction, level: LogLevel): LogFunction => {
    if (fn === noop) return fn
    const condition = () => shouldLog(level)
    return createConditionalExecutionFunction(createErrorIgnoringFunction(fn), condition)
  }
  const core: LoggerCore = {
    error: wrapLogFn(error, 'error'),
    warn: wrapLogFn(warn, 'warn'),
    log: wrapLogFn(log, 'log'),
    info: wrapLogFn(info, 'info'),
    debug: wrapLogFn(debug, 'debug'),
    setLogLevel,
    getLogLevel,
  }
  return createPrefixedLogger(core, '')
}

/**
 * Creates a Logger that prepends `[fullPrefix]` to every log call. When `fullPrefix`
 * is empty, returns a Logger that delegates directly to the core functions.
 *
 * @param core - Shared level-aware log functions and level controls.
 * @param fullPrefix - Channel chain joined with `:`, or `''` for the root logger.
 * @returns A frozen Logger that emits with the resolved prefix.
 */
function createPrefixedLogger(core: LoggerCore, fullPrefix: string): Logger {
  const tag = fullPrefix ? `[${fullPrefix}]` : ''
  const prefixed = (fn: LogFunction): LogFunction => {
    if (!tag) return fn
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (...data: any[]) => fn(tag, ...data)
  }
  const instance: Logger = freeze({
    error: prefixed(core.error),
    warn: prefixed(core.warn),
    log: prefixed(core.log),
    info: prefixed(core.info),
    debug: prefixed(core.debug),
    setLogLevel: core.setLogLevel,
    getLogLevel: core.getLogLevel,
    channel: (childPrefix: string): Logger => createPrefixedLogger(core, fullPrefix ? `${fullPrefix}:${childPrefix}` : childPrefix),
    timed<T>(label: string, fn: () => T): T {
      return runTimed(instance, label, fn)
    },
    timedAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
      return runTimedAsync(instance, label, fn)
    },
  })
  return instance
}

/**
 * Times a sync call, logging completion at debug level or failure at error level.
 *
 * @param logger - The logger used to emit the timing message.
 * @param label - Human-readable label for the timed operation.
 * @param fn - The synchronous operation to invoke.
 * @returns The value returned by `fn`.
 */
function runTimed<T>(logger: Logger, label: string, fn: () => T): T {
  const start = dateNow()
  try {
    const result = fn()
    const elapsed = dateNow() - start
    logger.debug(`${label} completed in ${elapsed}ms`)
    return result
  } catch (error) {
    const elapsed = dateNow() - start
    logger.error(`${label} failed after ${elapsed}ms: ${describeError(error)}`)
    throw error
  }
}

/**
 * Times an async call, logging completion at debug level or failure at error level.
 * On rejection with an `Error` carrying a stack, the stack is also dumped at debug level.
 *
 * @param logger - The logger used to emit the timing message.
 * @param label - Human-readable label for the timed operation.
 * @param fn - The async operation to invoke.
 * @returns The value resolved by `fn`'s promise.
 */
async function runTimedAsync<T>(logger: Logger, label: string, fn: () => Promise<T>): Promise<T> {
  const start = dateNow()
  try {
    const result = await fn()
    const elapsed = dateNow() - start
    logger.debug(`${label} completed in ${elapsed}ms`)
    return result
  } catch (error) {
    const elapsed = dateNow() - start
    logger.error(`${label} failed after ${elapsed}ms: ${describeError(error)}`)
    if (error instanceof Error && error.stack) {
      logger.debug(`Stack trace:\n${error.stack}`)
    }
    throw error
  }
}

/**
 * Extracts a human-readable message from an unknown thrown value.
 *
 * @param error - The unknown value caught from a try/catch or rejected promise.
 * @returns The error's `message` when it is an `Error`, otherwise its string coercion.
 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Validates whether a given value is a valid log function.
 *
 * @param fn - The value to validate
 * @returns True if the value is not a function (invalid), false if it is valid
 */
function notValidLogFn(fn: unknown): boolean {
  return getType(fn) !== 'function' && fn !== noop
}

/**
 * Generates an error message for invalid log function parameters.
 *
 * @param label - The name of the log function that failed validation
 * @returns A formatted error message string
 */
function notFnMsg(label: LogFnName): string {
  return `Cannot create a logger when ${label} is not a function`
}
