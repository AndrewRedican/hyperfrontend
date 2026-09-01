import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { observePageVisibility } from './visibility'

function setVisibilityState(value: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
}

describe('observePageVisibility', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('reports the current state immediately', () => {
    const onChange = jest.fn()
    const stop = observePageVisibility(onChange)
    expect(onChange).toHaveBeenCalledWith(false)
    stop()
  })

  it('reports hidden immediately when the page starts hidden', () => {
    setVisibilityState('hidden')
    const onChange = jest.fn()
    const stop = observePageVisibility(onChange)
    expect(onChange).toHaveBeenCalledWith(true)
    stop()
  })

  it('reports changes as the page hides and returns', () => {
    const onChange = jest.fn()
    const stop = observePageVisibility(onChange)
    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    setVisibilityState('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onChange.mock.calls.map(([hidden]) => hidden)).toEqual([false, true, false])
    stop()
  })

  it('stops reporting after teardown', () => {
    const onChange = jest.fn()
    const stop = observePageVisibility(onChange)
    stop()
    setVisibilityState('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
