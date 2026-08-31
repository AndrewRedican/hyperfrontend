import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { clearAllMocks, createMockFn, resetAllMocks } from './mock-fn'
import { isMockFunction } from './types'

describe('createMockFn call recording', () => {
  it('marks the result as a mock', () => {
    assert.equal(isMockFunction(createMockFn()), true)
  })

  it('does not mark a plain function as a mock', () => {
    assert.equal(
      isMockFunction(() => undefined),
      false
    )
  })

  it('records the arguments of every call', () => {
    const mock = createMockFn()
    mock('a')
    mock('b', 1)
    assert.deepEqual(mock.mock.calls, [['a'], ['b', 1]])
  })

  it('records the most recent call', () => {
    const mock = createMockFn()
    mock('a')
    mock('b')
    assert.deepEqual(mock.mock.lastCall, ['b'])
  })

  it('leaves lastCall undefined before any call', () => {
    assert.equal(createMockFn().mock.lastCall, undefined)
  })

  it('records the returned value', () => {
    const mock = createMockFn(() => 7)
    mock()
    assert.deepEqual(mock.mock.results, [{ type: 'return', value: 7 }])
  })

  it('records a thrown error without swallowing it', () => {
    const failure = new Error('boom')
    const mock = createMockFn(() => {
      throw failure
    })
    assert.throws(() => mock())
    assert.deepEqual(mock.mock.results, [{ type: 'throw', value: failure }])
  })

  it('records the receiver of each call', () => {
    const mock = createMockFn()
    const host = { mock }
    host.mock()
    assert.equal(mock.mock.instances[0], host)
  })

  it('numbers calls across separate mocks so ordering can be asserted', () => {
    const first = createMockFn()
    const second = createMockFn()
    first()
    second()
    assert.equal((first.mock.invocationCallOrder[0] ?? 0) < (second.mock.invocationCallOrder[0] ?? 0), true)
  })

  it('returns undefined when no implementation is set', () => {
    assert.equal(createMockFn()(), undefined)
  })
})

describe('createMockFn behaviour control', () => {
  it('returns the configured value', () => {
    assert.equal(createMockFn().mockReturnValue(3)(), 3)
  })

  it('returns the once-value before the standing value', () => {
    const mock = createMockFn().mockReturnValue('standing').mockReturnValueOnce('once')
    assert.deepEqual([mock(), mock()], ['once', 'standing'])
  })

  it('consumes queued once-values in order', () => {
    const mock = createMockFn().mockReturnValueOnce(1).mockReturnValueOnce(2)
    assert.deepEqual([mock(), mock()], [1, 2])
  })

  it('runs the configured implementation', () => {
    assert.equal(createMockFn().mockImplementation((value: number) => value * 2)(4), 8)
  })

  it('runs a once-implementation before the standing one', () => {
    const mock = createMockFn()
      .mockImplementation(() => 'standing')
      .mockImplementationOnce(() => 'once')
    assert.deepEqual([mock(), mock()], ['once', 'standing'])
  })

  it('resolves the configured value', async () => {
    assert.equal(await createMockFn().mockResolvedValue('done')(), 'done')
  })

  it('resolves a once-value', async () => {
    assert.equal(await createMockFn().mockResolvedValueOnce('once')(), 'once')
  })

  it('rejects with the configured reason', async () => {
    await assert.rejects(() => createMockFn().mockRejectedValue(new Error('boom'))() as Promise<unknown>)
  })

  it('rejects once with the configured reason', async () => {
    await assert.rejects(() => createMockFn().mockRejectedValueOnce(new Error('boom'))() as Promise<unknown>)
  })

  it('returns the receiver when configured to', () => {
    const mock = createMockFn().mockReturnThis()
    const host = { mock }
    assert.equal(host.mock(), host)
  })

  it('reports the default name', () => {
    assert.equal(createMockFn().getMockName(), 'jest.fn()')
  })

  it('reports a configured name', () => {
    assert.equal(createMockFn().mockName('loader').getMockName(), 'loader')
  })
})

describe('createMockFn resetting', () => {
  it('clears recorded calls', () => {
    const mock = createMockFn()
    mock()
    mock.mockClear()
    assert.deepEqual(mock.mock.calls, [])
  })

  it('keeps the implementation through a clear', () => {
    const mock = createMockFn().mockReturnValue(5)
    mock.mockClear()
    assert.equal(mock(), 5)
  })

  it('drops the implementation on a reset', () => {
    const mock = createMockFn().mockReturnValue(5)
    mock.mockReset()
    assert.equal(mock(), undefined)
  })

  it('drops queued once-values on a reset', () => {
    const mock = createMockFn().mockReturnValueOnce(1)
    mock.mockReset()
    assert.equal(mock(), undefined)
  })

  it('behaves like a reset when restoring a mock with no original', () => {
    const mock = createMockFn().mockReturnValue(5)
    mock.mockRestore()
    assert.equal(mock(), undefined)
  })

  it('clears every tracked mock at once', () => {
    const mock = createMockFn()
    mock()
    clearAllMocks()
    assert.deepEqual(mock.mock.calls, [])
  })

  it('resets every tracked mock at once', () => {
    const mock = createMockFn().mockReturnValue(9)
    resetAllMocks()
    assert.equal(mock(), undefined)
  })
})
