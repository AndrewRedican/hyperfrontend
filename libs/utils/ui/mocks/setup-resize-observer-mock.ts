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
 *
 * @example Mocking ResizeObserver in tests
 * ```typescript
 * const mock = setupResizeObserverMock()
 *
 * // Component under test uses ResizeObserver
 * const element = document.createElement('div')
 * const observer = new ResizeObserver(() => {})
 * observer.observe(element)
 *
 * expect(mock.observe).toHaveBeenCalledWith(element)
 *
 * // Simulate a resize event
 * mock.callback([{ contentRect: { width: 100, height: 50 } }], observer)
 * ```
 */
export function setupResizeObserverMock() {
  const mockDisconnect = jest.fn()
  const mock = {} as ResizeObserverMock
  mock.observe = jest.fn()
  mock.unobserve = jest.fn()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).ResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
    mock.callback = callback
    return {
      observe: mock.observe,
      unobserve: mock.unobserve,
      disconnect: mockDisconnect,
    }
  })

  return mock
}
