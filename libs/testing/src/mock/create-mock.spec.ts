import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createMock } from './create-mock'
import { clearAllMocks } from './registry'
import { isMockFunction } from './types'

type Logger = {
  level: string
  warn(message: string): void
  getLevel(): string
}

type Client = {
  repo: {
    log(): string[]
  }
}

describe('createMock', () => {
  it('creates a mock for a member the test never declared', () => {
    assert.equal(isMockFunction(createMock<Logger>().warn), true)
  })

  it('records calls on a created member', () => {
    const logger = createMock<Logger>()
    logger.warn('retrying')
    assert.deepEqual(logger.warn.mock.calls, [['retrying']])
  })

  it('returns the same mock each time a member is read', () => {
    const logger = createMock<Logger>()
    assert.equal(logger.warn, logger.warn)
  })

  it('wraps a function override in a mock that calls it', () => {
    const logger = createMock<Logger>({ getLevel: () => 'debug' })
    logger.getLevel()
    assert.deepEqual(
      { isMock: isMockFunction(logger.getLevel), results: logger.getLevel.mock.results },
      {
        isMock: true,
        results: [{ type: 'return', value: 'debug' }],
      }
    )
  })

  it('keeps a mock override as given', () => {
    const warn = createMock<Logger>().warn
    assert.equal(createMock<Logger>({ warn }).warn, warn)
  })

  it('reads a value override as given', () => {
    assert.equal(createMock<Logger>({ level: 'info' }).level, 'info')
  })

  it('reads a member overridden with undefined as undefined', () => {
    assert.equal(createMock<Logger>({ level: undefined }).level, undefined)
  })

  it('keeps a getter override computing on every read', () => {
    let reads = 0
    const logger = createMock<Logger>({
      get level() {
        reads++
        return 'info'
      },
    })
    void logger.level
    void logger.level
    assert.equal(reads, 2)
  })

  it('creates nested members on demand', () => {
    const client = createMock<Client>()
    client.repo.log.mockReturnValue(['a1'])
    assert.deepEqual(client.repo.log(), ['a1'])
  })

  it('does not invent then, so awaiting it yields the object itself', async () => {
    const logger = createMock<Logger>()
    assert.equal(await logger, logger)
  })

  it('does not invent toJSON, so it serialises its own members', () => {
    assert.equal(JSON.stringify(createMock<Logger>({ level: 'info' })), '{"level":"info"}')
  })

  it('answers a symbol with undefined rather than a mock', () => {
    assert.equal((createMock<Logger>() as unknown as Record<symbol, unknown>)[Symbol.iterator], undefined)
  })

  it('keeps the members Object.prototype defines', () => {
    assert.equal(String(createMock<Logger>()), '[object Object]')
  })

  it('accepts an assigned member', () => {
    const logger = createMock<Logger>()
    logger.level = 'warn'
    assert.equal(logger.level, 'warn')
  })

  it('tracks created members for clearAllMocks', () => {
    const logger = createMock<Logger>()
    logger.warn('retrying')
    clearAllMocks()
    assert.deepEqual(logger.warn.mock.calls, [])
  })
})
