import type { LogLevel, SetLogLevel, GetLogLevel } from './create-log-level-config'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Log = (...data: any[]) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Warn = (...data: any[]) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Error = (...data: any[]) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Info = (...data: any[]) => void

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Debug = (...data: any[]) => void

export interface Logger {
  log: Log
  warn: Warn
  error: Error
  info: Info
  debug: Debug
  setLogLevel: SetLogLevel
  getLogLevel: GetLogLevel
}

export type LogFnName = Exclude<keyof Logger, 'setLevel' | 'getLevel'>

export type LogFunction = Logger[LogFnName]

import { getType } from '@hyperfrontend/data-utils'
import { noop, createConditionalExecutionFunction, createErrorIgnoringFunction } from '@hyperfrontend/function-utils'
import { createLogLevelConfig } from './create-log-level-config'

export function createLogger(error: Error, warn: Warn = noop, log: Log = noop, info: Info = noop, debug: Debug = noop): Logger {
  if (notValidLogFn(error)) {
    throw new Error(notFnMsg('error'))
  }
  if (notValidLogFn(warn)) {
    throw new Error(notFnMsg('warn'))
  }
  if (notValidLogFn(log)) {
    throw new Error(notFnMsg('log'))
  }
  if (notValidLogFn(info)) {
    throw new Error(notFnMsg('info'))
  }
  if (notValidLogFn(debug)) {
    throw new Error(notFnMsg('debug'))
  }
  const { setLogLevel, getLogLevel, shouldLog } = createLogLevelConfig()
  const wrapLogFn = (fn: LogFunction, level: LogLevel): LogFunction => {
    if (fn === noop) return fn
    const condition = () => shouldLog(level)
    return createConditionalExecutionFunction(createErrorIgnoringFunction(fn), condition)
  }
  return Object.freeze({
    error: wrapLogFn(error, 'error'),
    warn: wrapLogFn(warn, 'warn'),
    log: wrapLogFn(log, 'log'),
    info: wrapLogFn(info, 'info'),
    debug: wrapLogFn(debug, 'debug'),
    setLogLevel,
    getLogLevel,
  })
}

function notValidLogFn(fn: unknown): boolean {
  return getType(fn) !== 'function' && fn !== noop
}

function notFnMsg(label: LogFnName): string {
  return `Cannot create a logger when ${label} is not a function`
}
