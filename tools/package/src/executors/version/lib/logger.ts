import type { Logger } from '@hyperfrontend/logging'
import type { VersionExecutorSchema } from '../schema'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { logger as baseLogger } from '@hyperfrontend/logging'

export type { LogLevel, Logger } from '@hyperfrontend/logging'

/** Channel logger with numbered steps and sub-items */
export interface ChannelLogger {
  /** Log a numbered step (auto-incremented) */
  step: (message: string) => void
  /** Log a sub-item (indented with dash) */
  item: (message: string) => void
  /** Log an error message */
  error: (message: string) => void
  /** Log a warning message */
  warn: (message: string) => void
  /** Log an info message (for summaries) */
  info: (message: string) => void
  /** Log a debug message (numbered step) - alias for step */
  debug: (message: string) => void
  /** Log a regular message */
  log: (message: string) => void
  /** Get current log level */
  getLogLevel: () => string
}

/**
 * Extended logger interface for version executor operations.
 */
interface ExecutorLogger extends Omit<Logger, 'setLogLevel'> {
  /** Sets log level based on verbose/quiet flags */
  setLogLevel: (level: Pick<VersionExecutorSchema, 'verbose' | 'quiet'>) => void
  /** Creates a prefixed sub-logger channel */
  channel(prefix: string): ChannelLogger
  /** Sets a context value for message interpolation */
  setContextValue: (label: string, value: unknown) => void
}

/**
 * Converts camelCase to Title Case with spaces (e.g., "updateDependentVersions" → "Update Dependent Versions")
 *
 * @param camelCase - The camelCase string to convert
 * @returns The string formatted as Title Case with spaces
 */
const toTitleCase = (camelCase: string): string =>
  camelCase
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim()

let loggerInstance: ExecutorLogger

/**
 * Gets or creates the singleton executor logger instance.
 *
 * @returns The ExecutorLogger instance for version executor operations
 */
export const getLogger = () => {
  if (loggerInstance) return loggerInstance
  const context = createMap<string, unknown>()
  const msg = (message: string) => {
    from(context.entries()).forEach(([key, value]) => {
      message = message.replaceAll(`{${key}}`, String(value))
    })
    return message
  }
  const errorFn = (message: string) => baseLogger.error(msg(message))
  const warnFn = (message: string) => baseLogger.warn(msg(message))
  const logFn = (message: string) => baseLogger.log(msg(message))
  const infoFn = (message: string) => baseLogger.info(msg(message))
  const debugFn = (message: string) => baseLogger.debug(msg(message))
  const setLogLevel: ({ verbose, quiet }: Pick<VersionExecutorSchema, 'verbose' | 'quiet'>) => void = ({ verbose, quiet }) => {
    baseLogger.setLogLevel(quiet ? 'error' : verbose ? 'debug' : 'log')
    context.set('logLevel', baseLogger.getLogLevel())
  }
  setLogLevel({ verbose: false, quiet: false })

  const createChannelLogger = (prefix: string): ChannelLogger => {
    let hasEmittedHeader = false
    let stepNumber = 0
    const header = `[ ${toTitleCase(prefix)} ]`

    const ensureHeader = () => {
      if (!hasEmittedHeader) {
        baseLogger.log('')
        baseLogger.log(header)
        hasEmittedHeader = true
      }
    }

    return freeze({
      step: (message: string) => {
        ensureHeader()
        stepNumber++
        debugFn(`  ${stepNumber}. ${message}`)
      },
      item: (message: string) => {
        ensureHeader()
        debugFn(`     - ${message}`)
      },
      error: (message: string) => {
        ensureHeader()
        errorFn(`  ${message}`)
      },
      warn: (message: string) => {
        ensureHeader()
        warnFn(`  ${message}`)
      },
      info: (message: string) => {
        ensureHeader()
        infoFn(`  ${stepNumber + 1}. ${message}`)
      },
      debug: (message: string) => {
        ensureHeader()
        stepNumber++
        debugFn(`  ${stepNumber}. ${message}`)
      },
      log: (message: string) => {
        ensureHeader()
        logFn(`  ${message}`)
      },
      getLogLevel: baseLogger.getLogLevel,
    })
  }

  const createApi = () => {
    const api = <const>{
      error: errorFn,
      warn: warnFn,
      log: logFn,
      info: infoFn,
      debug: debugFn,
      setLogLevel,
      getLogLevel: baseLogger.getLogLevel,
      setContextValue: (label: string, value: unknown) => {
        context.set(label, value)
      },
      channel: createChannelLogger,
    }
    return freeze(api)
  }
  loggerInstance = <ExecutorLogger>createApi()
  return loggerInstance
}
