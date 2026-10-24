import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { resolvePopupDefaults } from './defaults'

function setViewport(width: number, height: number) {
  jest.replaceProperty(window, 'innerWidth', width)
  jest.replaceProperty(window, 'innerHeight', height)
}

describe('resolvePopupDefaults', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('derives height from the viewport coverage', () => {
    setViewport(1200, 1000)
    expect(resolvePopupDefaults().height).toBe(600)
  })

  it('derives width from the aspect ratio', () => {
    setViewport(1200, 1000)
    expect(resolvePopupDefaults().width).toBe(578)
  })

  it('shrinks to honor the max viewport coverage on narrow viewports', () => {
    setViewport(300, 2000)
    expect(resolvePopupDefaults()).toEqual({ width: 270, height: 280 })
  })

  it('falls back to the fixed footprint when the viewport is unmeasurable', () => {
    setViewport(0, 0)
    expect(resolvePopupDefaults()).toEqual({ width: 530, height: 550 })
  })

  it('recomputes from the live viewport on each call', () => {
    setViewport(1200, 1000)
    const first = resolvePopupDefaults()
    setViewport(600, 500)
    expect(resolvePopupDefaults()).toEqual({ width: first.width / 2, height: first.height / 2 })
  })
})
