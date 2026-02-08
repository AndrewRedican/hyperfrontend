import type { ErrorLevelFn, WarnLevelFn, LogLevelFn, InfoLevelFn, DebugLevelFn } from './create-logger'
import { getType } from '@hyperfrontend/data-utils'
import { noop } from '@hyperfrontend/function-utils'
import { createLogger } from './create-logger'

describe('createLogger', () => {
  let error: jest.Mock<ErrorLevelFn>
  let warn: jest.Mock<WarnLevelFn>
  let log: jest.Mock<LogLevelFn>
  let info: jest.Mock<InfoLevelFn>
  let debug: jest.Mock<DebugLevelFn>

  beforeEach(() => {
    error = jest.fn()
    warn = jest.fn()
    log = jest.fn()
    info = jest.fn()
    debug = jest.fn()
  })

  it('creates a logger with valid functions', () => {
    const logger = createLogger(error, warn, log, info, debug)
    expect(logger).toBeDefined()
    expect(getType(logger.error)).toBe('function')
  })

  it('should throw an error if error function is invalid', () => {
    const empty = <() => undefined>(<unknown>null)
    expect(() => createLogger(empty)).toThrow()
    expect(() => createLogger(console.error, empty)).toThrow()
    expect(() => createLogger(console.error, console.warn, empty)).toThrow()
    expect(() => createLogger(console.error, console.warn, console.log, empty)).toThrow()
    expect(() => createLogger(console.error, console.warn, console.log, console.info, empty)).toThrow()
  })

  it('updates and retrieves log level correctly', () => {
    const logger = createLogger(error, warn, log, info, debug)
    logger.setLogLevel('warn')
    expect(logger.getLogLevel()).toBe('warn')
  })
})

describe('logger', () => {
  const error = jest.fn()
  const warn = jest.fn()
  const log = jest.fn()
  const info = jest.fn()
  const debug = jest.fn()
  const logger = createLogger(error, warn, log, info, debug)
  logger.setLogLevel('log')

  it(`invokes the corresponding log function if log the level encompasses it`, () => {
    logger.error('1')
    logger.warn('2')
    logger.log('3')
    expect(error).toHaveBeenCalledWith('1')
    expect(warn).toHaveBeenCalledWith('2')
    expect(log).toHaveBeenCalledWith('3')
  })

  it(`does not invoke the log function if the log level does not encompass it`, () => {
    logger.info('4')
    logger.debug('5')
    expect(info).not.toHaveBeenCalled()
    expect(debug).not.toHaveBeenCalled()
  })

  it(`doesn't wrap a noop log function`, () => {
    const logger = createLogger(error, warn, log, info, noop)
    expect(logger.debug).toBe(noop)
  })
})
