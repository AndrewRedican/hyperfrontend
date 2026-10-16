import type { Mock } from '@hyperfrontend/testing'
import type { ErrorLevelFn, WarnLevelFn, LogLevelFn, InfoLevelFn, DebugLevelFn } from './create-logger'
import { beforeEach } from 'node:test'
import { noop } from '@hyperfrontend/function-utils'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createLogger } from './create-logger'

describe('createLogger', () => {
  let error: Mock<ErrorLevelFn>
  let warn: Mock<WarnLevelFn>
  let log: Mock<LogLevelFn>
  let info: Mock<InfoLevelFn>
  let debug: Mock<DebugLevelFn>

  beforeEach(() => {
    error = jest.fn()
    warn = jest.fn()
    log = jest.fn()
    info = jest.fn()
    debug = jest.fn()
  })

  it('creates a logger with valid functions', () => {
    const logger = createLogger(error, warn, log, info, debug)
    expect(logger).toEqual(expect.objectContaining({ error: expect.any(Function) }))
  })

  const empty = null as unknown as () => undefined

  it.each([
    ['error', [empty]],
    ['warn', [console.error, empty]],
    ['log', [console.error, console.warn, empty]],
    ['info', [console.error, console.warn, console.log, empty]],
    ['debug', [console.error, console.warn, console.log, console.info, empty]],
  ])('throws an error if the %s function is invalid', (name: string, args: Parameters<typeof createLogger>) => {
    expect(() => createLogger(...args)).toThrow(`Cannot create a logger when ${name} is not a function`)
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
    expect({ error: error.mock.calls, warn: warn.mock.calls, log: log.mock.calls }).toEqual({
      error: [['1']],
      warn: [['2']],
      log: [['3']],
    })
  })

  it(`does not invoke the log function if the log level does not encompass it`, () => {
    logger.info('4')
    logger.debug('5')
    expect({ info: info.mock.calls, debug: debug.mock.calls }).toEqual({ info: [], debug: [] })
  })

  it(`doesn't wrap a noop log function`, () => {
    const logger = createLogger(error, warn, log, info, noop)
    expect(logger.debug).toBe(noop)
  })
})

describe('logger.channel', () => {
  let error: Mock
  let warn: Mock
  let log: Mock
  let info: Mock
  let debug: Mock

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
    expect({
      error: error.mock.calls,
      warn: warn.mock.calls,
      log: log.mock.calls,
      info: info.mock.calls,
      debug: debug.mock.calls,
    }).toEqual({
      error: [['[build]', 'boom']],
      warn: [['[build]', 'careful']],
      log: [['[build]', 'note']],
      info: [['[build]', 'fyi']],
      debug: [['[build]', 'details']],
    })
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
    expect({ warn: warn.mock.calls, log: log.mock.calls }).toEqual({ warn: [['[build]', 'shown']], log: [] })
  })

  it('shares setLogLevel/getLogLevel with the root logger', () => {
    const logger = createLogger(error)
    const channel = logger.channel('build')
    channel.setLogLevel('debug')
    expect({ root: logger.getLogLevel(), channel: channel.getLogLevel() }).toEqual({ root: 'debug', channel: 'debug' })
  })

  it('forwards multiple arguments verbatim', () => {
    const logger = createLogger(error)
    logger.setLogLevel('error')
    logger.channel('rpc').error('msg', { code: 500 }, 42)
    expect(error).toHaveBeenCalledWith('[rpc]', 'msg', { code: 500 }, 42)
  })
})

describe('logger.timed', () => {
  let error: Mock
  let debug: Mock

  beforeEach(() => {
    error = jest.fn()
    debug = jest.fn()
  })

  it('returns the result of fn', () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const result = logger.timed('compute', () => 42)
    expect(result).toBe(42)
  })

  it('logs completion at debug level', () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    logger.timed('compute', () => 42)
    expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^compute completed in \d+ms$/))
  })

  it('rethrows when fn throws an Error', () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const failure = new Error('kaboom')
    expect(() =>
      logger.timed('compute', () => {
        throw failure
      })
    ).toThrow(failure)
  })

  it('logs failure at error level and no completion at debug level when fn throws an Error', () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const failure = new Error('kaboom')
    try {
      logger.timed('compute', () => {
        throw failure
      })
    } catch {
      // why: the rethrow is asserted in its own test; this one reads the logs written on the way out
    }
    expect({ error: error.mock.calls, debug: debug.mock.calls }).toEqual({
      error: [[expect.stringMatching(/^compute failed after \d+ms: kaboom$/)]],
      debug: [],
    })
  })

  it('rethrows a non-Error throw', () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    let thrown: unknown
    try {
      logger.timed('compute', () => {
        throw 'string-thrown'
      })
    } catch (caught) {
      thrown = caught
    }
    expect(thrown).toBe('string-thrown')
  })

  it('stringifies non-Error throws in the failure message', () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    try {
      logger.timed('compute', () => {
        throw 'string-thrown'
      })
    } catch {
      // why: the rethrow is asserted in its own test; this one reads the log written on the way out
    }
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
  let error: Mock
  let debug: Mock

  beforeEach(() => {
    error = jest.fn()
    debug = jest.fn()
  })

  it('awaits and returns the resolved value', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const result = await logger.timedAsync('compute', async () => 'ok')
    expect(result).toBe('ok')
  })

  it('logs completion at debug level when fn resolves', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    await logger.timedAsync('compute', async () => 'ok')
    expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^compute completed in \d+ms$/))
  })

  it('rethrows the rejection of fn', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const failure = new Error('kaboom')
    await expect(
      logger.timedAsync('compute', async () => {
        throw failure
      })
    ).rejects.toBe(failure)
  })

  it('logs failure at error level when fn rejects', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const failure = new Error('kaboom')
    // why: the rejection is asserted in its own test; this one reads the log written on the way out
    await logger
      .timedAsync('compute', async () => {
        throw failure
      })
      .catch(noop)
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^compute failed after \d+ms: kaboom$/))
  })

  it('dumps the stack trace at debug level when fn rejects', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const failure = new Error('kaboom')
    // why: the rejection is asserted in its own test; this one reads the log written on the way out
    await logger
      .timedAsync('compute', async () => {
        throw failure
      })
      .catch(noop)
    const stackCall = debug.mock.calls.find(([first]) => typeof first === 'string' && first.startsWith('Stack trace:'))
    expect(stackCall).toBeDefined()
  })

  it('rethrows a rejection that has no stack', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const failure = new Error('kaboom')
    failure.stack = undefined
    await expect(
      logger.timedAsync('compute', async () => {
        throw failure
      })
    ).rejects.toBe(failure)
  })

  it('skips the stack-trace dump when the rejection has no stack', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    const failure = new Error('kaboom')
    failure.stack = undefined
    // why: the rejection is asserted in its own test; this one reads the log written on the way out
    await logger
      .timedAsync('compute', async () => {
        throw failure
      })
      .catch(noop)
    const stackCall = debug.mock.calls.find(([first]) => typeof first === 'string' && first.startsWith('Stack trace:'))
    expect(stackCall).toBeUndefined()
  })

  it('rethrows a non-Error rejection', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    await expect(
      logger.timedAsync('compute', async () => {
        throw 'string-thrown'
      })
    ).rejects.toBe('string-thrown')
  })

  it('stringifies a non-Error rejection in the failure message', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    // why: the rejection is asserted in its own test; this one reads the log written on the way out
    await logger
      .timedAsync('compute', async () => {
        throw 'string-thrown'
      })
      .catch(noop)
    expect(error).toHaveBeenCalledWith(expect.stringMatching(/^compute failed after \d+ms: string-thrown$/))
  })

  it('skips the stack-trace dump for non-Error rejections', async () => {
    const logger = createLogger(error, jest.fn(), jest.fn(), jest.fn(), debug)
    logger.setLogLevel('debug')
    // why: the rejection is asserted in its own test; this one reads the log written on the way out
    await logger
      .timedAsync('compute', async () => {
        throw 'string-thrown'
      })
      .catch(noop)
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
