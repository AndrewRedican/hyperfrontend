import { ControlType } from '../shared/control'
import { applyBodyReset, createSizeAnnouncer } from './sizing'

let resizeCallback: ((entries: Array<{ contentRect: object }>) => void) | undefined

class ResizeObserverStub {
  constructor(callback: (entries: Array<{ contentRect: object }>) => void) {
    resizeCallback = callback
  }
  observe() {
    return undefined
  }
  unobserve() {
    return undefined
  }
  disconnect() {
    return undefined
  }
}

beforeEach(() => {
  resizeCallback = undefined
  Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverStub, configurable: true, writable: true })
})

describe('applyBodyReset', () => {
  afterEach(() => {
    document.head.innerHTML = ''
  })

  it('injects a body reset stylesheet', () => {
    applyBodyReset()
    expect(document.head.querySelector('style')?.textContent).toContain('margin:0')
  })
})

describe('createSizeAnnouncer', () => {
  it('announces the current size on start', () => {
    const send = jest.fn()
    createSizeAnnouncer(send).start()
    expect(send).toHaveBeenCalledWith(ControlType.Size, expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }))
  })

  it('re-announces when the body resizes', () => {
    const send = jest.fn()
    createSizeAnnouncer(send).start()
    resizeCallback?.([{ contentRect: {} }])
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('does not start watching twice', () => {
    const send = jest.fn()
    const announcer = createSizeAnnouncer(send)
    announcer.start()
    announcer.start()
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('stops announcing after stop', () => {
    const send = jest.fn()
    const announcer = createSizeAnnouncer(send)
    announcer.start()
    announcer.stop()
    resizeCallback?.([{ contentRect: {} }])
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('is a no-op to stop before start', () => {
    expect(() => createSizeAnnouncer(jest.fn()).stop()).not.toThrow()
  })
})
