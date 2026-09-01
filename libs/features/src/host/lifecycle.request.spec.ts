import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { Mock } from '@hyperfrontend/testing'
import type { ShellOptions } from '../shared/types'
import type { MountResult } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createEventEmitter } from '../shared/event-emitter'
import { createShellHandle } from './lifecycle'

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
  triggerMessage(type: string, data?: unknown): void
  send: Mock
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const messageHandlers: Array<(message: { type: string; data?: unknown }) => void> = []
  const send = jest.fn()
  const channel = {
    on: (event: string, handler: (data?: unknown) => void) => {
      ;(listeners[event] ?? (listeners[event] = [])).push(handler)
      return () => undefined
    },
    onMessage: (handler: (message: { type: string; data?: unknown }) => void) => {
      messageHandlers.push(handler)
      return () => undefined
    },
    send,
    disconnect: jest.fn(),
    destroy: jest.fn(),
    connect: jest.fn(),
  } as unknown as ChannelHandle
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    triggerMessage: (type, data) => messageHandlers.forEach((handler) => handler({ type, data })),
    send,
  }
}

const TARGET = { name: 'target' } as unknown as Window

function flush() {
  return createPromise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

function setup() {
  const mock = createMockChannel()
  const broker = { addChannel: jest.fn(() => mock.channel) } as unknown as BrokerHandle
  const mount = jest.fn((): MountResult => ({ target: TARGET, present: { mode: 'embedded' }, cleanup: jest.fn() }))
  const handle = createShellHandle(broker, { container: '#shell' } as ShellOptions, createEventEmitter(), {
    // why: The '__hf:' envelope types carry schemas no envelope object satisfies, so every flow below fails if request/response traffic is ever routed through send or receive payload validation.
    contract: {
      emitted: [
        { type: 'setTimezone', schema: { type: 'object', required: ['tz'] } },
        { type: '__hf:request', schema: { type: 'string' } },
        { type: '__hf:response', schema: { type: 'string' } },
      ],
      accepted: [
        { type: '__hf:request', schema: { type: 'string' } },
        { type: '__hf:response', schema: { type: 'string' } },
      ],
    },
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
  return { handle, mock }
}

function sentEnvelope(send: Mock, index = 0): Record<string, unknown> {
  // note: Every open leads with the presentation announcement, which is control traffic rather than an envelope.
  const call = send.mock.calls.filter((entry) => entry[0] !== '__hf:present')[index]
  if (!call) {
    throw createError(`expected a sent envelope at index ${index}`)
  }
  return call[1] as Record<string, unknown>
}

describe('createShellHandle request/response', () => {
  it('sends a correlated request envelope through the channel', async () => {
    const ctx = setup()
    ctx.handle.open()
    const pending = ctx.handle.request('getTime', { tz: 'UTC' })
    expect(ctx.mock.send).toHaveBeenCalledWith(
      '__hf:request',
      expect.objectContaining({ correlationId: expect.any(String), from: 'host', innerType: 'getTime', payload: { tz: 'UTC' } })
    )
    ctx.mock.triggerMessage('__hf:response', { correlationId: sentEnvelope(ctx.mock.send)['correlationId'], from: 'feature', ok: true })
    await pending
  })

  it('completes a request whose inner payload violates the emitted schema for its inner type', async () => {
    const ctx = setup()
    ctx.handle.open()
    const pending = ctx.handle.request('setTimezone', { timezone: 'UTC' })
    ctx.mock.triggerMessage('__hf:response', {
      correlationId: sentEnvelope(ctx.mock.send)['correlationId'],
      from: 'feature',
      ok: true,
      payload: 'applied',
    })
    await expect(pending).resolves.toBe('applied')
  })

  it('resolves a request when the feature responds', async () => {
    const ctx = setup()
    ctx.handle.open()
    const pending = ctx.handle.request('getTime')
    ctx.mock.triggerMessage('__hf:response', {
      correlationId: sentEnvelope(ctx.mock.send)['correlationId'],
      from: 'feature',
      ok: true,
      payload: '12:00',
    })
    await expect(pending).resolves.toBe('12:00')
  })

  it('rejects a request when the feature responds with an error', async () => {
    const ctx = setup()
    ctx.handle.open()
    const pending = ctx.handle.request('getTime')
    ctx.mock.triggerMessage('__hf:response', {
      correlationId: sentEnvelope(ctx.mock.send)['correlationId'],
      from: 'feature',
      ok: false,
      error: 'no clock available',
    })
    await expect(pending).rejects.toThrow('no clock available')
  })

  it('rejects a request immediately when the shell is not open', async () => {
    await expect(setup().handle.request('getTime')).rejects.toThrow("Cannot send request 'getTime': the shell is not open.")
  })

  it('rejects pending requests when the channel closes', async () => {
    const ctx = setup()
    ctx.handle.open()
    const pending = ctx.handle.request('getTime')
    ctx.mock.trigger('close', { notify: false })
    await expect(pending).rejects.toThrow('The feature channel closed before the feature responded.')
  })

  it('rejects pending requests on destroy', async () => {
    const ctx = setup()
    ctx.handle.open()
    const pending = ctx.handle.request('getTime')
    ctx.handle.destroy()
    await expect(pending).rejects.toThrow('The shell was destroyed before the feature responded.')
  })

  it('rejects pending requests when the shell reopens', async () => {
    const ctx = setup()
    ctx.handle.open()
    const pending = ctx.handle.request('getTime')
    ctx.handle.open()
    await expect(pending).rejects.toThrow('The shell was destroyed before the feature responded.')
  })

  it('rejects a request that outlives its timeout', async () => {
    const ctx = setup()
    ctx.handle.open()
    await expect(ctx.handle.request('getTime', undefined, { timeoutMs: 10 })).rejects.toThrow("Request 'getTime' timed out after 10ms.")
  })

  it('answers feature requests through a registered handler', async () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.handle.handle('getHostInfo', () => ({ name: 'host-app' }))
    ctx.mock.triggerMessage('__hf:request', { correlationId: 'feature-1', from: 'feature', innerType: 'getHostInfo' })
    await flush()
    expect(ctx.mock.send).toHaveBeenCalledWith(
      '__hf:response',
      expect.objectContaining({
        correlationId: 'feature-1',
        from: 'host',
        innerType: 'getHostInfo',
        ok: true,
        payload: { name: 'host-app' },
      })
    )
  })

  it('answers through a handler registered before the first open', async () => {
    const ctx = setup()
    ctx.handle.handle('getHostInfo', () => 'ready')
    ctx.handle.open()
    ctx.mock.triggerMessage('__hf:request', { correlationId: 'feature-1', from: 'feature', innerType: 'getHostInfo' })
    await flush()
    expect(ctx.mock.send).toHaveBeenCalledWith('__hf:response', expect.objectContaining({ ok: true, payload: 'ready' }))
  })

  it('responds with an error when the host has no handler', async () => {
    const ctx = setup()
    ctx.handle.open()
    ctx.mock.triggerMessage('__hf:request', { correlationId: 'feature-1', from: 'feature', innerType: 'missing' })
    await flush()
    expect(ctx.mock.send).toHaveBeenCalledWith(
      '__hf:response',
      expect.objectContaining({ ok: false, error: "No handler is registered for 'missing'." })
    )
  })

  it('ignores the echo of its own request envelope', async () => {
    const ctx = setup()
    ctx.handle.open()
    const pending = ctx.handle.request('getTime')
    const envelope = sentEnvelope(ctx.mock.send)
    ctx.mock.triggerMessage('__hf:request', envelope)
    await flush()
    expect(ctx.mock.send.mock.calls.filter((entry) => entry[0] === '__hf:response')).toEqual([])
    ctx.mock.triggerMessage('__hf:response', { correlationId: envelope['correlationId'], from: 'feature', ok: true })
    await pending
  })

  it('hides request envelopes from consumer handlers', async () => {
    const ctx = setup()
    const handler = jest.fn()
    ctx.handle.on('__hf:request', handler)
    ctx.handle.open()
    ctx.mock.triggerMessage('__hf:request', { correlationId: 'feature-1', from: 'feature', innerType: 'getHostInfo' })
    await flush()
    expect(handler).not.toHaveBeenCalled()
  })

  it('throws when registering a second handler for the same type', () => {
    const ctx = setup()
    ctx.handle.handle('getHostInfo', () => undefined)
    expect(() => ctx.handle.handle('getHostInfo', () => undefined)).toThrow("A handler for 'getHostInfo' is already registered.")
  })
})
