import { getElementAsync } from './get-element-async'

describe('getElementAsync', () => {
  const originalQuerySelector = document.querySelector
  const mockQuerySelector = jest.fn()

  beforeEach(() => {
    document.querySelector = mockQuerySelector
  })

  afterEach(() => {
    document.querySelector = originalQuerySelector
    mockQuerySelector.mockReset()
  })

  // eslint-disable-next-line jest/no-done-callback
  it('calls onSuccess with the element when the element is found', (done) => {
    const mockElement = document.createElement('div')
    mockQuerySelector.mockReturnValue(mockElement)

    getElementAsync('.my-element', {
      onSuccess: (element) => {
        expect(element).toBe(mockElement)
        done()
      },
      onFail: () => {
        done(new Error('onFail should not be called'))
      },
    })

    jest.runAllTimers()
  })

  it('calls onFail with null when the element is not found', () => {
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    mockQuerySelector.mockReturnValue(null)

    getElementAsync('.my-element', { onSuccess, onFail })

    jest.advanceTimersByTime(11000)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFail).toHaveBeenCalled()
  })

  // eslint-disable-next-line jest/no-done-callback
  it('uses default parameters when not provided', (done) => {
    const mockElement = document.createElement('div')
    mockQuerySelector.mockReturnValue(mockElement)

    getElementAsync('.my-element', {
      onSuccess: (element) => {
        expect(element).toBe(mockElement)
        done()
      },
    })

    jest.runAllTimers()
  })

  // eslint-disable-next-line jest/no-done-callback
  it('accepts an element reference instead of a query selector', (done) => {
    const mockElement = document.createElement('div')

    getElementAsync(mockElement, {
      onSuccess: (element) => {
        expect(element).toBe(mockElement)
        done()
      },
      onFail: () => {
        done(new Error('onFail should not be called'))
      },
    })

    jest.runAllTimers()
  })

  it('handles errors in querySelector', () => {
    const onSuccess = jest.fn()
    const onFail = jest.fn()
    mockQuerySelector.mockImplementation(() => {
      throw new Error('querySelector error')
    })

    getElementAsync('.my-element', { onSuccess, onFail })

    jest.advanceTimersByTime(11000)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFail).toHaveBeenCalled()
  })

  it('cancels the operation when cancel function is called', () => {
    expect.assertions(2)

    const mockElement = document.createElement('div')
    mockQuerySelector.mockReturnValue(mockElement)

    const onSuccess = jest.fn()
    const onFail = jest.fn()

    const cancel = getElementAsync('.my-element', {
      onSuccess,
      onFail,
    })

    cancel()
    jest.runAllTimers()

    jest.advanceTimersByTime(100)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFail).not.toHaveBeenCalled()
  })

  it('handles invocation with undefined callbacks', () => {
    const mockElement = document.createElement('div')
    mockQuerySelector.mockReturnValue(mockElement)

    const cancel = getElementAsync('.my-element', {})

    expect(() => {
      jest.runAllTimers()
      cancel()
    }).not.toThrow()
  })
})
