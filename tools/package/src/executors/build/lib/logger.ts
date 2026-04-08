import type { Logger } from '@hyperfrontend/logging'
import { logger as nxLogger } from '@nx/devkit'
import {dateNow} from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createLogger } from '@hyperfrontend/logging'

export type { LogLevel, Logger } from '@hyperfrontend/logging'

/**
 * Extended logger interface for build operations with timing support.
 */
interface BuildLogger extends Omit<Logger, 'setLogLevel'> {
  /** Sets log level based on verbose flag */
  setLogLevel: (verbose: boolean) => void
  /** Creates a prefixed sub-logger channel */
  channel(prefix: string): Omit<BuildLogger, 'channel'>
  /**
   * Logs execution time for an operation.
   * Returns result of the operation.
   */
  timed<T>(label: string, fn: () => T): T
  /** Logs execution time for an async operation */
  timedAsync<T>(label: string, fn: () => Promise<T>): Promise<T>
}

let loggerInstance: BuildLogger

/**
 * Gets or creates the singleton build logger instance.
 *
 * @returns The BuildLogger instance for build operations
 */
export const getLogger = () => {
  if (loggerInstance) return loggerInstance

  const errorFn = (message: string) => nxLogger.error(message)
  const warnFn = (message: string) => nxLogger.warn(message)
  const logFn = (message: string) => nxLogger.log(message)
  const infoFn = (message: string) => nxLogger.info(message)
  const debugFn = (message: string) => nxLogger.debug(message)

  const logger = createLogger(errorFn, warnFn, logFn, infoFn, debugFn)

  const setLogLevel = (verbose: boolean) => {
    logger.setLogLevel(verbose ? 'debug' : 'info')
  }

  const createApi = (prefix = ''): BuildLogger => {
    const prefixMsg = (message: string) => (prefix ? `[${prefix}] ${message}` : message)

    const api = {
      error: (message: string) => errorFn(prefixMsg(message)),
      warn: (message: string) => warnFn(prefixMsg(message)),
      log: (message: string) => logFn(prefixMsg(message)),
      info: (message: string) => infoFn(prefixMsg(message)),
      debug: (message: string) => debugFn(prefixMsg(message)),
      setLogLevel,
      getLogLevel: logger.getLogLevel,
      channel: (channelPrefix: string) => createApi(prefix ? `${prefix}:${channelPrefix}` : channelPrefix),
      timed<T>(label: string, fn: () => T): T {
        const start = dateNow()
        try {
          const result = fn()
          const elapsed = dateNow() - start
          debugFn(prefixMsg(`${label} completed in ${elapsed}ms`))
          return result
        } catch (error) {
          const elapsed = dateNow() - start
          errorFn(prefixMsg(`${label} failed after ${elapsed}ms: ${error instanceof Error ? error.message : String(error)}`))
          throw error
        }
      },
      async timedAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
        const start = dateNow()
        try {
          const result = await fn()
          const elapsed = dateNow() - start
          debugFn(prefixMsg(`${label} completed in ${elapsed}ms`))
          return result
        } catch (error) {
          const elapsed = dateNow() - start
          errorFn(prefixMsg(`${label} failed after ${elapsed}ms: ${error instanceof Error ? error.message : String(error)}`))
          if (error instanceof Error && error.stack) {
            debugFn(prefixMsg(`Stack trace:\n${error.stack}`))
          }
          throw error
        }
      },
    }

    return <BuildLogger>freeze(api)
  }

  loggerInstance = createApi()
  return loggerInstance
}
