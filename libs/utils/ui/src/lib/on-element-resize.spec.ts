import type { ResizeObserverMock } from '../../mocks/setup-resize-observer-mock'
import { before as beforeAll } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { setupResizeObserverMock } from '../../mocks/setup-resize-observer-mock'
import { onElementResize } from './on-element-resize'

describe('onElementResize', () => {
  let mock: ResizeObserverMock

  beforeAll(() => {
    mock = setupResizeObserverMock()
  })

  it('triggers the callback with the correct arguments when the element is resized', () => {
    const element = document.createElement('div')
    const callback = jest.fn()

    const unsubscribeResize = onElementResize(element, callback)

    const contentRect: DOMRectReadOnly = {
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      top: 0,
      bottom: 100,
      left: 0,
      right: 200,
      toJSON: () => ({}),
    }

    const entry = { contentRect, target: element }
    mock.callback([entry] as unknown as ResizeObserverEntry[], {} as ResizeObserver)

    expect(callback).toHaveBeenCalledWith(contentRect)
    expect(mock.observe).toHaveBeenCalledWith(element)
    unsubscribeResize()
  })

  it('stops observing the element when the unsubscribe function is called', () => {
    const element = document.createElement('div')
    const callback = jest.fn()

    const unsubscribeResize = onElementResize(element, callback)

    unsubscribeResize()

    const contentRect: DOMRectReadOnly = {
      x: 0,
      y: 0,
      width: 300,
      height: 150,
      top: 0,
      bottom: 150,
      left: 0,
      right: 300,
      toJSON: () => ({}),
    }

    const entry = { contentRect, target: element }
    mock.callback([entry] as unknown as ResizeObserverEntry[], {} as ResizeObserver)

    expect(callback).not.toHaveBeenCalled()
    expect(mock.unobserve).toHaveBeenCalledWith(element)
  })
})
