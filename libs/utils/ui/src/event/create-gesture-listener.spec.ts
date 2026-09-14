import type { Mock } from '@hyperfrontend/testing'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createGestureListener } from './create-gesture-listener'

describe('createGestureListener', () => {
  let callback: Mock

  beforeEach(() => {
    callback = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('creates gesture listener and returns cleanup function', () => {
    const cleanup = createGestureListener(callback)
    expect(typeof cleanup).toBe('function')
    cleanup()
  })

  it('triggers callback on Escape key press', () => {
    const cleanup = createGestureListener(callback)

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(event)

    expect(callback).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('does not trigger callback on other key press', () => {
    const cleanup = createGestureListener(callback)

    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    document.dispatchEvent(event)

    expect(callback).not.toHaveBeenCalled()
    cleanup()
  })

  it('triggers callback on pinch zoom gesture', () => {
    const cleanup = createGestureListener(callback)

    const touch1 = { clientX: 100, clientY: 100 }
    const touch2 = { clientX: 200, clientY: 200 }

    const touchStartEvent = new TouchEvent('touchstart', {
      touches: [touch1, touch2] as unknown as Touch[],
    })
    document.dispatchEvent(touchStartEvent)

    const touch1Move = { clientX: 50, clientY: 50 }
    const touch2Move = { clientX: 250, clientY: 250 }

    const touchMoveEvent = new TouchEvent('touchmove', {
      touches: [touch1Move, touch2Move] as unknown as Touch[],
    })
    document.dispatchEvent(touchMoveEvent)

    expect(callback).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('does not trigger callback on pinch in gesture', () => {
    const cleanup = createGestureListener(callback)

    const touch1 = { clientX: 50, clientY: 50 }
    const touch2 = { clientX: 250, clientY: 250 }

    const touchStartEvent = new TouchEvent('touchstart', {
      touches: [touch1, touch2] as unknown as Touch[],
    })
    document.dispatchEvent(touchStartEvent)

    const touch1Move = { clientX: 100, clientY: 100 }
    const touch2Move = { clientX: 200, clientY: 200 }

    const touchMoveEvent = new TouchEvent('touchmove', {
      touches: [touch1Move, touch2Move] as unknown as Touch[],
    })
    document.dispatchEvent(touchMoveEvent)

    expect(callback).not.toHaveBeenCalled()
    cleanup()
  })

  it('resets initial distance on touch end', () => {
    const cleanup = createGestureListener(callback)

    const touch1 = { clientX: 100, clientY: 100 }
    const touch2 = { clientX: 200, clientY: 200 }

    const touchStartEvent = new TouchEvent('touchstart', {
      touches: [touch1, touch2] as unknown as Touch[],
    })
    document.dispatchEvent(touchStartEvent)

    const touchEndEvent = new TouchEvent('touchend', {
      touches: [] as unknown as Touch[],
    })
    document.dispatchEvent(touchEndEvent)

    const touch1Move = { clientX: 50, clientY: 50 }
    const touch2Move = { clientX: 250, clientY: 250 }

    const touchMoveEvent = new TouchEvent('touchmove', {
      touches: [touch1Move, touch2Move] as unknown as Touch[],
    })
    document.dispatchEvent(touchMoveEvent)

    expect(callback).not.toHaveBeenCalled()
    cleanup()
  })

  it('does not process touch move with less than 2 touches', () => {
    const cleanup = createGestureListener(callback)

    const touch1 = { clientX: 100, clientY: 100 }

    const touchMoveEvent = new TouchEvent('touchmove', {
      touches: [touch1] as unknown as Touch[],
    })
    document.dispatchEvent(touchMoveEvent)

    expect(callback).not.toHaveBeenCalled()
    cleanup()
  })

  it('removes event listeners on cleanup', () => {
    const cleanup = createGestureListener(callback)
    cleanup()

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(event)

    expect(callback).not.toHaveBeenCalled()
  })

  it('does not trigger callback twice after reset', () => {
    const cleanup = createGestureListener(callback)

    const touch1 = { clientX: 100, clientY: 100 }
    const touch2 = { clientX: 200, clientY: 200 }

    const touchStartEvent = new TouchEvent('touchstart', {
      touches: [touch1, touch2] as unknown as Touch[],
    })
    document.dispatchEvent(touchStartEvent)

    const touch1Move = { clientX: 50, clientY: 50 }
    const touch2Move = { clientX: 250, clientY: 250 }

    const touchMoveEvent = new TouchEvent('touchmove', {
      touches: [touch1Move, touch2Move] as unknown as Touch[],
    })
    document.dispatchEvent(touchMoveEvent)

    const touchMoveEvent2 = new TouchEvent('touchmove', {
      touches: [touch1Move, touch2Move] as unknown as Touch[],
    })
    document.dispatchEvent(touchMoveEvent2)

    expect(callback).toHaveBeenCalledTimes(1)
    cleanup()
  })
})
