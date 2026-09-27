import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { ShellOptions, UnresponsivePolicy } from '../shared/types'
import type { MountResult } from './types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createEventEmitter } from '../shared/event-emitter'
import { createHeartbeatMonitor } from './heartbeat'
import { createShellHandle } from './lifecycle'
import { observePageVisibility } from './visibility'

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

/**
 * Drives this page's reported visibility, the way a phone backgrounding the tab does.
 *
 * @param value - The state `document.visibilityState` should report.
 */
function setPageVisibility(value: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
  document.dispatchEvent(new Event('visibilitychange'))
}

/**
 * Builds a shell wired to the real watchdog and the real visibility observer,
 * mounted as an in-document frame.
 *
 * @param onUnresponsive - The shell's unresponsive policy; the SDK default when omitted.
 * @param concealUnresponsive - Whether the shell hides the frame while it is silent.
 * @returns The handle, its channel double, its mount and frame, and the errors, states, and reopens it emitted.
 */
function setup(onUnresponsive?: UnresponsivePolicy, concealUnresponsive?: boolean) {
  const mock = createMockChannel()
  const broker = { addChannel: jest.fn(() => mock.channel) } as unknown as BrokerHandle
  const frame = document.createElement('iframe')
  const mount = jest.fn(
    (): MountResult => ({
      target: TARGET,
      element: frame,
      present: { mode: 'embedded' },
      reveal: () => {
        frame.style.visibility = 'visible'
      },
      conceal: () => {
        frame.style.visibility = 'hidden'
      },
      cleanup: jest.fn(),
    })
  )
  const emitter = createEventEmitter()
  const errors: unknown[] = []
  emitter.on('error', (error) => errors.push(error))
  const states: string[] = []
  emitter.on('status', (status) => states.push((status as { state: string }).state))
  const reopens: unknown[] = []
  emitter.on('reopen', (data) => reopens.push(data))
  const handle = createShellHandle(broker, { container: '#shell', onUnresponsive, concealUnresponsive } as ShellOptions, emitter, {
    contract: { emitted: [], accepted: [] },
    selectMount: jest.fn(() => mount),
    registerSecurity: jest.fn(() => undefined),
    createHeartbeatMonitor,
    observeVisibility: observePageVisibility,
  })
  handle.open()
  mock.trigger('open')
  return { handle, mock, mount, frame, errors, states, reopens }
}

// why: This is the failure the whole observability latch exists around, exercised end to end: a frame the browser kills while the tab is in the background can never send the report that says it is visible again, so a host that waits for one waits forever. Every piece has to agree for the verdict to arrive — the lifecycle dropping a report it can no longer believe, and the watchdog refusing to call anything healthy it has not heard from.
describe('a feature frame killed while the tab was in the background', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('is declared unresponsive once the tab comes back', () => {
    const ctx = setup()
    ctx.mock.triggerMessage('__hf:beat')
    setPageVisibility('hidden')
    ctx.mock.triggerMessage('__hf:visibility', { hidden: true })
    // note: The frame dies here. It sends nothing ever again — no beat, and no visibility report to clear the host's copy of its hidden state.
    setPageVisibility('visible')
    jest.advanceTimersByTime(3000)
    expect(ctx.errors).toHaveLength(1)
    expect(ctx.errors[0]).toMatchObject({ reason: 'unresponsive' })
    expect(ctx.states).toEqual(['healthy', 'unobservable', 'suspect'])
  })

  it('is never called healthy on the way there, so a host cannot readmit it', () => {
    const ctx = setup()
    ctx.mock.triggerMessage('__hf:beat')
    setPageVisibility('hidden')
    ctx.mock.triggerMessage('__hf:visibility', { hidden: true })
    setPageVisibility('visible')
    expect(ctx.states).toEqual(['healthy', 'unobservable'])
  })
})

describe('a feature frame that survives the tab going away', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('earns healthy back on its first beat and is never suspected', () => {
    const ctx = setup()
    ctx.mock.triggerMessage('__hf:beat')
    setPageVisibility('hidden')
    ctx.mock.triggerMessage('__hf:visibility', { hidden: true })
    setPageVisibility('visible')
    ctx.mock.triggerMessage('__hf:visibility', { hidden: false })
    ctx.mock.triggerMessage('__hf:beat')
    jest.advanceTimersByTime(2000)
    ctx.mock.triggerMessage('__hf:beat')
    jest.advanceTimersByTime(2000)
    expect(ctx.errors).toHaveLength(0)
    expect(ctx.states).toEqual(['healthy', 'unobservable', 'healthy'])
  })
})

// why: The same death, with the host asking the shell to heal it: every clock involved is the real one, so the grace, the hidden-page hold, and the watchdog's refusal to call a silent frame healthy all have to line up for the feature to come back exactly once.
describe('a killed feature frame under the reopen policy', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    Reflect.deleteProperty(document, 'visibilityState')
  })

  it('is replaced once the verdict outlasts the grace after the tab comes back', () => {
    const ctx = setup('reopen')
    ctx.mock.triggerMessage('__hf:beat')
    setPageVisibility('hidden')
    ctx.mock.triggerMessage('__hf:visibility', { hidden: true })
    setPageVisibility('visible')
    jest.advanceTimersByTime(3000)
    expect(ctx.errors).toEqual([expect.objectContaining({ reason: 'unresponsive', frame: 'present' })])
    jest.advanceTimersByTime(3999)
    expect(ctx.reopens).toEqual([])
    jest.advanceTimersByTime(1)
    expect(ctx.reopens).toEqual([{ attempt: 1, attempts: 3, displayMode: 'embedded' }])
    expect(ctx.mount).toHaveBeenCalledTimes(2)
  })

  it('waits for the tab to come back before replacing a frame that died in view', () => {
    const ctx = setup('reopen')
    ctx.mock.triggerMessage('__hf:beat')
    jest.advanceTimersByTime(3000)
    setPageVisibility('hidden')
    jest.advanceTimersByTime(60_000)
    expect(ctx.reopens).toEqual([])
    setPageVisibility('visible')
    jest.advanceTimersByTime(4000)
    expect(ctx.reopens).toHaveLength(1)
  })
})

// why: Concealment keys off the watchdog's verdict, which cannot tell a dead frame from a starved one, so both halves have to hold with the real clock: a frame that only stalled comes back the moment it beats, and a frame that stays silent is never shown again before its replacement opens.
describe('a silent feature frame the host asked to conceal', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('disappears on the verdict and returns with its next beat', () => {
    const ctx = setup(undefined, true)
    ctx.mock.triggerMessage('__hf:beat')
    expect(ctx.frame.style.visibility).toBe('visible')
    jest.advanceTimersByTime(3000)
    expect(ctx.states).toEqual(['healthy', 'suspect'])
    expect(ctx.frame.style.visibility).toBe('hidden')
    ctx.mock.triggerMessage('__hf:beat')
    expect(ctx.frame.style.visibility).toBe('visible')
  })

  it('stays hidden through the reopen grace until its replacement opens', () => {
    const ctx = setup('reopen', true)
    ctx.mock.triggerMessage('__hf:beat')
    jest.advanceTimersByTime(3000)
    expect(ctx.frame.style.visibility).toBe('hidden')
    jest.advanceTimersByTime(3999)
    expect(ctx.reopens).toEqual([])
    expect(ctx.frame.style.visibility).toBe('hidden')
    jest.advanceTimersByTime(1)
    expect(ctx.reopens).toHaveLength(1)
    expect(ctx.frame.style.visibility).toBe('hidden')
    ctx.mock.trigger('open')
    expect(ctx.frame.style.visibility).toBe('visible')
  })
})
