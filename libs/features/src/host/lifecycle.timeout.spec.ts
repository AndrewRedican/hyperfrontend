import type { BrokerHandle } from '@hyperfrontend/nexus'
import type { ShellOptions } from '../shared/types'
import type { MockChannel } from '../testing/mock-channel'
import type { MountResult } from './types'
import { createMock, describe, expect, it, jest } from '@hyperfrontend/testing'
import { createFakeWindow } from '@hyperfrontend/testing/browser'
import { createEventEmitter } from '../shared/event-emitter'
import { createMockChannel } from '../testing/mock-channel'
import { createShellHandle } from './lifecycle'

// note: Covers the channel-settings wiring around the wire handshake (origin pin, open deadline, contract compat); the broader shell lifecycle lives in lifecycle.spec.ts.

const TARGET = createFakeWindow()

function setup() {
  const mock = createMockChannel()
  const addChannel = jest.fn(() => mock.channel)
  const broker = createMock<BrokerHandle>({ addChannel })
  const cleanup = jest.fn()
  const mount = jest.fn((): MountResult => ({ target: TARGET, present: { mode: 'embedded' }, cleanup }))
  const emitter = createEventEmitter()
  const handle = createShellHandle(broker, { container: '#shell' } as ShellOptions, emitter, {
    contract: { emitted: [], accepted: [] },
    selectMount: jest.fn(() => mount),
    registerSecurity: jest.fn(() => undefined),
    createHeartbeatMonitor: jest.fn(() => ({
      beat: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      setObservable: jest.fn(),
      getStatus: jest.fn(),
    })),
    observeVisibility: jest.fn(() => () => undefined),
  })
  return { handle, mock, addChannel, cleanup, emitter }
}

function setupWatched() {
  const mock = createMockChannel()
  const cleanup = jest.fn()
  const cancelWatch = jest.fn()
  let report: ((elapsedMs: number) => void) | undefined
  const mount = jest.fn(
    (): MountResult => ({
      target: TARGET,
      present: { mode: 'popup' },
      cleanup,
      whenLost: (onLost) => {
        report = onLost
        return cancelWatch
      },
    })
  )
  const emitter = createEventEmitter()
  const handle = createShellHandle(broker(mock), { container: '#shell' } as ShellOptions, emitter, {
    contract: { emitted: [], accepted: [] },
    selectMount: jest.fn(() => mount),
    registerSecurity: jest.fn(() => undefined),
    createHeartbeatMonitor: jest.fn(() => ({
      beat: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      setObservable: jest.fn(),
      getStatus: jest.fn(),
    })),
    observeVisibility: jest.fn(() => () => undefined),
  })
  return { handle, mock, cleanup, cancelWatch, emitter, lose: (elapsedMs: number) => report?.(elapsedMs) }
}

function broker(mock: MockChannel): BrokerHandle {
  return createMock<BrokerHandle>({ addChannel: jest.fn(() => mock.channel) })
}

describe('createShellHandle windowed-target watch', () => {
  it('emits a distinguishable error when the opened window stops being reachable', () => {
    const ctx = setupWatched()
    const errors: unknown[] = []
    ctx.emitter.on('error', (data) => errors.push(data))
    ctx.handle.open({ displayMode: 'popup' })
    ctx.lose(320)
    expect(errors).toEqual([{ reason: 'target-lost', elapsedMs: 320, displayMode: 'popup' }])
  })

  it('tears the mount down instead of waiting out the open timeout', () => {
    const ctx = setupWatched()
    ctx.handle.open({ displayMode: 'popup' })
    ctx.lose(320)
    expect({ destroyed: ctx.mock.destroy.mock.calls.length, cleaned: ctx.cleanup.mock.calls.length }).toEqual({
      destroyed: 1,
      cleaned: 1,
    })
  })

  it('stops watching once the session is open, leaving the window to the heartbeat', () => {
    const ctx = setupWatched()
    ctx.handle.open({ displayMode: 'popup' })
    ctx.mock.trigger('open')
    expect(ctx.cancelWatch).toHaveBeenCalledTimes(1)
  })

  it('cancels the watch when the shell is destroyed before the handshake', () => {
    const ctx = setupWatched()
    ctx.handle.open({ displayMode: 'popup' })
    ctx.handle.destroy()
    expect(ctx.cancelWatch).toHaveBeenCalledTimes(1)
  })
})

describe('createShellHandle origin pin and open deadline', () => {
  it('pins the channel to the origin derived from the feature url', () => {
    const ctx = setup()
    ctx.handle.open({ url: 'https://feature.example/app/index.html' })
    expect(ctx.addChannel).toHaveBeenCalledWith('feature-1', TARGET, {
      contractCompat: expect.any(Function),
      origin: 'https://feature.example',
    })
  })

  it('omits the origin when the url cannot be parsed', () => {
    const ctx = setup()
    ctx.handle.open({ url: 'https://' })
    expect(ctx.addChannel).toHaveBeenCalledWith('feature-1', TARGET, { contractCompat: expect.any(Function) })
  })

  it('passes the open timeout to the channel as the connect deadline', () => {
    const ctx = setup()
    ctx.handle.open({ openTimeoutMs: 3000 })
    expect(ctx.addChannel).toHaveBeenCalledWith('feature-1', TARGET, { contractCompat: expect.any(Function), connectTimeoutMs: 3000 })
  })

  it('applies the contract-version compatibility rule to the channel', () => {
    const ctx = setup()
    ctx.handle.open()
    const settings = (ctx.addChannel.mock.calls[0] as unknown[])[2] as { contractCompat: (own: unknown, peer: unknown) => unknown }
    expect(settings.contractCompat({ version: '1.0.0' }, { version: '2.0.0' })).toEqual({ compatible: false, reason: expect.any(String) })
  })

  it('emits a distinguishable error when the channel times out', () => {
    const ctx = setup()
    const errors: unknown[] = []
    ctx.emitter.on('error', (data) => errors.push(data))
    ctx.handle.open()
    ctx.mock.trigger('connect-timeout', { elapsedMs: 10_000 })
    expect(errors).toEqual([{ reason: 'open-timeout', elapsedMs: 10_000, displayMode: 'embedded' }])
  })

  it('tears the mount down when the channel times out', () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.trigger('connect-timeout', { elapsedMs: 10_000 })
    expect({ destroyed: ctx.mock.destroy.mock.calls.length, cleaned: ctx.cleanup.mock.calls.length }).toEqual({
      destroyed: 1,
      cleaned: 1,
    })
  })
})
