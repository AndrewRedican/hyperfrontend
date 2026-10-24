import type { ResizeObserverController } from '@hyperfrontend/testing/browser'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { installResizeObserver } from '@hyperfrontend/testing/browser'
import { syncElementDimensions } from './sync-element-dimensions'

/**
 * Where the source element sits and how large it is, in pixels.
 */
type SourceRect = {
  /** Horizontal size. */
  width: number
  /** Vertical size. */
  height: number
  /** Distance of the top edge from the viewport's top. */
  top: number
  /** Distance of the left edge from the viewport's left. */
  left: number
}

describe('syncElementDimensions', () => {
  let sourceElement: HTMLElement
  let targetElement: HTMLElement
  let observers: ResizeObserverController

  /**
   * Makes the source element measure as the given rectangle.
   *
   * @param rect - Where the element sits and how large it is.
   */
  const measureSourceAs = (rect: SourceRect): void => {
    const { width, height, top, left } = rect
    jest.replaceProperty(
      sourceElement,
      'getBoundingClientRect',
      jest.fn(() => ({ width, height, top, left, bottom: top + height, right: left + width, x: left, y: top, toJSON: () => ({}) }))
    )
  }

  beforeEach(() => {
    observers = installResizeObserver()

    sourceElement = document.createElement('div')
    targetElement = document.createElement('div')
    document.body.appendChild(sourceElement)
    document.body.appendChild(targetElement)

    measureSourceAs({ width: 200, height: 100, top: 10, left: 20 })

    sourceElement.style.position = 'absolute'
  })

  afterEach(() => {
    document.body.innerHTML = ''
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it('syncs dimensions from source to target element', () => {
    const cleanup = syncElementDimensions(sourceElement, targetElement)

    jest.advanceTimersByTime(0)
    jest.runAllTimers()

    const { width, height, top, left, position } = targetElement.style
    expect({ width, height, top, left, position }).toEqual({
      width: '200px',
      height: '100px',
      top: '10px',
      left: '20px',
      position: 'absolute',
    })

    cleanup()
  })

  it('calls onSuccess once with the target element after the first sync', () => {
    const onSuccess = jest.fn()

    const cleanup = syncElementDimensions(sourceElement, targetElement, { onSuccess })

    jest.runAllTimers()

    expect({ onSuccessCalls: onSuccess.mock.calls, width: targetElement.style.width }).toEqual({
      onSuccessCalls: [[targetElement]],
      width: '200px',
    })

    cleanup()
  })

  it('does not call onSuccess when only the source element resolves', () => {
    const onSuccess = jest.fn()

    const cleanup = syncElementDimensions(sourceElement, '#nonexistent', { onSuccess })

    jest.advanceTimersByTime(10001)

    expect(onSuccess).not.toHaveBeenCalled()

    cleanup()
  })

  it('syncs dimensions when source element resizes', () => {
    const cleanup = syncElementDimensions(sourceElement, targetElement)

    jest.runAllTimers()

    measureSourceAs({ width: 300, height: 150, top: 15, left: 25 })

    observers.resize(sourceElement, { width: 300, height: 150 })

    const { width, height, top, left } = targetElement.style
    expect({ width, height, top, left }).toEqual({ width: '300px', height: '150px', top: '15px', left: '25px' })

    cleanup()
  })

  it('works with selector strings', () => {
    sourceElement.id = 'source'
    targetElement.id = 'target'

    const cleanup = syncElementDimensions('#source', '#target')

    jest.runAllTimers()

    const { width, height } = targetElement.style
    expect({ width, height }).toEqual({ width: '200px', height: '100px' })

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

    measureSourceAs({ width: 500, height: 500, top: 50, left: 50 })

    const initialWidth = targetElement.style.width

    observers.resizeLate(sourceElement, { width: 500, height: 500 })

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
