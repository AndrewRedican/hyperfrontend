import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { PresentPayload, ViewportPayload } from '../shared/presentation'
import type { ShellOptions } from '../shared/types'
import type { ViewportReporter } from './sizing'
import type { MountContext, MountResult } from './types'
import { createEventEmitter } from '../shared/event-emitter'
import { createShellHandle } from './lifecycle'

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
  triggerMessage(type: string, data?: unknown): void
  send: jest.Mock
  disconnect: jest.Mock
  destroy: jest.Mock
  connect: jest.Mock
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const messageHandlers: Array<(message: { type: string; data?: unknown }) => void> = []
  const send = jest.fn()
  const disconnect = jest.fn()
  const destroy = jest.fn()
  const connect = jest.fn()
  const channel = <ChannelHandle>(<unknown>{
    on: (event: string, handler: (data?: unknown) => void) => {
      ;(listeners[event] ?? (listeners[event] = [])).push(handler)
      return () => undefined
    },
    onMessage: (handler: (message: { type: string; data?: unknown }) => void) => {
      messageHandlers.push(handler)
      return () => undefined
    },
    send,
    disconnect,
    destroy,
    connect,
  })
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    triggerMessage: (type, data) => messageHandlers.forEach((handler) => handler({ type, data })),
    send,
    disconnect,
    destroy,
    connect,
  }
}

const TARGET = <Window>(<unknown>{ name: 'target' })

function setup(
  config: {
    target?: Window | null
    settings?: Record<string, unknown>
    element?: HTMLElement
    present?: PresentPayload
    viewport?: ViewportReporter
    reveal?: jest.Mock
  } = {}
) {
  const mock = createMockChannel()
  const addChannel = jest.fn(() => mock.channel)
  const broker = <BrokerHandle>(<unknown>{ addChannel })
  const cleanup = jest.fn()
  let context: MountContext | undefined
  const present = config.present ?? { mode: 'embedded' }
  const mount = jest.fn((ctx: MountContext): MountResult => {
    context = ctx
    return {
      target: 'target' in config ? <Window | null>config.target : TARGET,
      element: config.element,
      present,
      viewport: config.viewport,
      reveal: config.reveal,
      cleanup,
    }
  })
  const selectMount = jest.fn(() => mount)
  const registerSecurity = jest.fn(() => config.settings)
  const monitor = { beat: jest.fn(), start: jest.fn(), stop: jest.fn(), setObservable: jest.fn(), getStatus: jest.fn() }
  let unresponsive: ((missedBeats: number, lastBeatAt: number | null) => void) | undefined
  const createHeartbeatMonitor = jest.fn((onUnresponsive: (m: number, l: number | null) => void) => {
    unresponsive = onUnresponsive
    return monitor
  })
  const emitter = createEventEmitter()
  const base = <ShellOptions>{ container: '#shell' }
  // note: A schema-free contract keeps payload validation inert here; that path is covered by lifecycle.validation.spec.ts. Liveness, visibility, closing, and dirty-state wiring are covered by lifecycle.liveness.spec.ts; experience-plugin wiring by lifecycle.plugins.spec.ts.
  const handle = createShellHandle(broker, base, emitter, {
    contract: { emitted: [], accepted: [] },
    selectMount,
    registerSecurity,
    createHeartbeatMonitor,
    observeVisibility: jest.fn(() => () => undefined),
  })
  return {
    handle,
    mock,
    addChannel,
    cleanup,
    mount,
    selectMount,
    registerSecurity,
    monitor,
    emitter,
    getContext: () => context,
    triggerUnresponsive: (missedBeats: number, lastBeatAt: number | null) => unresponsive?.(missedBeats, lastBeatAt),
  }
}

describe('createShellHandle', () => {
  it('reports closed before any open', () => {
    expect(setup().handle.isOpen).toBe(false)
  })

  it('defaults to the embedded display mode', () => {
    const ctx = setup()
    ctx.handle.open()
    expect(ctx.selectMount).toHaveBeenCalledWith('embedded')
  })

  it('selects the requested display mode', () => {
    const ctx = setup()
    ctx.handle.open({ displayMode: 'dialog' })
    expect(ctx.selectMount).toHaveBeenCalledWith('dialog')
  })

  it('merges create-time and per-open options for the mount', () => {
    const ctx = setup()
    ctx.handle.open({ url: 'https://feature.example' })
    expect(ctx.getContext()?.options).toEqual(expect.objectContaining({ container: '#shell', url: 'https://feature.example' }))
  })

  it('adds a channel against the mounted target', () => {
    const ctx = setup()
    ctx.handle.open()
    expect(ctx.addChannel).toHaveBeenCalledWith('feature-1', TARGET, { contractCompat: expect.any(Function) })
  })

  it('passes registered security settings to the channel', () => {
    const ctx = setup({ settings: { security: { protocol: 'v2' } } })
    ctx.handle.open({ protocol: 'v2' })
    expect(ctx.addChannel).toHaveBeenCalledWith('feature-1', TARGET, expect.objectContaining({ security: { protocol: 'v2' } }))
  })

  it('connects the channel after mounting', () => {
    const ctx = setup()
    ctx.handle.open()
    expect(ctx.mock.connect).toHaveBeenCalledTimes(1)
  })

  it('marks the shell open when the channel opens', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    expect(ctx.handle.isOpen).toBe(true)
  })

  it('emits open when the channel opens', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('open', handler)
    ctx.handle.open()
    ctx.mock.trigger('open')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('emits close when the channel closes', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('close', handler)
    ctx.handle.open()
    ctx.mock.trigger('close', { notify: false })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('runs mount cleanup when the channel closes', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('close', { notify: false })
    expect(ctx.cleanup).toHaveBeenCalledTimes(1)
  })

  it('marks the shell closed when the channel closes', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    ctx.mock.trigger('close', { notify: false })
    expect(ctx.handle.isOpen).toBe(false)
  })

  it('emits error when the channel denies the connection', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open()
    ctx.mock.trigger('deny', { reason: 'origin' })
    expect(handler).toHaveBeenCalledWith({ reason: 'origin' })
  })

  it('emits error when the channel reports an invalid message', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open()
    ctx.mock.trigger('invalid', { reason: 'schema' })
    expect(handler).toHaveBeenCalledWith({ reason: 'schema' })
  })

  it('re-emits feature messages keyed by action type', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('timeUpdated', handler)
    ctx.handle.open()
    ctx.mock.triggerMessage('timeUpdated', { time: 1 })
    expect(handler).toHaveBeenCalledWith({ time: 1 })
  })

  it('emits error when the mounted window is blocked', () => {
    const ctx = setup({ target: null })
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open()
    expect(handler).toHaveBeenCalledWith(expect.any(Error))
  })

  it('does not add a channel when the mounted window is blocked', () => {
    const ctx = setup({ target: null })
    ctx.handle.open()
    expect(ctx.addChannel).not.toHaveBeenCalled()
  })

  it('sends messages through the channel', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.send('setTimezone', { tz: 'UTC' })
    expect(ctx.mock.send).toHaveBeenCalledWith('setTimezone', { tz: 'UTC' })
  })

  it('treats send as a no-op before opening', () => {
    expect(() => setup().handle.send('noop')).not.toThrow()
  })

  it('disconnects the channel on close', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.close()
    expect(ctx.mock.disconnect).toHaveBeenCalledTimes(1)
  })

  it('does not destroy the channel on a graceful close', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.close()
    expect(ctx.mock.destroy).not.toHaveBeenCalled()
  })

  it('cleans up directly when closing a blocked open', () => {
    const ctx = setup({ target: null })
    ctx.handle.open()
    ctx.handle.close()
    expect(ctx.cleanup).toHaveBeenCalledTimes(1)
  })

  it('is a no-op to close before opening', () => {
    expect(() => setup().handle.close()).not.toThrow()
  })

  it('destroys the channel on destroy', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.destroy()
    expect(ctx.mock.destroy).toHaveBeenCalledTimes(1)
  })

  it('runs mount cleanup on destroy', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.destroy()
    expect(ctx.cleanup).toHaveBeenCalledTimes(1)
  })

  it('requests a graceful close from the mount close callback', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.getContext()?.requestClose()
    expect(ctx.mock.disconnect).toHaveBeenCalledTimes(1)
  })

  it('tears down the prior channel when reopened', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.open()
    expect(ctx.mock.destroy).toHaveBeenCalledTimes(1)
  })

  it('increments the channel name on reopen', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.open()
    expect(ctx.addChannel).toHaveBeenLastCalledWith('feature-2', TARGET, { contractCompat: expect.any(Function) })
  })

  it('starts the heartbeat monitor when the channel opens', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    expect(ctx.monitor.start).toHaveBeenCalledTimes(1)
  })

  it('feeds received beats to the monitor', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.triggerMessage('__hf:beat')
    expect(ctx.monitor.beat).toHaveBeenCalledTimes(1)
  })

  it('hides control beats from consumer handlers', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('__hf:beat', handler)
    ctx.handle.open()
    ctx.mock.triggerMessage('__hf:beat')
    expect(handler).not.toHaveBeenCalled()
  })

  it('swallows non-beat control messages without feeding the monitor', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.triggerMessage('__hf:unknown', { height: 100 })
    expect(ctx.monitor.beat).not.toHaveBeenCalled()
  })

  describe('presentation announcement', () => {
    it('sends the mounted presentation over the control plane', () => {
      const ctx = setup({ present: { mode: 'dialog', dialog: { width: 480, height: 320 } } })
      ctx.handle.open({ displayMode: 'dialog' })
      expect(ctx.mock.send).toHaveBeenCalledWith('__hf:present', { mode: 'dialog', dialog: { width: 480, height: 320 } })
    })

    it('announces the presentation as the first send of a mount', () => {
      const ctx = setup()
      ctx.handle.open()
      expect(ctx.mock.send.mock.calls[0]).toEqual(['__hf:present', { mode: 'embedded' }])
    })

    it('passes a presentation carrying a viewport through verbatim', () => {
      const ctx = setup({ present: { mode: 'embedded', viewport: { width: 320, height: 240 } } })
      ctx.handle.open()
      expect(ctx.mock.send).toHaveBeenCalledWith('__hf:present', { mode: 'embedded', viewport: { width: 320, height: 240 } })
    })

    it('queues the presentation announcement before connecting the channel', () => {
      const ctx = setup()
      ctx.handle.open()
      expect(ctx.mock.send.mock.invocationCallOrder[0]).toBeLessThan(ctx.mock.connect.mock.invocationCallOrder[0] ?? 0)
    })

    it('re-announces the presentation on reopen', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.handle.open()
      expect(ctx.mock.send).toHaveBeenCalledTimes(2)
    })
  })

  describe('feature reload', () => {
    const reload = { notify: false, reason: 'peer-reload' }

    it('keeps the mount so the reloading frame survives its own refresh', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('open')
      ctx.mock.trigger('close', reload)
      expect(ctx.cleanup).not.toHaveBeenCalled()
    })

    it('reports the ended session with its reason', () => {
      const ctx = setup()
      const events: unknown[] = []
      ctx.handle.on('close', (data) => events.push(data))
      ctx.handle.open()
      ctx.mock.trigger('open')
      ctx.mock.trigger('close', reload)
      expect({ events, isOpen: ctx.handle.isOpen }).toEqual({ events: [{ reason: 'peer-reload' }], isOpen: false })
    })

    it('re-announces the presentation the new document has not seen', () => {
      const ctx = setup({ present: { mode: 'embedded', viewport: { width: 320, height: 240 } } })
      ctx.handle.open()
      ctx.mock.trigger('open')
      ctx.mock.send.mockClear()
      ctx.mock.trigger('close', reload)
      expect(ctx.mock.send).toHaveBeenCalledWith('__hf:present', { mode: 'embedded', viewport: { width: 320, height: 240 } })
    })

    it('re-measures the frame for the re-announcement', () => {
      const viewport: ViewportReporter = { current: jest.fn(() => ({ width: 640, height: 480 })), start: jest.fn(), stop: jest.fn() }
      const ctx = setup({ present: { mode: 'embedded', viewport: { width: 320, height: 240 } }, viewport })
      ctx.handle.open()
      ctx.mock.trigger('open')
      ctx.mock.send.mockClear()
      ctx.mock.trigger('close', reload)
      expect(ctx.mock.send).toHaveBeenCalledWith('__hf:present', { mode: 'embedded', viewport: { width: 640, height: 480 } })
    })

    it('keeps the viewport reporter observing across the reload', () => {
      const viewport: ViewportReporter = { current: jest.fn(() => ({ width: 0, height: 0 })), start: jest.fn(), stop: jest.fn() }
      const ctx = setup({ viewport })
      ctx.handle.open()
      ctx.mock.trigger('open')
      ctx.mock.trigger('close', reload)
      expect(viewport.stop).not.toHaveBeenCalled()
    })

    it('gives the next session a fresh watchdog budget', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('open')
      ctx.mock.trigger('close', reload)
      ctx.mock.trigger('open')
      expect({ stopped: ctx.monitor.stop.mock.calls.length, started: ctx.monitor.start.mock.calls.length }).toEqual({
        stopped: 1,
        started: 2,
      })
    })

    it('still tears the mount down when the shell itself closes afterwards', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.trigger('open')
      ctx.mock.trigger('close', reload)
      ctx.mock.trigger('open')
      ctx.mock.trigger('close', { notify: true })
      expect(ctx.cleanup).toHaveBeenCalledTimes(1)
    })
  })

  describe('reveal on session open', () => {
    it('does not reveal the mounted frame before the channel opens', () => {
      const reveal = jest.fn()
      const ctx = setup({ reveal })
      ctx.handle.open()
      expect(reveal).not.toHaveBeenCalled()
    })

    it('reveals the mounted frame when the channel opens', () => {
      const reveal = jest.fn()
      const ctx = setup({ reveal })
      ctx.handle.open()
      ctx.mock.trigger('open')
      expect(reveal).toHaveBeenCalledTimes(1)
    })

    it('reveals the frame before starting viewport forwarding', () => {
      const reveal = jest.fn()
      const start = jest.fn()
      const ctx = setup({ reveal, viewport: { current: jest.fn(() => ({ width: 0, height: 0 })), start, stop: jest.fn() } })
      ctx.handle.open()
      ctx.mock.trigger('open')
      expect(reveal.mock.invocationCallOrder[0]).toBeLessThan(start.mock.invocationCallOrder[0] ?? 0)
    })

    it('opens without a reveal hook when the mount provides none', () => {
      const ctx = setup()
      ctx.handle.open()
      expect(() => ctx.mock.trigger('open')).not.toThrow()
    })
  })

  describe('viewport reporting', () => {
    function viewportSetup() {
      let report: ((size: ViewportPayload) => void) | undefined
      const viewport: ViewportReporter = {
        current: jest.fn(() => ({ width: 0, height: 0 })),
        start: jest.fn((forward: (size: ViewportPayload) => void) => {
          report = forward
        }),
        stop: jest.fn(),
      }
      const ctx = setup({ viewport })
      return { ctx, viewport, report: (size: ViewportPayload) => report?.(size) }
    }

    it('does not start the viewport reporter before the channel opens', () => {
      const { ctx, viewport } = viewportSetup()
      ctx.handle.open()
      expect(viewport.start).not.toHaveBeenCalled()
    })

    it('starts the viewport reporter when the channel opens', () => {
      const { ctx, viewport } = viewportSetup()
      ctx.handle.open()
      ctx.mock.trigger('open')
      expect(viewport.start).toHaveBeenCalledTimes(1)
    })

    it('forwards viewport reports as exact pixel control messages', () => {
      const { ctx, report } = viewportSetup()
      ctx.handle.open()
      ctx.mock.trigger('open')
      report({ width: 640, height: 480 })
      expect(ctx.mock.send).toHaveBeenCalledWith('__hf:viewport', { width: 640, height: 480 })
    })

    it('forwards fractional pixel dimensions unchanged', () => {
      const { ctx, report } = viewportSetup()
      ctx.handle.open()
      ctx.mock.trigger('open')
      report({ width: 412.5, height: 733.25 })
      expect(ctx.mock.send).toHaveBeenCalledWith('__hf:viewport', { width: 412.5, height: 733.25 })
    })

    it('forwards every report of a changing viewport', () => {
      const { ctx, report } = viewportSetup()
      ctx.handle.open()
      ctx.mock.trigger('open')
      report({ width: 640, height: 480 })
      report({ width: 320, height: 480 })
      expect(ctx.mock.send).toHaveBeenLastCalledWith('__hf:viewport', { width: 320, height: 480 })
    })

    it('opens without a viewport reporter when the mount provides none', () => {
      const ctx = setup()
      ctx.handle.open()
      expect(() => ctx.mock.trigger('open')).not.toThrow()
    })
  })

  describe('dismiss policy', () => {
    it('closes on an escape dismiss in dialog mode by default', () => {
      const ctx = setup()
      ctx.handle.open({ displayMode: 'dialog' })
      ctx.mock.triggerMessage('__hf:dismiss', { source: 'escape' })
      expect(ctx.mock.disconnect).toHaveBeenCalledTimes(1)
    })

    it('ignores an escape dismiss when closeOnEscape is false', () => {
      const ctx = setup()
      ctx.handle.open({ displayMode: 'dialog', closeOnEscape: false })
      ctx.mock.triggerMessage('__hf:dismiss', { source: 'escape' })
      expect(ctx.mock.disconnect).not.toHaveBeenCalled()
    })

    it('closes on a backdrop dismiss by default', () => {
      const ctx = setup()
      ctx.handle.open({ displayMode: 'dialog' })
      ctx.mock.triggerMessage('__hf:dismiss', { source: 'backdrop' })
      expect(ctx.mock.disconnect).toHaveBeenCalledTimes(1)
    })

    it('emits dismiss instead of closing when the backdrop behavior is event', () => {
      const ctx = setup()
      const handler = jest.fn()
      ctx.handle.on('dismiss', handler)
      ctx.handle.open({ displayMode: 'dialog', dialogBackdrop: 'event' })
      ctx.mock.triggerMessage('__hf:dismiss', { source: 'backdrop' })
      expect({ dismissed: handler.mock.calls, disconnected: ctx.mock.disconnect.mock.calls }).toEqual({
        dismissed: [[{ source: 'backdrop' }]],
        disconnected: [],
      })
    })

    it('ignores a backdrop dismiss when the backdrop behavior is none', () => {
      const ctx = setup()
      const handler = jest.fn()
      ctx.handle.on('dismiss', handler)
      ctx.handle.open({ displayMode: 'dialog', dialogBackdrop: 'none' })
      ctx.mock.triggerMessage('__hf:dismiss', { source: 'backdrop' })
      expect({ dismissed: handler.mock.calls, disconnected: ctx.mock.disconnect.mock.calls }).toEqual({ dismissed: [], disconnected: [] })
    })

    it('ignores dismiss signals outside dialog mode', () => {
      const ctx = setup()
      ctx.handle.open()
      ctx.mock.triggerMessage('__hf:dismiss', { source: 'escape' })
      expect(ctx.mock.disconnect).not.toHaveBeenCalled()
    })

    it('ignores a dismiss with an unrecognized source', () => {
      const ctx = setup()
      ctx.handle.open({ displayMode: 'dialog' })
      ctx.mock.triggerMessage('__hf:dismiss', { source: 'telepathy' })
      expect(ctx.mock.disconnect).not.toHaveBeenCalled()
    })

    it('ignores a dismiss with no payload', () => {
      const ctx = setup()
      ctx.handle.open({ displayMode: 'dialog' })
      ctx.mock.triggerMessage('__hf:dismiss')
      expect(ctx.mock.disconnect).not.toHaveBeenCalled()
    })
  })

  it('stops the monitor when the channel closes', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('close', { notify: false })
    expect(ctx.monitor.stop).toHaveBeenCalledTimes(1)
  })

  it('stops the monitor on destroy', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.destroy()
    expect(ctx.monitor.stop).toHaveBeenCalledTimes(1)
  })

  it('emits error when the feature becomes unresponsive by default', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open()
    ctx.triggerUnresponsive(3, null)
    expect(handler).toHaveBeenCalledWith(expect.any(Error))
  })

  it('tears the feature down when onUnresponsive is unmount', () => {
    const ctx = setup()
    ctx.handle.open({ onUnresponsive: 'unmount' })
    ctx.triggerUnresponsive(3, null)
    expect(ctx.mock.destroy).toHaveBeenCalledTimes(1)
  })

  it('invokes the onUnresponsive callback with the failure context', () => {
    const ctx = setup()
    const onUnresponsive = jest.fn()
    ctx.handle.open({ onUnresponsive })
    ctx.triggerUnresponsive(2, 123)
    expect(onUnresponsive).toHaveBeenCalledWith(expect.objectContaining({ missedBeats: 2, lastBeatAt: 123, displayMode: 'embedded' }))
  })

  it('reports the active display mode in the unresponsive context', () => {
    const ctx = setup()
    const onUnresponsive = jest.fn()
    ctx.handle.open({ displayMode: 'dialog', onUnresponsive })
    ctx.triggerUnresponsive(1, null)
    expect(onUnresponsive).toHaveBeenCalledWith(expect.objectContaining({ displayMode: 'dialog' }))
  })

  it('does not emit error when a callback handles the unresponsive feature', () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('error', handler)
    ctx.handle.open({ onUnresponsive: jest.fn() })
    ctx.triggerUnresponsive(2, 123)
    expect(handler).not.toHaveBeenCalled()
  })
})
