import type { BrokerHandle } from '@hyperfrontend/nexus'
import type { ShellOptions, UnresponsiveInfo, UnresponsivePolicy } from '../shared/types'
import type { MockChannel } from '../testing/mock-channel'
import type { HeartbeatState } from './heartbeat'
import type { MountResult } from './types'
import { afterEach, beforeEach } from 'node:test'
import { createMock, describe, expect, it, jest } from '@hyperfrontend/testing'
import { createFakeWindow } from '@hyperfrontend/testing/browser'
import { createEventEmitter } from '../shared/event-emitter'
import { createMockChannel } from '../testing/mock-channel'
import { createShellHandle } from './lifecycle'

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
  clearTimeout: (id: number) => clearTimeout(id),
}))

const TARGET = createFakeWindow()

/** One mounted frame's display hooks, as the shell drove them. */
interface FrameDouble {
  reveal: ReturnType<typeof jest.fn>
  conceal: ReturnType<typeof jest.fn>
}

/** Options for {@link setup}. */
interface ConcealSetupOptions {
  /** The create-time unresponsive policy; `emit` when omitted. */
  policy?: UnresponsivePolicy
  /** The create-time concealment switch; unset when omitted. */
  conceal?: boolean
  /** `true` mounts a mode with no in-document frame, whose result carries no display hooks. */
  windowed?: boolean
}

function setup(options: ConcealSetupOptions = {}) {
  const channels: MockChannel[] = []
  const broker = createMock<BrokerHandle>({
    addChannel: jest.fn(() => {
      const mock = createMockChannel()
      channels.push(mock)
      return mock.channel
    }),
  })
  const frames: FrameDouble[] = []
  const trace: string[] = []
  const mount = jest.fn((): MountResult => {
    if (options.windowed === true) {
      return { target: TARGET, present: { mode: 'popup' }, cleanup: jest.fn() }
    }
    const frame = { reveal: jest.fn(() => trace.push('reveal')), conceal: jest.fn(() => trace.push('conceal')) }
    frames.push(frame)
    return { target: TARGET, present: { mode: 'embedded' }, cleanup: jest.fn(), isGone: () => false, ...frame }
  })
  let unresponsive: ((missedBeats: number, lastBeatAt: number | null) => void) | undefined
  let stateChange: ((status: { state: HeartbeatState; missedBeats: number; lastBeatAt: number | null }) => void) | undefined
  let state: HeartbeatState = 'gone'
  const judge = (next: HeartbeatState) => {
    state = next
    stateChange?.({ state: next, missedBeats: next === 'suspect' ? 3 : 0, lastBeatAt: null })
  }
  const createHeartbeatMonitor = jest.fn(
    (onUnresponsive: (m: number, l: number | null) => void, onStateChange?: (status: never) => void) => {
      unresponsive = onUnresponsive
      stateChange = onStateChange
      return {
        beat: jest.fn(),
        start: () => judge('healthy'),
        stop: () => judge('gone'),
        setObservable: jest.fn(),
        getStatus: () => ({ state, missedBeats: 0, lastBeatAt: null }),
      }
    }
  )
  const emitter = createEventEmitter()
  const base = {
    container: '#shell',
    onUnresponsive: options.policy,
    ...(options.conceal !== undefined && { concealUnresponsive: options.conceal }),
  }
  const handle = createShellHandle(broker, base as ShellOptions, emitter, {
    contract: { emitted: [], accepted: [] },
    selectMount: jest.fn(() => mount),
    registerSecurity: jest.fn(() => undefined),
    createHeartbeatMonitor,
    observeVisibility: () => () => undefined,
  })
  handle.on('error', (data) => trace.push(`error:${(data as { reason: string }).reason}`))
  return {
    handle,
    frames,
    trace,
    channels,
    latest: () => channels[channels.length - 1],
    /** Completes the latest session's handshake, which starts the watchdog. */
    connect: () => {
      channels[channels.length - 1].trigger('open')
    },
    /** The watchdog's verdict: the miss budget is spent while the pages are visible. */
    silence: () => {
      judge('suspect')
      unresponsive?.(3, null)
    },
    /** A beat arrives, which is what earns `healthy` back. */
    beat: () => {
      judge('healthy')
    },
  }
}

describe('createShellHandle frame concealment', () => {
  it('leaves a silent frame on the page by default', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    expect(ctx.frames[0].conceal).not.toHaveBeenCalled()
  })

  it('leaves a silent frame on the page when concealment is switched off', () => {
    const ctx = setup({ conceal: false })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    expect(ctx.frames[0].conceal).not.toHaveBeenCalled()
  })

  it('hides a silent frame before the verdict is emitted', () => {
    const ctx = setup({ conceal: true })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    expect(ctx.trace).toEqual(['reveal', 'conceal', 'error:unresponsive'])
  })

  it('shows the frame again on its next beat', () => {
    const ctx = setup({ conceal: true })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    ctx.beat()
    expect(ctx.trace).toEqual(['reveal', 'conceal', 'error:unresponsive', 'reveal'])
  })

  it('reveals nothing on a beat when nothing was hidden', () => {
    const ctx = setup({ conceal: true })
    ctx.handle.open()
    ctx.connect()
    ctx.beat()
    expect(ctx.frames[0].reveal).toHaveBeenCalledTimes(1)
  })

  it('hides a frame once however often the verdict repeats', () => {
    const ctx = setup({ conceal: true })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    ctx.silence()
    expect(ctx.frames[0].conceal).toHaveBeenCalledTimes(1)
  })

  it('shows the frame again when a reloaded feature opens a fresh session', () => {
    const ctx = setup({ conceal: true })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    ctx.latest().trigger('close', { notify: false, reason: 'peer-reload' })
    const revealsBeforeFreshSession = ctx.frames[0].reveal.mock.calls.length
    ctx.connect()
    expect({ revealsBeforeFreshSession, revealsAfterFreshSession: ctx.frames[0].reveal.mock.calls.length }).toEqual({
      revealsBeforeFreshSession: 1,
      revealsAfterFreshSession: 3,
    })
  })

  it('lets a callback policy hide the frame itself', () => {
    const ctx = setup({ policy: (info) => info.conceal() })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    expect(ctx.frames[0].conceal).toHaveBeenCalledTimes(1)
  })

  it('refuses to hide a frame that has beaten again since the verdict', () => {
    let verdict: UnresponsiveInfo | undefined
    const ctx = setup({
      policy: (info) => {
        verdict = info
      },
    })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    ctx.beat()
    verdict?.conceal()
    expect(ctx.frames[0].conceal).not.toHaveBeenCalled()
  })

  it('has nothing to hide in a mode without an in-document frame', () => {
    const ctx = setup({ conceal: true, windowed: true })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    expect(ctx.trace).toEqual(['error:unresponsive'])
  })

  it('lets a per-open switch override the create-time one', () => {
    const ctx = setup({ conceal: true })
    ctx.handle.open({ concealUnresponsive: false })
    ctx.connect()
    ctx.silence()
    expect(ctx.frames[0].conceal).not.toHaveBeenCalled()
  })
})

describe('createShellHandle frame concealment under the reopen policy', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('mounts a replacement frame once the grace runs out', () => {
    const ctx = setup({ policy: { reopen: { graceMs: 1000 } }, conceal: true })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(1000)
    expect(ctx.frames).toHaveLength(2)
  })

  it('keeps the silent frame hidden through the grace', () => {
    const ctx = setup({ policy: { reopen: { graceMs: 1000 } }, conceal: true })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(1000)
    expect(ctx.frames[0].reveal).toHaveBeenCalledTimes(1)
  })

  it('keeps the replacement frame hidden until its session opens', () => {
    const ctx = setup({ policy: { reopen: { graceMs: 1000 } }, conceal: true })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(1000)
    expect(ctx.frames[1].reveal).not.toHaveBeenCalled()
  })

  it('shows the replacement frame once its session opens', () => {
    const ctx = setup({ policy: { reopen: { graceMs: 1000 } }, conceal: true })
    ctx.handle.open()
    ctx.connect()
    ctx.silence()
    jest.advanceTimersByTime(1000)
    ctx.connect()
    expect(ctx.frames[1].reveal).toHaveBeenCalledTimes(1)
  })
})
