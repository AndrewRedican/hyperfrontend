import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { ShellOptions } from '../shared/types'
import type { MountResult } from './types'
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
  const channel = <ChannelHandle>(<unknown>{
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
  })
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    triggerMessage: (type, data) => messageHandlers.forEach((handler) => handler({ type, data })),
  }
}

const TARGET = <Window>(<unknown>{ name: 'target' })

/**
 * Drives this page's reported visibility, the way a phone backgrounding the tab does.
 * @param value - The state `document.visibilityState` should report.
 */
function setPageVisibility(value: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
  document.dispatchEvent(new Event('visibilitychange'))
}

/**
 * Builds a shell wired to the real watchdog and the real visibility observer,
 * mounted as an in-document frame.
 * @returns The handle, its channel double, and the errors it emitted.
 */
function setup() {
  const mock = createMockChannel()
  const broker = <BrokerHandle>(<unknown>{ addChannel: jest.fn(() => mock.channel) })
  const frame = document.createElement('iframe')
  const mount = jest.fn((): MountResult => ({ target: TARGET, element: frame, present: { mode: 'embedded' }, cleanup: jest.fn() }))
  const emitter = createEventEmitter()
  const errors: unknown[] = []
  emitter.on('error', (error) => errors.push(error))
  const states: string[] = []
  emitter.on('status', (status) => states.push((<{ state: string }>status).state))
  const handle = createShellHandle(broker, <ShellOptions>{ container: '#shell' }, emitter, {
    contract: { emitted: [], accepted: [] },
    selectMount: jest.fn(() => mount),
    registerSecurity: jest.fn(() => undefined),
    createHeartbeatMonitor,
    observeVisibility: observePageVisibility,
  })
  handle.open()
  mock.trigger('open')
  return { handle, mock, errors, states }
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
