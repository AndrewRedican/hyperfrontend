import type { ResizeObserverController } from '@hyperfrontend/testing/browser'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { installResizeObserver } from '@hyperfrontend/testing/browser'
import { onElementResize } from './on-element-resize'

describe('onElementResize', () => {
  let observers: ResizeObserverController

  beforeEach(() => {
    observers = installResizeObserver()
  })

  afterEach(() => {
    observers.restore()
  })

  it('observes the given element', () => {
    const element = document.createElement('div')

    const unsubscribeResize = onElementResize(element, jest.fn())

    expect(observers.isObserved(element)).toBe(true)
    unsubscribeResize()
  })

  it('triggers the callback with the content rect when the element is resized', () => {
    const element = document.createElement('div')
    const callback = jest.fn()

    const unsubscribeResize = onElementResize(element, callback)
    observers.resize(element, { width: 200, height: 100 })

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ width: 200, height: 100, right: 200, bottom: 100 }))
    unsubscribeResize()
  })

  it('stops observing the element when the unsubscribe function is called', () => {
    const element = document.createElement('div')

    const unsubscribeResize = onElementResize(element, jest.fn())
    unsubscribeResize()

    expect(observers.isObserved(element)).toBe(false)
  })

  it('ignores a resize notification that arrives after the unsubscribe function is called', () => {
    const element = document.createElement('div')
    const callback = jest.fn()

    const unsubscribeResize = onElementResize(element, callback)
    unsubscribeResize()
    observers.resizeLate(element, { width: 300, height: 150 })

    expect(callback).not.toHaveBeenCalled()
  })
})
