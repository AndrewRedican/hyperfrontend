import type { FeatureUiLink } from '../feature-ui'
import { describe, expect, it, vi } from 'vitest'
import { createFeatureUi } from '../feature-ui'

/** A fake feature handle capturing subscriptions and sends. */
function createLink() {
  const handlers = new Map<string, (data: unknown) => void>()
  const sends: Array<{ type: string; data: unknown }> = []
  const link: FeatureUiLink = {
    on(event, handler) {
      handlers.set(event, handler)
      return () => handlers.delete(event)
    },
    send(type, data) {
      sends.push({ type, data })
    },
  }
  const emit = (event: string, data: unknown) => {
    handlers.get(event)?.(data)
  }
  return { link, sends, emit }
}

/** Builds an attached feature-ui over a fake link. */
function createHarness() {
  const { link, sends, emit } = createLink()
  const ui = createFeatureUi()
  ui.attach(link)
  return { ui, sends, emit }
}

describe('display mode', () => {
  it('is null before any presentation', () => {
    const { ui } = createHarness()
    expect(ui.getMode()).toBeNull()
  })

  it('adopts the announced mode', () => {
    const { ui, emit } = createHarness()
    emit('presentation', { mode: 'dialog' })
    expect(ui.getMode()).toBe('dialog')
  })

  it('treats an unrecognized announcement as no presentation', () => {
    const { ui, emit } = createHarness()
    emit('presentation', { mode: 'billboard' })
    expect(ui.getMode()).toBeNull()
  })

  it('clears the mode when the session closes', () => {
    const { ui, emit } = createHarness()
    emit('presentation', { mode: 'dialog' })
    emit('close', undefined)
    expect(ui.getMode()).toBeNull()
  })

  it('notifies subscribers on change', () => {
    const { ui, emit } = createHarness()
    const listener = vi.fn<() => void>()
    ui.subscribe(listener)
    emit('presentation', { mode: 'embedded' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('an unsubscribed listener hears nothing further', () => {
    const { ui, emit } = createHarness()
    const listener = vi.fn<() => void>()
    ui.subscribe(listener)()
    emit('presentation', { mode: 'embedded' })
    expect(listener).not.toHaveBeenCalled()
  })
})

describe('close requests', () => {
  it('emits one close-request in dialog mode', () => {
    const { ui, emit, sends } = createHarness()
    emit('presentation', { mode: 'dialog' })
    ui.requestClose()
    expect(sends).toEqual([{ type: 'close-request', data: { source: 'button' } }])
  })

  it('latches duplicate requests within one presentation', () => {
    const { ui, emit, sends } = createHarness()
    emit('presentation', { mode: 'dialog' })
    const outcomes = [ui.requestClose(), ui.requestClose()]
    expect({ outcomes, sent: sends.length }).toEqual({ outcomes: [true, false], sent: 1 })
  })

  it('a fresh presentation re-arms the latch', () => {
    const { ui, emit, sends } = createHarness()
    emit('presentation', { mode: 'dialog' })
    ui.requestClose()
    emit('close', undefined)
    emit('presentation', { mode: 'dialog' })
    ui.requestClose()
    expect(sends).toHaveLength(2)
  })

  it('sends nothing outside dialog mode', () => {
    const { ui, emit, sends } = createHarness()
    emit('presentation', { mode: 'embedded' })
    const outcome = ui.requestClose()
    expect({ outcome, sent: sends.length }).toEqual({ outcome: false, sent: 0 })
  })

  it('sends nothing while unpresented', () => {
    const { ui, sends } = createHarness()
    const outcome = ui.requestClose()
    expect({ outcome, sent: sends.length }).toEqual({ outcome: false, sent: 0 })
  })
})
