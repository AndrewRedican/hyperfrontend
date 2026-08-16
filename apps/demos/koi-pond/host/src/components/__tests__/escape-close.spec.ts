import type { FeatureUi } from '../../runtime/feature-ui'
import { describe, expect, it, vi } from 'vitest'
import { wireEscapeClose } from '../escape-close'

/** Builds a fake presentation state that records close requests. */
function fakeUi(): { ui: FeatureUi; requests: string[] } {
  const requests: string[] = []
  const ui: FeatureUi = {
    attach: () => undefined,
    getMode: () => 'embedded',
    subscribe: () => () => undefined,
    requestClose(source = 'button') {
      requests.push(source)
      return true
    },
    rearmClose: () => undefined,
  }
  return { ui, requests }
}

/** Presses a key on the window. */
function press(key: string): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

describe('wireEscapeClose', () => {
  it('turns Escape into a close-request', () => {
    const { ui, requests } = fakeUi()
    const dispose = wireEscapeClose(window, ui, () => false)
    press('Escape')
    dispose()
    expect(requests).toEqual(['escape'])
  })

  it('releases a held koi instead of closing', () => {
    const { ui, requests } = fakeUi()
    const releaseHeld = vi.fn<() => boolean>(() => true)
    const dispose = wireEscapeClose(window, ui, releaseHeld)
    press('Escape')
    dispose()
    expect({ released: releaseHeld.mock.calls.length, requests }).toEqual({ released: 1, requests: [] })
  })

  it('ignores every other key', () => {
    const { ui, requests } = fakeUi()
    const releaseHeld = vi.fn<() => boolean>(() => false)
    const dispose = wireEscapeClose(window, ui, releaseHeld)
    press('Enter')
    press('e')
    dispose()
    expect({ released: releaseHeld.mock.calls.length, requests }).toEqual({ released: 0, requests: [] })
  })

  it('hears nothing after disposal', () => {
    const { ui, requests } = fakeUi()
    wireEscapeClose(window, ui, () => false)()
    press('Escape')
    expect(requests).toEqual([])
  })
})
