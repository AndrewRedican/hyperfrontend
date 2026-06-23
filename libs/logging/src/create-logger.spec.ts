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

  it('throws an error if error function is invalid', () => {
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

describe('logger.channel', () => {
  let error: jest.Mock
  let warn: jest.Mock
  let log: jest.Mock
  let info: jest.Mock
  let debug: jest.Mock

  beforeEach(() => {
    error = jest.fn()
    warn = jest.fn()
    log = jest.fn()
    info = jest.fn()
    debug = jest.fn()
  })

  it('prepends [prefix] to every log call', () => {
    const logger = createLogger(error, warn, log, info, debug)
    logger.setLogLevel('debug')
    const channel = logger.channel('build')
    channel.error('boom')
    channel.warn('careful')
    channel.log('note')
    channel.info('fyi')
    channel.debug('details')
    expect(error).toHaveBeenCalledWith('[build]', 'boom')
    expect(warn).toHaveBeenCalledWith('[build]', 'careful')
    expect(log).toHaveBeenCalledWith('[build]', 'note')
    expect(info).toHaveBeenCalledWith('[build]', 'fyi')
    expect(debug).toHaveBeenCalledWith('[build]', 'details')
  })

  it('chains nested channel prefixes with `:` separator', () => {
    const logger = createLogger(error)
    logger.setLogLevel('error')
    logger.channel('build').channel('rollup').error('boom')
    expect(error).toHaveBeenCalledWith('[build:rollup]', 'boom')
  })

  it('respects the parent log level', () => {
    const logger = createLogger(error, warn, log, info, debug)
    logger.setLogLevel('warn')
    const channel = logger.channel('build')
    channel.warn('shown')
    channel.log('hidden')
    expect(warn).toHaveBeenCalledWith('[build]', 'shown')
    expect(log).not.toHaveBeenCalled()
  })

  it('shares setLogLevel/getLogLevel with the root logger', () => {
    const logger = createLogger(error)
    const channel = logger.channel('build')
    channel.setLogLevel('debug')
    expect(logger.getLogLevel()).toBe('debug')
    expect(channel.getLogLevel()).toBe('debug')
  })

  it('forwards multiple arguments verbatim', () => {
    const logger = createLogger(error)
    logger.setLogLevel('error')
    logger.channel('rpc').error('msg', { code: 500 }, 42)
    expect(error).toHaveBeenCalledWith('[rpc]', 'msg', { code: 500 }, 42)
  })
})

describe('logger.timed', () => {
  let error: jest.Mock
  let debug: jest.Mock

  beforeEach(() => {
    error = jest.fn()
    debug = jest.fn()
  })

  it('returns the result of fn and logs completion at debug level', () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const result = logger.timed('compute', () => 42)
    expect(result).toBe(42)
    expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^compute completed in \d+ms$/))
  })

  it('logs failure at error level and rethrows when fn throws an Error', () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const failure = new Error('kaboom')
    expect(() =>
      logger.timed('compute', () => {
        throw failure
      })
    ).toThrow(failure)
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^compute failed after \d+ms: kaboom$/))
    expect(debug).not.toHaveBeenCalled()
  })

  it('stringifies non-Error throws in the failure message', () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    expect(() =>
      logger.timed('compute', () => {
        throw 'string-thrown'
      })
    ).toThrow()
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^compute failed after \d+ms: string-thrown$/))
  })

  it('emits the channel prefix when invoked through a channel', () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    logger.channel('build').timed('compute', () => 1)
    expect(debug).toHaveBeenCalledWith('[build]', expect.stringMatching(/^compute completed in \d+ms$/))
  })
})

describe('logger.timedAsync', () => {
  let error: jest.Mock
  let debug: jest.Mock

  beforeEach(() => {
    error = jest.fn()
    debug = jest.fn()
  })

  it('awaits and returns the resolved value, logging completion at debug level', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const result = await logger.timedAsync('compute', async () => 'ok')
    expect(result).toBe('ok')
    expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^compute completed in \d+ms$/))
  })

  it('logs failure at error level, dumps stack trace at debug level, and rethrows', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const failure = new Error('kaboom')
    await expect(
      logger.timedAsync('compute', async () => {
        throw failure
      })
    ).rejects.toBe(failure)
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^compute failed after \d+ms: kaboom$/))
    const stackCall = debug.mock.calls.find(([first]) => typeof first === 'string' && first.startsWith('Stack trace:'))
    expect(stackCall).toBeDefined()
  })

  it('skips the stack-trace dump when the rejection has no stack', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const failure = new Error('kaboom')
    failure.stack = undefined
    await expect(
      logger.timedAsync('compute', async () => {
        throw failure
      })
    ).rejects.toBe(failure)
    const stackCall = debug.mock.calls.find(([first]) => typeof first === 'string' && first.startsWith('Stack trace:'))
    expect(stackCall).toBeUndefined()
  })

  it('skips the stack-trace dump for non-Error rejections', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    await expect(
      logger.timedAsync('compute', async () => {
        throw 'string-thrown'
      })
    ).rejects.toBe('string-thrown')
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^compute failed after \d+ms: string-thrown$/))
    const stackCall = debug.mock.calls.find(([first]) => typeof first === 'string' && first.startsWith('Stack trace:'))
    expect(stackCall).toBeUndefined()
  })

  it('emits the channel prefix when invoked through a channel', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    await logger.channel('build').timedAsync('compute', async () => 1)
    expect(debug).toHaveBeenCalledWith('[build]', expect.stringMatching(/^compute completed in \d+ms$/))
  })
})
