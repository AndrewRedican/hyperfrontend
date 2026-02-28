export type LogLevel = 'none' | 'error' | 'warn' | 'log' | 'info' | 'debug'

import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

export interface LogLevelState {
  level: LogLevel
}

export type SetLogLevel = (level: LogLevel) => void

export type GetLogLevel = () => LogLevel

export type ShouldLog = (level: LogLevel) => boolean

export interface LogLevelConfig {
  setLogLevel: SetLogLevel
  getLogLevel: GetLogLevel
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
 */
export function createLogLevelConfig(level: LogLevel = 'error'): LogLevelConfig {
  if (!isValidLogLevel(level)) {
    throw new Error('Cannot create log level configuration with a valid default log level')
  }
  const state: LogLevelState = { level }
  const getLogLevel: GetLogLevel = () => state.level
  const setLogLevel: SetLogLevel = (level) => {
    if (!isValidLogLevel(level)) {
      throw new Error(`Cannot set value '${level}' level. Expected levels are ${logLevels}.`)
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
