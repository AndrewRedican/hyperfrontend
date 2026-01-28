export type LogLevel = 'none' | 'error' | 'warn' | 'log' | 'info' | 'debug'

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

export function isValidLogLevel(level: LogLevel) {
  return logLevels.includes(level)
}

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
  return Object.freeze({
    getLogLevel,
    setLogLevel,
    shouldLog,
  })
}
