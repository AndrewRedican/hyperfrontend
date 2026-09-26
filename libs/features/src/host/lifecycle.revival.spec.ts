import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { ShellOptions, UnresponsivePolicy } from '../shared/types'
import type { HeartbeatState } from './heartbeat'
import type { MountResult } from './types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createEventEmitter } from '../shared/event-emitter'
import { createShellHandle } from './lifecycle'

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
  clearTimeout: (id: number) => clearTimeout(id),
}))

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const channel = {
    on: (event: string, handler: (data?: unknown) => void) => {
      ;(listeners[event] ?? (listeners[event] = [])).push(handler)
      return () => undefined
    },
    onMessage: () => () => undefined,
    send: jest.fn(),
    disconnect: jest.fn(),
    destroy: jest.fn(),
    connect: jest.fn(),
  } as unknown as ChannelHandle
  return { channel, trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)) }
}

const TARGET = { name: 'target' } as unknown as Window

/** Options for {@link setup}. */
interface RevivalSetupOptions {
  /** The create-time unresponsive policy; a quick `reopen` when the key is absent, the SDK default when given as `undefined`. */
  policy?: UnresponsivePolicy
}

const QUICK: UnresponsivePolicy = { reopen: { graceMs: 1000, backoff: 2, attempts: 2, stableMs: 5000 } }

function setup(options: RevivalSetupOptions = {}) {
  const channels: MockChannel[] = []
  const broker = {
    addChannel: jest.fn(() => {
      const mock = createMockChannel()
      channels.push(mock)
      return mock.channel
    }),
  } as unknown as BrokerHandle
  const frame = { gone: false, blocked: false, throws: false }
  const mount = jest.fn((): MountResult => {
    if (frame.throws) {
      throw new Error('Shell container not found for selector "#shell".')
    }
    return { target: frame.blocked ? null : TARGET, present: { mode: 'embedded' }, cleanup: jest.fn(), isGone: () => frame.gone }
  })
  let state: HeartbeatState = 'gone'
  let unresponsive: ((missedBeats: number, lastBeatAt: number | null) => void) | undefined
  const createHeartbeatMonitor = jest.fn((onUnresponsive: (m: number, l: number | null) => void) => {
    unresponsive = onUnresponsive
    return {
      beat: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      setObservable: jest.fn(),
      getStatus: () => ({ state, missedBeats: 0, lastBeatAt: null }),
    }
  })
  let visibilityChange: ((hidden: boolean) => void) | undefined
  const emitter = createEventEmitter()
  const handle = createShellHandle(
    broker,
    { container: '#shell', onUnresponsive: 'policy' in options ? options.policy : QUICK } as ShellOptions,
    emitter,
    {
      contract: { emitted: [], accepted: [] },
      selectMount: jest.fn(() => mount),
      registerSecurity: jest.fn(() => undefined),
      createHeartbeatMonitor,
      observeVisibility: (onChange) => {
        visibilityChange = onChange
        return () => undefined
      },
    }
  )
  const errors: unknown[] = []
  const reopens: unknown[] = []
  handle.on('error', (data) => errors.push(data))
  handle.on('reopen', (data) => reopens.push(data))
  return {
    handle,
    mount,
    frame,
    errors,
    reopens,
    channels,
    latest: () => channels[channels.length - 1],
    /** Opens the latest session's handshake, as the feature answering would. */
    connect: () => {
      state = 'healthy'
      channels[channels.length - 1].trigger('open')
    },
    /** The watchdog's verdict on the latest session. */
    silence: () => {
      state = 'suspect'
      unresponsive?.(3, 100)
    },
    recover: () => {
      state = 'healthy'
    },
    setHidden: (hidden: boolean) => visibilityChange?.(hidden),
  }
}

describe('createShellHandle unresponsive verdict', () => {
  it('emits a structured unresponsive error when the feature stops beating by default', () => {
    const ctx = setup({ policy: undefined })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    expect(ctx.errors).toEqual([{ reason: 'unresponsive', missedBeats: 3, lastBeatAt: 100, displayMode: 'embedded', frame: 'present' }])
    expect(ctx.latest().channel.destroy).not.toHaveBeenCalled()
  })
})

describe('createShellHandle reopen policy', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('emits the verdict with the frame still present, then reopens once the grace runs out', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    expect(ctx.errors).toEqual([{ reason: 'unresponsive', missedBeats: 3, lastBeatAt: 100, displayMode: 'embedded', frame: 'present' }])
    jest.advanceTimersByTime(1000)
    expect(ctx.reopens).toEqual([{ attempt: 1, attempts: 2, displayMode: 'embedded' }])
    expect(ctx.channels[0].channel.destroy).toHaveBeenCalledTimes(1)
    expect(ctx.mount).toHaveBeenCalledTimes(2)
  })

  it('accepts the shorthand with the default grace', () => {
    const ctx = setup({ policy: 'reopen' })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(3999)
    expect(ctx.reopens).toEqual([])
    jest.advanceTimersByTime(1)
    expect(ctx.reopens).toHaveLength(1)
  })

  it('keeps a session whose frame beat again during the grace', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    ctx.recover()
    jest.advanceTimersByTime(1000)
    expect(ctx.reopens).toEqual([])
    expect(ctx.mount).toHaveBeenCalledTimes(1)
  })

  it('tears a gone frame down instead of reviving it', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.frame.gone = true
    ctx.silence()
    expect(ctx.errors).toEqual([expect.objectContaining({ reason: 'unresponsive', frame: 'gone' })])
    expect(ctx.latest().channel.destroy).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(10_000)
    expect(ctx.reopens).toEqual([])
  })

  it('reports a gone frame to an emit policy without acting on it', () => {
    const ctx = setup({ policy: 'emit' })
    ctx.handle.open()
    ctx.connect()
    ctx.frame.gone = true
    ctx.silence()
    expect(ctx.errors).toEqual([expect.objectContaining({ frame: 'gone' })])
    expect(ctx.latest().channel.destroy).not.toHaveBeenCalled()
  })

  it('hands the frame state to a callback policy', () => {
    const onUnresponsive = jest.fn()
    const ctx = setup({ policy: onUnresponsive })
    ctx.handle.open()
    ctx.connect()
    ctx.frame.gone = true
    ctx.silence()
    expect(onUnresponsive).toHaveBeenCalledWith(expect.objectContaining({ frame: 'gone' }))
  })

  it('tears the feature down and reports the spent budget when the last reopen dies too', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(1000)
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(2000)
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(4000)
    expect(ctx.reopens).toHaveLength(2)
    expect(ctx.latest().channel.destroy).toHaveBeenCalledTimes(1)
    expect(ctx.errors[ctx.errors.length - 1]).toEqual({ reason: 'reopen-exhausted', attempts: 2, displayMode: 'embedded' })
  })

  it('holds the reopen while the page is hidden and grants a fresh grace on return', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    ctx.setHidden(true)
    jest.advanceTimersByTime(10_000)
    expect(ctx.reopens).toEqual([])
    ctx.setHidden(false)
    jest.advanceTimersByTime(1000)
    expect(ctx.reopens).toHaveLength(1)
  })

  it('counts a reopened session that never connected as the next death', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(1000)
    ctx.latest().trigger('connect-timeout', { elapsedMs: 10_000 })
    expect(ctx.errors[ctx.errors.length - 1]).toEqual({ reason: 'open-timeout', elapsedMs: 10_000, displayMode: 'embedded' })
    jest.advanceTimersByTime(2000)
    expect(ctx.reopens).toEqual([
      { attempt: 1, attempts: 2, displayMode: 'embedded' },
      { attempt: 2, attempts: 2, displayMode: 'embedded' },
    ])
  })

  it('leaves a first open that timed out to the host', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.latest().trigger('connect-timeout', { elapsedMs: 10_000 })
    jest.advanceTimersByTime(10_000)
    expect(ctx.reopens).toEqual([])
  })

  it('stands down when a reopen is refused a window', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    ctx.frame.blocked = true
    jest.advanceTimersByTime(1000)
    expect(ctx.errors[ctx.errors.length - 1]).toEqual({ reason: 'open-failed', displayMode: 'embedded' })
    jest.advanceTimersByTime(10_000)
    expect(ctx.reopens).toHaveLength(1)
  })

  it('surfaces a reopen whose mount throws as an error event', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    ctx.frame.throws = true
    jest.advanceTimersByTime(1000)
    const last = ctx.errors[ctx.errors.length - 1] as Error
    expect(last.message).toBe('Shell container not found for selector "#shell".')
    jest.advanceTimersByTime(10_000)
    expect(ctx.reopens).toHaveLength(1)
  })

  it('stands down when the host destroys the shell', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    ctx.handle.destroy()
    jest.advanceTimersByTime(10_000)
    expect(ctx.reopens).toEqual([])
  })

  it('stands down when the host closes the shell', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    ctx.handle.close()
    jest.advanceTimersByTime(10_000)
    expect(ctx.reopens).toEqual([])
  })

  it('stands down when the session closes', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    ctx.latest().trigger('close', { notify: true })
    jest.advanceTimersByTime(10_000)
    expect(ctx.reopens).toEqual([])
  })

  it('keeps reviving a feature that reloaded itself', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.latest().trigger('close', { notify: false, reason: 'peer-reload' })
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(1000)
    expect(ctx.reopens).toHaveLength(1)
  })

  it('restarts the budget when the host opens the feature itself', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(1000)
    ctx.connect()
    ctx.silence()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(1000)
    expect(ctx.reopens[ctx.reopens.length - 1]).toEqual({ attempt: 1, attempts: 2, displayMode: 'embedded' })
  })

  it('lets a per-open policy override the create-time reopen', () => {
    const ctx = setup()
    ctx.handle.open({ onUnresponsive: 'emit' })
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(10_000)
    expect(ctx.reopens).toEqual([])
    expect(ctx.latest().channel.destroy).not.toHaveBeenCalled()
  })

  it('rejects an out-of-range tuning before touching the running session', () => {
    const ctx = setup()
    ctx.handle.open()
    expect(() => ctx.handle.open({ onUnresponsive: { reopen: { attempts: 0 } } })).toThrow('"attempts" must be a positive integer')
    expect(ctx.latest().channel.destroy).not.toHaveBeenCalled()
  })
})
