import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import { restoreAllMocks } from '../mock/registry'
import { installResizeObserver } from './resize-observer'

const PANEL = { id: 'panel' } as unknown as Element
const SIDEBAR = { id: 'sidebar' } as unknown as Element

describe('installResizeObserver', () => {
  afterEach(() => restoreAllMocks())

  it('reports a resize to an observer watching the element', () => {
    const observers = installResizeObserver()
    const seen: ResizeObserverEntry[][] = []
    new ResizeObserver((entries) => seen.push(entries)).observe(PANEL)
    observers.resize(PANEL, { width: 320, height: 200 })
    assert.deepEqual(
      seen.map(([entry]) => ({ target: entry?.target, width: entry?.contentRect.width, inline: entry?.contentBoxSize[0]?.inlineSize })),
      [{ target: PANEL, width: 320, inline: 320 }]
    )
  })

  it('fills in the full rectangle of the entry', () => {
    const observers = installResizeObserver()
    let rect: unknown
    new ResizeObserver(([entry]) => {
      const { x, y, top, left, right, bottom } = entry?.contentRect ?? {}
      rect = { x, y, top, left, right, bottom, json: entry?.contentRect.toJSON() }
    }).observe(PANEL)
    observers.resize(PANEL, { width: 320, height: 200 })
    assert.deepEqual(rect, { x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 200, json: { x: 0, y: 0, width: 320, height: 200 } })
  })

  it('hands the observer itself to the callback', () => {
    const observers = installResizeObserver()
    let handed: unknown
    const observer = new ResizeObserver((_entries, self) => {
      handed = self
    })
    observer.observe(PANEL)
    observers.resize(PANEL, { width: 1, height: 1 })
    assert.equal(handed, observer)
  })

  it('does not report a resize of an element nobody watches', () => {
    const observers = installResizeObserver()
    let calls = 0
    new ResizeObserver(() => calls++).observe(PANEL)
    observers.resize(SIDEBAR, { width: 1, height: 1 })
    assert.equal(calls, 0)
  })

  it('stops reporting an element once it is unobserved', () => {
    const observers = installResizeObserver()
    const observer = new ResizeObserver(() => undefined)
    observer.observe(PANEL)
    observer.unobserve(PANEL)
    assert.equal(observers.isObserved(PANEL), false)
  })

  it('delivers a late resize to an observer that has since disconnected', () => {
    const observers = installResizeObserver()
    let calls = 0
    const observer = new ResizeObserver(() => calls++)
    observer.observe(PANEL)
    observer.disconnect()
    observers.resize(PANEL, { width: 1, height: 1 })
    observers.resizeLate(PANEL, { width: 1, height: 1 })
    assert.equal(calls, 1)
  })

  it('delivers a late resize only to observers that once watched the element', () => {
    const observers = installResizeObserver()
    let calls = 0
    new ResizeObserver(() => calls++).observe(PANEL)
    observers.resizeLate(SIDEBAR, { width: 1, height: 1 })
    assert.equal(calls, 0)
  })

  it('reports an observed element as observed', () => {
    const observers = installResizeObserver()
    new ResizeObserver(() => undefined).observe(PANEL)
    assert.equal(observers.isObserved(PANEL), true)
  })

  it('retires an observer on disconnect', () => {
    const observers = installResizeObserver()
    const observer = new ResizeObserver(() => undefined)
    observer.observe(PANEL)
    observer.disconnect()
    assert.deepEqual({ count: observers.observerCount(), observed: observers.isObserved(PANEL) }, { count: 0, observed: false })
  })

  it('removes itself from the global on restore', () => {
    const before = (globalThis as Record<string, unknown>)['ResizeObserver']
    installResizeObserver().restore()
    assert.equal((globalThis as Record<string, unknown>)['ResizeObserver'], before)
  })

  it('removes itself from the global when restoreAllMocks runs', () => {
    installResizeObserver()
    restoreAllMocks()
    assert.equal(Object.hasOwn(globalThis, 'ResizeObserver'), false)
  })
})
