import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { Mock } from '@hyperfrontend/testing'
import type { ShellOptions } from '../shared/types'
import type { MountResult } from './types'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createEventEmitter } from '../shared/event-emitter'
import { createShellHandle } from './lifecycle'

// note: Covers the channel-settings wiring around the wire handshake (origin pin, open deadline, contract compat); the broader shell lifecycle lives in lifecycle.spec.ts.

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
  destroy: Mock
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const destroy = jest.fn()
  const channel = {
    on: (event: string, handler: (data?: unknown) => void) => {
      ;(listeners[event] ?? (listeners[event] = [])).push(handler)
      return () => undefined
    },
    onMessage: () => () => undefined,
    send: jest.fn(),
    disconnect: jest.fn(),
    destroy,
    connect: jest.fn(),
  } as unknown as ChannelHandle
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    destroy,
  }
}

const TARGET = { name: 'target' } as unknown as Window

function setup() {
  const mock = createMockChannel()
  const addChannel = jest.fn(() => mock.channel)
  const broker = { addChannel } as unknown as BrokerHandle
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
    const settings = ctx.addChannel.mock.calls[0][2] as { contractCompat: (own: unknown, peer: unknown) => unknown }
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
