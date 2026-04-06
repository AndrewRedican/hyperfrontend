/**
 * Mock implementation of ResizeObserver for testing.
 */
export interface ResizeObserverMock {
  /** Mock observe function */
  observe: jest.Mock
  /** Mock unobserve function */
  unobserve: jest.Mock
  /** Captured callback from ResizeObserver constructor */
  callback: ResizeObserverCallback
}

/**
 * Sets up a Jest mock for the ResizeObserver API used in testing environments.
 * Creates mock implementations of observe, unobserve, and disconnect methods.
 *
 * @returns An object containing the mocked ResizeObserver and a disconnect function
 */
export function setupResizeObserverMock() {
  const mockDisconnect = jest.fn()
  const mock = <ResizeObserverMock>{}
  mock.observe = jest.fn()
  mock.unobserve = jest.fn()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(<any>globalThis).ResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
    mock.callback = callback
    return {
      observe: mock.observe,
      unobserve: mock.unobserve,
      disconnect: mockDisconnect,
    }
  })

  return mock
}
