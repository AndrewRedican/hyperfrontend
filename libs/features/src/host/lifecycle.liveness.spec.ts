import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { ShellOptions } from '../shared/types'
import type { MountResult } from './types'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createEventEmitter } from '../shared/event-emitter'
import { createShellHandle } from './lifecycle'

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
  triggerMessage(type: string, data?: unknown): void
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const messageHandlers: Array<(message: { type: string; data?: unknown }) => void> = []
  const channel = {
    on: (event: string, handler: (data?: unknown) => void) => {
      ;(listeners[event] ?? (listeners[event] = [])).push(handler)
      return () => undefined
    },
    onMessage: (handler: (message: { type: string; data?: unknown }) => void) => {
      messageHandlers.push(handler)
      return () => undefined
    },
    send: jest.fn(),
    disconnect: jest.fn(),
    destroy: jest.fn(),
    connect: jest.fn(),
  } as unknown as ChannelHandle
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    triggerMessage: (type, data) => messageHandlers.forEach((handler) => handler({ type, data })),
  }
}

const TARGET = { name: 'target' } as unknown as Window

/** Stands in for the iframe an in-document mount reports back, whose visibility the browser slaves to this page's. */
const FRAME = { tagName: 'IFRAME' } as unknown as HTMLElement

/** Options for {@link setup}. */
interface LivenessSetupOptions {
  /** `true` mounts the feature in this document (an iframe), as embedded and dialog do; omitted leaves it windowed. */
  inDocument?: boolean
}

function setup(options: LivenessSetupOptions = {}) {
  const mock = createMockChannel()
  const broker = { addChannel: jest.fn(() => mock.channel) } as unknown as BrokerHandle
  const mount = jest.fn(
    (): MountResult => ({
      target: TARGET,
      present: { mode: 'embedded' },
      cleanup: jest.fn(),
      ...(options.inDocument === true && { element: FRAME }),
    })
  )
  const monitor = { beat: jest.fn(), start: jest.fn(), stop: jest.fn(), setObservable: jest.fn(), getStatus: jest.fn() }
  let stateChange: ((status: unknown) => void) | undefined
  const createHeartbeatMonitor = jest.fn(
    (_onUnresponsive: (m: number, l: number | null) => void, onStateChange?: (status: unknown) => void) => {
      stateChange = onStateChange
      return monitor
    }
  )
  let visibilityChange: ((hidden: boolean) => void) | undefined
  const visibilityStop = jest.fn()
  const observeVisibility = jest.fn((onChange: (hidden: boolean) => void) => {
    visibilityChange = onChange
    return visibilityStop
  })
  const emitter = createEventEmitter()
  const handle = createShellHandle(broker, { container: '#shell' } as ShellOptions, emitter, {
    contract: { emitted: [], accepted: [] },
    selectMount: jest.fn(() => mount),
    registerSecurity: jest.fn(() => undefined),
    createHeartbeatMonitor,
    observeVisibility,
  })
  return {
    handle,
    mock,
    monitor,
    emitter,
    visibilityStop,
    triggerVisibility: (hidden: boolean) => visibilityChange?.(hidden),
    triggerStatus: (status: unknown) => stateChange?.(status),
  }
}

describe('createShellHandle liveness states and observability', () => {
  it('re-emits heartbeat status transitions as the status event', () => {
    const ctx = setup()
    const statuses: unknown[] = []
    ctx.emitter.on('status', (status) => statuses.push(status))
    ctx.handle.open()
    ctx.triggerStatus({ state: 'suspect', missedBeats: 3, lastBeatAt: null })
    expect(statuses).toEqual([{ state: 'suspect', missedBeats: 3, lastBeatAt: null }])
  })

  it('marks the pair unobservable when the host page hides', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.triggerVisibility(true)
    expect(ctx.monitor.setObservable).toHaveBeenLastCalledWith(false)
    ctx.triggerVisibility(false)
    expect(ctx.monitor.setObservable).toHaveBeenLastCalledWith(true)
  })

  it('marks the pair unobservable while the feature page reports hidden', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    ctx.mock.triggerMessage('__hf:visibility', { hidden: true })
    expect(ctx.monitor.setObservable).toHaveBeenLastCalledWith(false)
    ctx.mock.triggerMessage('__hf:visibility', { hidden: false })
    expect(ctx.monitor.setObservable).toHaveBeenLastCalledWith(true)
  })

  it('keeps a windowed feature unobservable while it reports itself hidden, whatever this page does', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    ctx.triggerVisibility(true)
    ctx.mock.triggerMessage('__hf:visibility', { hidden: true })
    ctx.triggerVisibility(false)
    expect(ctx.monitor.setObservable).toHaveBeenLastCalledWith(false)
  })

  it('stops believing an in-document frame is hidden once this page is not', () => {
    const ctx = setup({ inDocument: true })
    ctx.handle.open()
    ctx.mock.trigger('open')
    ctx.triggerVisibility(true)
    ctx.mock.triggerMessage('__hf:visibility', { hidden: true })
    ctx.triggerVisibility(false)
    // why: The browser slaves an iframe's visibility to its embedder's, so the report cannot still be true — and a frame killed while this page was in the background can never send the one that would clear it.
    expect(ctx.monitor.setObservable).toHaveBeenLastCalledWith(true)
  })

  it('still honours an in-document frame reporting itself hidden while this page is visible', () => {
    const ctx = setup({ inDocument: true })
    ctx.handle.open()
    ctx.mock.trigger('open')
    ctx.mock.triggerMessage('__hf:visibility', { hidden: true })
    expect(ctx.monitor.setObservable).toHaveBeenLastCalledWith(false)
  })

  it('clears the feature-reported hidden state when the feature reloads', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    ctx.mock.triggerMessage('__hf:visibility', { hidden: true })
    ctx.mock.trigger('close', { notify: false, reason: 'peer-reload' })
    expect(ctx.monitor.setObservable).toHaveBeenLastCalledWith(true)
  })

  it('keeps observing the host page across a feature reload', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    ctx.mock.trigger('close', { notify: false, reason: 'peer-reload' })
    expect(ctx.visibilityStop).not.toHaveBeenCalled()
  })

  it('tears the visibility observer down with the monitor', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.destroy()
    expect(ctx.visibilityStop).toHaveBeenCalledTimes(1)
  })
})

describe('createShellHandle teardown and dirty state', () => {
  it('re-emits the closing notice to subscribers', () => {
    const ctx = setup()
    const closings: unknown[] = []
    ctx.emitter.on('closing', (data) => closings.push(data))
    ctx.handle.open()
    ctx.mock.trigger('closing', { initiatedLocally: false })
    expect(closings).toEqual([{ initiatedLocally: false }])
  })

  it('tracks the feature-declared dirty state and emits dirty-state', () => {
    const ctx = setup()
    const events: unknown[] = []
    ctx.emitter.on('dirty-state', (data) => events.push(data))
    ctx.handle.open()
    ctx.mock.trigger('open')
    expect(ctx.handle.isDirty).toBe(false)
    ctx.mock.triggerMessage('__hf:dirty', { dirty: true })
    expect(ctx.handle.isDirty).toBe(true)
    ctx.mock.triggerMessage('__hf:dirty', { dirty: false })
    expect(ctx.handle.isDirty).toBe(false)
    expect(events).toEqual([{ dirty: true }, { dirty: false }])
  })

  it('ignores a malformed dirty payload', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    ctx.mock.triggerMessage('__hf:dirty', { dirty: 'yes' })
    expect(ctx.handle.isDirty).toBe(false)
  })

  it('resets the dirty state when the channel closes', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('open')
    ctx.mock.triggerMessage('__hf:dirty', { dirty: true })
    ctx.mock.trigger('close', { notify: false })
    expect(ctx.handle.isDirty).toBe(false)
  })
})
