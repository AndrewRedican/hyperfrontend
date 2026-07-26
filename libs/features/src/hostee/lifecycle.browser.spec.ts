import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { ControlType } from '../shared/control'
import { createEventEmitter } from '../shared/event-emitter'
import { createFeatureHandle, resolveHostWindow } from './lifecycle'

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setInterval: jest.fn((callback: () => void) => {
    callback()
    return 1
  }),
  clearInterval: jest.fn(),
  // note: Request timeouts never fire here — timeout behaviour is covered by the shared request peer spec.
  setTimeout: jest.fn(() => 1),
  clearTimeout: jest.fn(),
}))

class ResizeObserverStub {
  observe() {
    return undefined
  }
  unobserve() {
    return undefined
  }
  disconnect() {
    return undefined
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverStub, configurable: true, writable: true })
})

interface MockChannel {
  channel: ChannelHandle
  trigger(event: string, data?: unknown): void
  triggerMessage(type: string, data?: unknown): void
  send: jest.Mock
  disconnect: jest.Mock
  connect: jest.Mock
}

function createMockChannel(): MockChannel {
  const listeners: Record<string, Array<(data?: unknown) => void>> = {}
  const messageHandlers: Array<(message: { type: string; data?: unknown }) => void> = []
  const send = jest.fn()
  const disconnect = jest.fn()
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
    connect,
  })
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    triggerMessage: (type, data) => messageHandlers.forEach((handler) => handler({ type, data })),
    send,
    disconnect,
    connect,
  }
}

function createMockBroker(channel: ChannelHandle): { broker: BrokerHandle; addChannel: jest.Mock } {
  const addChannel = jest.fn(() => channel)
  return { broker: <BrokerHandle>(<unknown>{ addChannel }), addChannel }
}

describe('resolveHostWindow', () => {
  it('returns the parent window when embedded in an iframe', () => {
    const parent = <Window>(<unknown>{ name: 'parent' })
    expect(resolveHostWindow(<Window>(<unknown>{ parent, opener: null }))).toBe(parent)
  })

  it('returns the opener window when launched as a popup', () => {
    const opener = <Window>(<unknown>{ name: 'opener' })
    const win = <Window>(<unknown>{ opener })
    Object.assign(win, { parent: win })
    expect(resolveHostWindow(win)).toBe(opener)
  })

  it('returns null when running at the top level', () => {
    const win = <Window>(<unknown>{ opener: null })
    Object.assign(win, { parent: win })
    expect(resolveHostWindow(win)).toBeNull()
  })
})

describe('createFeatureHandle', () => {
  const hostWindow = <Window>(<unknown>{ name: 'host' })

  it('adds a host channel against the resolved host window', () => {
    const mock = createMockChannel()
    const { broker, addChannel } = createMockBroker(mock.channel)
    createFeatureHandle(broker, hostWindow, createEventEmitter())
    expect(addChannel).toHaveBeenCalledWith('host', hostWindow, {})
  })

  it('connects the channel during assembly', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
    expect(mock.connect).toHaveBeenCalledTimes(1)
  })

  it('passes the ready timeout to the channel as the connect deadline', () => {
    const mock = createMockChannel()
    const { broker, addChannel } = createMockBroker(mock.channel)
    createFeatureHandle(broker, hostWindow, createEventEmitter(), { readyTimeoutMs: 4000 })
    expect(addChannel).toHaveBeenCalledWith('host', hostWindow, { connectTimeoutMs: 4000 })
  })

  it('rejects pending ready() promises when the channel times out', async () => {
    const mock = createMockChannel()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
    const pending = handle.ready()
    mock.trigger('connect-timeout', { elapsedMs: 10_000 })
    await expect(pending).rejects.toThrow('did not open the connection within 10000ms')
  })

  it('emits a distinguishable error when the channel times out', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const errors: unknown[] = []
    emitter.on('error', (data) => errors.push(data))
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter)
    mock.trigger('connect-timeout', { elapsedMs: 10_000 })
    expect(errors).toEqual([{ reason: 'ready-timeout', elapsedMs: 10_000 }])
  })

  it('emits open when the channel opens', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('open', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter)
    mock.trigger('open')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('emits close when the channel closes', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('close', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter)
    mock.trigger('close')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('emits error when the channel denies the connection', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('error', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter)
    mock.trigger('deny', { reason: 'origin' })
    expect(handler).toHaveBeenCalledWith({ reason: 'origin' })
  })

  it('emits error when the channel reports an invalid message', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('error', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter)
    mock.trigger('invalid', { reason: 'schema' })
    expect(handler).toHaveBeenCalledWith({ reason: 'schema' })
  })

  it('re-emits host messages keyed by action type', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('setTimezone', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter)
    mock.triggerMessage('setTimezone', { tz: 'UTC' })
    expect(handler).toHaveBeenCalledWith({ tz: 'UTC' })
  })

  it('sends messages through the channel', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter()).send('ping', { n: 1 })
    expect(mock.send).toHaveBeenCalledWith('ping', { n: 1 })
  })

  it('disconnects the channel on close', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter()).close()
    expect(mock.disconnect).toHaveBeenCalledTimes(1)
  })

  it('subscribes via the shared emitter', () => {
    const mock = createMockChannel()
    const handler = jest.fn()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
    handle.on('timeUpdated', handler)
    mock.triggerMessage('timeUpdated', { time: 1 })
    expect(handler).toHaveBeenCalledWith({ time: 1 })
  })

  it('resolves ready immediately when already open', async () => {
    const mock = createMockChannel()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
    mock.trigger('open')
    await expect(handle.ready()).resolves.toBeUndefined()
  })

  it('resolves ready once the channel opens later', async () => {
    const mock = createMockChannel()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
    const pending = handle.ready()
    mock.trigger('open')
    await expect(pending).resolves.toBeUndefined()
  })

  it('does not add a channel when no host window is resolved', () => {
    const mock = createMockChannel()
    const { broker, addChannel } = createMockBroker(mock.channel)
    createFeatureHandle(broker, null, createEventEmitter())
    expect(addChannel).not.toHaveBeenCalled()
  })

  it('treats send as a no-op when unembedded', () => {
    const handle = createFeatureHandle(createMockBroker(createMockChannel().channel).broker, null, createEventEmitter())
    expect(() => handle.send('ping')).not.toThrow()
  })

  it('treats close as a no-op when unembedded', () => {
    const handle = createFeatureHandle(createMockBroker(createMockChannel().channel).broker, null, createEventEmitter())
    expect(() => handle.close()).not.toThrow()
  })

  it('starts the heartbeat when the host channel opens', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
    mock.trigger('open')
    expect(setInterval).toHaveBeenCalledTimes(1)
  })

  it('stops the heartbeat when the host channel closes', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
    mock.trigger('open')
    mock.trigger('close')
    expect(clearInterval).toHaveBeenCalledTimes(1)
  })

  it('sends a beat through the channel once running', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
    mock.trigger('open')
    expect(mock.send).toHaveBeenCalledWith(ControlType.Beat)
  })

  it('announces its content size when the host channel opens', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
    mock.trigger('open')
    expect(mock.send).toHaveBeenCalledWith(ControlType.Size, expect.objectContaining({ height: expect.any(Number) }))
  })

  describe('request/response', () => {
    function flush() {
      return createPromise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
    }

    function sentEnvelope(send: jest.Mock, index = 0): Record<string, unknown> {
      const call = send.mock.calls[index]
      if (!call) {
        throw createError(`expected a sent envelope at index ${index}`)
      }
      return <Record<string, unknown>>call[1]
    }

    it('sends a correlated request envelope to the host', async () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
      const pending = handle.request('getSettings', { keys: ['locale'] })
      expect(mock.send).toHaveBeenCalledWith(
        ControlType.Request,
        expect.objectContaining({
          correlationId: expect.any(String),
          from: 'feature',
          innerType: 'getSettings',
          payload: { keys: ['locale'] },
        })
      )
      mock.triggerMessage(ControlType.Response, { correlationId: sentEnvelope(mock.send)['correlationId'], from: 'host', ok: true })
      await pending
    })

    it('resolves a request when the host responds', async () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
      const pending = handle.request('getSettings')
      mock.triggerMessage(ControlType.Response, {
        correlationId: sentEnvelope(mock.send)['correlationId'],
        from: 'host',
        ok: true,
        payload: { locale: 'en-US' },
      })
      await expect(pending).resolves.toEqual({ locale: 'en-US' })
    })

    it('rejects a request when the host responds with an error', async () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
      const pending = handle.request('getSettings')
      mock.triggerMessage(ControlType.Response, {
        correlationId: sentEnvelope(mock.send)['correlationId'],
        from: 'host',
        ok: false,
        error: 'settings unavailable',
      })
      await expect(pending).rejects.toThrow('settings unavailable')
    })

    it('rejects a request immediately when unembedded', async () => {
      const handle = createFeatureHandle(createMockBroker(createMockChannel().channel).broker, null, createEventEmitter())
      await expect(handle.request('getSettings')).rejects.toThrow(
        "Cannot send request 'getSettings': the feature is not connected to a host."
      )
    })

    it('rejects pending requests when the host channel closes', async () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
      const pending = handle.request('getSettings')
      mock.trigger('close')
      await expect(pending).rejects.toThrow('The host channel closed before the host responded.')
    })

    it('answers host requests through a registered handler', async () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
      handle.handle('getTime', () => '12:00')
      mock.triggerMessage(ControlType.Request, { correlationId: 'host-1', from: 'host', innerType: 'getTime' })
      await flush()
      expect(mock.send).toHaveBeenCalledWith(
        ControlType.Response,
        expect.objectContaining({ correlationId: 'host-1', from: 'feature', innerType: 'getTime', ok: true, payload: '12:00' })
      )
    })

    it('responds with an error when the feature has no handler', async () => {
      const mock = createMockChannel()
      createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
      mock.triggerMessage(ControlType.Request, { correlationId: 'host-1', from: 'host', innerType: 'missing' })
      await flush()
      expect(mock.send).toHaveBeenCalledWith(
        ControlType.Response,
        expect.objectContaining({ ok: false, error: "No handler is registered for 'missing'." })
      )
    })

    it('ignores the echo of its own request envelope', async () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
      const pending = handle.request('getSettings')
      const envelope = sentEnvelope(mock.send)
      mock.triggerMessage(ControlType.Request, envelope)
      await flush()
      expect(mock.send).toHaveBeenCalledTimes(1)
      mock.triggerMessage(ControlType.Response, { correlationId: envelope['correlationId'], from: 'host', ok: true })
      await pending
    })

    it('hides response envelopes from consumer handlers', () => {
      const mock = createMockChannel()
      const handler = jest.fn()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
      handle.on(ControlType.Response, handler)
      mock.triggerMessage(ControlType.Response, { correlationId: 'nope', from: 'host', ok: true })
      expect(handler).not.toHaveBeenCalled()
    })

    it('hides heartbeat control echoes from consumer handlers', () => {
      const mock = createMockChannel()
      const handler = jest.fn()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter())
      handle.on(ControlType.Beat, handler)
      mock.triggerMessage(ControlType.Beat)
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
