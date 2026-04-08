/** Valid log level values in order of verbosity */
export type LogLevel = 'none' | 'error' | 'warn' | 'log' | 'info' | 'debug'

import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Encapsulates the current log level state.
 */
export interface LogLevelState {
  /** The active log level */
  level: LogLevel
}

/** Function to update the log level */
export type SetLogLevel = (level: LogLevel) => void

/** Function to retrieve the current log level */
export type GetLogLevel = () => LogLevel

/** Predicate to determine if a message should be logged */
export type ShouldLog = (level: LogLevel) => boolean

/**
 * Configuration interface for managing log levels.
 */
export interface LogLevelConfig {
  /** Updates the log level */
  setLogLevel: SetLogLevel
  /** Retrieves the current log level */
  getLogLevel: GetLogLevel
  /** Checks if a given level should be logged */
  shouldLog: ShouldLog
}

const logLevels: LogLevel[] = ['none', 'error', 'warn', 'log', 'info', 'debug']

const priority = {
  error: 4,
  warn: 3,
  log: 2,
  info: 1,
  debug: 0,
}

/**
 * Validates whether a given string is a valid log level.
 *
 * @param level - The log level to validate
 * @returns True if the level is valid, false otherwise
 *
 * @example
 * ```typescript
 * isValidLogLevel('error') // => true
 * isValidLogLevel('verbose') // => false
 * ```
 */
export function isValidLogLevel(level: LogLevel) {
  return logLevels.includes(level)
}

/**
 * Creates a log level configuration manager for controlling logging behavior.
 * Provides methods to get, set, and evaluate log levels based on priority.
 *
 * @param level - The initial log level (defaults to 'error')
 * @returns A configuration object with log level management methods
 * @throws {Error} When the provided level is not a valid log level
 *
 * @example
 * ```typescript
 * const config = createLogLevelConfig('warn')
 * config.shouldLog('error') // => true (error >= warn)
 * config.shouldLog('debug') // => false (debug < warn)
 * config.setLogLevel('debug')
 * config.shouldLog('debug') // => true
 * ```
 */
export function createLogLevelConfig(level: LogLevel = 'error'): LogLevelConfig {
  if (!isValidLogLevel(level)) {
    throw createError('Cannot create log level configuration with a valid default log level')
  }
  const state: LogLevelState = { level }
  const getLogLevel: GetLogLevel = () => state.level
  const setLogLevel: SetLogLevel = (level) => {
    if (!isValidLogLevel(level)) {
      throw createError(`Cannot set value '${level}' level. Expected levels are ${logLevels}.`)
    }
    state.level = level
  }
  const shouldLog: ShouldLog = (level) => {
    if (state.level === 'none' || level === 'none' || !isValidLogLevel(level)) {
      return false
    }
    return priority[level] >= priority[state.level]
  }
  return freeze({
    getLogLevel,
    setLogLevel,
    shouldLog,
  })
}
