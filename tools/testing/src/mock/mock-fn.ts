import type { MockFn, MockState } from './types'
import { MOCK_MARKER } from './types'

/**
 * Every mock created in this process, so `jest.clearAllMocks` and `jest.resetAllMocks`
 * can reach mocks the test never named.
 */
const created = new Set<MockFn>()

/**
 * A process-wide call counter backing `mock.invocationCallOrder`, which specs use to
 * assert that one mock ran before another.
 */
const ordering = { next: 0 }

/**
 * Registers a mock so the bulk reset helpers can find it.
 *
 * @param mock - The mock to track.
 */
export function trackMock(mock: MockFn): void {
  created.add(mock)
}

/**
 * Clears recorded calls on every mock created in this process.
 */
export function clearAllMocks(): void {
  for (const mock of created) mock.mockClear()
}

/**
 * Clears calls and drops implementations on every mock created in this process.
 */
export function resetAllMocks(): void {
  for (const mock of created) mock.mockReset()
}

/**
 * Creates an empty call-history record.
 *
 * @returns A fresh state object.
 */
function emptyState<TArgs extends unknown[], TReturn>(): MockState<TArgs, TReturn> {
  return { calls: [], results: [], instances: [], lastCall: undefined, invocationCallOrder: [] }
}

/**
 * Creates a mock function that records how it was called and can be told what to return.
 *
 * @param implementation - Optional behaviour invoked on each call.
 * @returns The mock, carrying Jest's configuration and inspection surface.
 */
export function createMockFn<TArgs extends unknown[] = any[], TReturn = any>(
  implementation?: (...args: TArgs) => TReturn
): MockFn<TArgs, TReturn> {
  const state = emptyState<TArgs, TReturn>()
  const queued: ((...args: TArgs) => TReturn)[] = []
  let current = implementation
  let label = 'jest.fn()'

  const mock = function (this: unknown, ...args: TArgs): TReturn {
    state.calls.push(args)
    state.lastCall = args
    state.instances.push(this)
    state.invocationCallOrder.push(++ordering.next)

    const behaviour = queued.length > 0 ? queued.shift() : current
    if (!behaviour) {
      state.results.push({ type: 'return', value: undefined })
      return undefined as TReturn
    }

    try {
      const value = behaviour.apply(this, args) as TReturn
      state.results.push({ type: 'return', value })
      return value
    } catch (error) {
      state.results.push({ type: 'throw', value: error })
      throw error
    }
  } as MockFn<TArgs, TReturn>

  Object.defineProperty(mock, MOCK_MARKER, { value: true })
  mock.mock = state

  mock.mockImplementation = (next) => {
    current = next
    return mock
  }
  mock.mockImplementationOnce = (next) => {
    queued.push(next)
    return mock
  }
  mock.mockReturnValue = (value) => mock.mockImplementation(() => value)
  mock.mockReturnValueOnce = (value) => mock.mockImplementationOnce(() => value)
  mock.mockResolvedValue = (value) => mock.mockImplementation(() => Promise.resolve(value) as TReturn)
  mock.mockResolvedValueOnce = (value) => mock.mockImplementationOnce(() => Promise.resolve(value) as TReturn)
  mock.mockRejectedValue = (reason) => mock.mockImplementation(() => Promise.reject(reason) as TReturn)
  mock.mockRejectedValueOnce = (reason) => mock.mockImplementationOnce(() => Promise.reject(reason) as TReturn)
  mock.mockReturnThis = () =>
    mock.mockImplementation(function (this: unknown) {
      return this as TReturn
    })

  mock.mockName = (name) => {
    label = name
    return mock
  }
  mock.getMockName = () => label

  mock.mockClear = () => {
    state.calls.length = 0
    state.results.length = 0
    state.instances.length = 0
    state.invocationCallOrder.length = 0
    state.lastCall = undefined
    return mock
  }
  mock.mockReset = () => {
    mock.mockClear()
    queued.length = 0
    current = undefined
    return mock
  }
  // why: a plain mock has no original to put back, so restoring is just a reset. `createSpy` overrides this.
  mock.mockRestore = () => mock.mockReset()

  trackMock(mock as MockFn)
  return mock
}
