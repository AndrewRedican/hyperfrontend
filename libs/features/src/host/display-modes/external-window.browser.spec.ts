import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { openExternalWindow } from './external-window'

describe('openExternalWindow', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('opens the url in a blank window with the given features', () => {
    const open = jest.spyOn(window, 'open').mockReturnValue({ closed: false, close: jest.fn() } as unknown as Window)
    openExternalWindow('https://feature.example/', 'width=400')
    expect(open).toHaveBeenCalledWith('https://feature.example/', '_blank', 'width=400')
  })

  it('exposes the opened window as the target', () => {
    const opened = { closed: false, close: jest.fn() } as unknown as Window
    jest.spyOn(window, 'open').mockReturnValue(opened)
    expect(openExternalWindow('https://feature.example/').target).toBe(opened)
  })

  it('returns a null target when the browser blocks the window', () => {
    jest.spyOn(window, 'open').mockReturnValue(null)
    expect(openExternalWindow('https://feature.example/').target).toBeNull()
  })

  it('exposes no in-document element', () => {
    jest.spyOn(window, 'open').mockReturnValue({ closed: false, close: jest.fn() } as unknown as Window)
    expect(openExternalWindow('https://feature.example/').element).toBeUndefined()
  })

  it('closes a still-open window on cleanup', () => {
    const close = jest.fn()
    jest.spyOn(window, 'open').mockReturnValue({ closed: false, close } as unknown as Window)
    openExternalWindow('https://feature.example/').cleanup()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not re-close an already-closed window', () => {
    const close = jest.fn()
    jest.spyOn(window, 'open').mockReturnValue({ closed: true, close } as unknown as Window)
    openExternalWindow('https://feature.example/').cleanup()
    expect(close).not.toHaveBeenCalled()
  })

  it('does nothing on cleanup when the window was blocked', () => {
    jest.spyOn(window, 'open').mockReturnValue(null)
    expect(() => openExternalWindow('https://feature.example/').cleanup()).not.toThrow()
  })
})
