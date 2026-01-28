export interface ResizeObserverMock {
  observe: jest.Mock
  unobserve: jest.Mock
  callback: ResizeObserverCallback
}

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
