import { setupResizeObserverMock } from '../../mocks/setup-resize-observer-mock'
import { syncElementDimensions } from './sync-element-dimensions'

describe('syncElementDimensions', () => {
  let sourceElement: HTMLElement
  let targetElement: HTMLElement
  let resizeObserverMock: ReturnType<typeof setupResizeObserverMock>

  beforeEach(() => {
    resizeObserverMock = setupResizeObserverMock()

    sourceElement = document.createElement('div')
    targetElement = document.createElement('div')
    document.body.appendChild(sourceElement)
    document.body.appendChild(targetElement)

    Object.defineProperty(sourceElement, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        width: 200,
        height: 100,
        top: 10,
        left: 20,
        bottom: 110,
        right: 220,
        x: 20,
        y: 10,
        toJSON: () => ({}),
      })),
      writable: true,
      configurable: true,
    })

    sourceElement.style.position = 'absolute'
  })

  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
  })

  it('syncs dimensions from source to target element', () => {
    const cleanup = syncElementDimensions(sourceElement, targetElement)

    jest.advanceTimersByTime(0)
    jest.runAllTimers()

    expect(targetElement.style.width).toBe('200px')
    expect(targetElement.style.height).toBe('100px')
    expect(targetElement.style.top).toBe('10px')
    expect(targetElement.style.left).toBe('20px')
    expect(targetElement.style.position).toBe('absolute')

    cleanup()
  })

  it('syncs dimensions when source element resizes', () => {
    const cleanup = syncElementDimensions(sourceElement, targetElement)

    jest.runAllTimers()

    Object.defineProperty(sourceElement, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        width: 300,
        height: 150,
        top: 15,
        left: 25,
        bottom: 165,
        right: 325,
        x: 25,
        y: 15,
        toJSON: () => ({}),
      })),
      writable: true,
      configurable: true,
    })

    resizeObserverMock.callback(
      [
        {
          target: sourceElement,
          contentRect: <DOMRectReadOnly>{},
          borderBoxSize: <ResizeObserverSize[]>(<unknown>[]),
          contentBoxSize: <ResizeObserverSize[]>(<unknown>[]),
          devicePixelContentBoxSize: <ResizeObserverSize[]>(<unknown>[]),
        },
      ],
      <ResizeObserver>{}
    )

    expect(targetElement.style.width).toBe('300px')
    expect(targetElement.style.height).toBe('150px')
    expect(targetElement.style.top).toBe('15px')
    expect(targetElement.style.left).toBe('25px')

    cleanup()
  })

  it('works with selector strings', () => {
    sourceElement.id = 'source'
    targetElement.id = 'target'

    const cleanup = syncElementDimensions('#source', '#target')

    jest.runAllTimers()

    expect(targetElement.style.width).toBe('200px')
    expect(targetElement.style.height).toBe('100px')

    cleanup()
  })

  it('calls onFail when source element not found', () => {
    const onFail = jest.fn()

    const cleanup = syncElementDimensions('#nonexistent', targetElement, { onFail })

    jest.advanceTimersByTime(10001)

    expect(onFail).toHaveBeenCalled()
    cleanup()
  })

  it('calls onFail when target element not found', () => {
    const onFail = jest.fn()

    const cleanup = syncElementDimensions(sourceElement, '#nonexistent', { onFail })

    jest.advanceTimersByTime(100)
    jest.advanceTimersByTime(10001)

    expect(onFail).toHaveBeenCalled()
    cleanup()
  })

  it('cleans up on returned function call', () => {
    const cleanup = syncElementDimensions(sourceElement, targetElement)

    jest.runAllTimers()

    cleanup()

    Object.defineProperty(sourceElement, 'getBoundingClientRect', {
      value: jest.fn(() => ({
        width: 500,
        height: 500,
        top: 50,
        left: 50,
        bottom: 550,
        right: 550,
        x: 50,
        y: 50,
        toJSON: () => ({}),
      })),
      writable: true,
      configurable: true,
    })

    const initialWidth = targetElement.style.width

    if (resizeObserverMock.callback) {
      resizeObserverMock.callback(
        [
          {
            target: sourceElement,
            contentRect: <DOMRectReadOnly>{},
            borderBoxSize: <ResizeObserverSize[]>(<unknown>[]),
            contentBoxSize: <ResizeObserverSize[]>(<unknown>[]),
            devicePixelContentBoxSize: <ResizeObserverSize[]>(<unknown>[]),
          },
        ],
        <ResizeObserver>{}
      )
    }

    expect(targetElement.style.width).toBe(initialWidth)
  })

  it('cancels source element search on cleanup before target found', () => {
    sourceElement.id = 'source-delayed'
    targetElement.id = 'target'

    const cleanup = syncElementDimensions('#source-delayed', '#target')

    jest.advanceTimersByTime(50)

    cleanup()

    document.getElementById('source-delayed')?.remove()
    document.body.appendChild(sourceElement)

    jest.advanceTimersByTime(100)

    expect(targetElement.style.width).not.toBe('200px')
  })

  it('cancels target element search on cleanup after source found', () => {
    sourceElement.id = 'source'

    const cleanup = syncElementDimensions('#source', '#target-delayed')

    jest.advanceTimersByTime(100)

    cleanup()

    targetElement.id = 'target-delayed'
    document.body.appendChild(targetElement)

    jest.advanceTimersByTime(100)

    expect(targetElement.style.width).not.toBe('200px')
  })
})
