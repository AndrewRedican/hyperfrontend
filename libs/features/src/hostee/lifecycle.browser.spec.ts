import type { BrokerHandle, ChannelHandle } from '@hyperfrontend/nexus'
import type { FeatureContract } from '../shared/types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { ControlType } from '../shared/control'
import { createEventEmitter } from '../shared/event-emitter'
import { installResizeObserverStub } from '../testing/resize-observer-stub'
import { createFeatureHandle, resolveHostWindow } from './lifecycle'

// note: Intervals hand back their own delay as the handle, so a test can say which timer it means: the heartbeat's beat and the visibility watch's poll both run while a feature is open.
jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setInterval: jest.fn((callback: () => void, delay: number) => {
    callback()
    return delay
  }),
  clearInterval: jest.fn(),
  // note: Request timeouts never fire here — timeout behaviour is covered by the shared request peer spec.
  setTimeout: jest.fn(() => 1),
  clearTimeout: jest.fn(),
  requestAnimationFrame: jest.fn(() => 1),
  cancelAnimationFrame: jest.fn(),
}))

jest.mock('@hyperfrontend/network-protocol/browser/v1', () => ({ createProtocol: jest.fn(() => 'v1-provider') }))
jest.mock('@hyperfrontend/network-protocol/browser/v2', () => ({ createProtocol: jest.fn(() => 'v2-provider') }))

beforeEach(() => {
  jest.clearAllMocks()
  installResizeObserverStub()
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

function createMockBroker(channel: ChannelHandle): { broker: BrokerHandle; addChannel: jest.Mock; registerProtocol: jest.Mock } {
  const addChannel = jest.fn(() => channel)
  const registerProtocol = jest.fn()
  return { broker: <BrokerHandle>(<unknown>{ addChannel, registerProtocol, logger: { id: 'logger' } }), addChannel, registerProtocol }
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
  // note: A schema-free contract keeps payload validation inert here; the schema paths are covered by the payload validation block below.
  const emptyContract: FeatureContract = { emitted: [], accepted: [] }

  it('adds a host channel against the resolved host window', () => {
    const mock = createMockChannel()
    const { broker, addChannel } = createMockBroker(mock.channel)
    createFeatureHandle(broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    expect(addChannel).toHaveBeenCalledWith('host', hostWindow, { contractCompat: expect.any(Function) })
  })

  it('applies the contract-version compatibility rule to the host channel', () => {
    const mock = createMockChannel()
    const { broker, addChannel } = createMockBroker(mock.channel)
    createFeatureHandle(broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    const settings = <{ contractCompat: (own: unknown, peer: unknown) => unknown }>addChannel.mock.calls[0][2]
    expect(
      settings.contractCompat({ emitted: [], accepted: [], version: '1.0.0' }, { emitted: [], accepted: [], version: '2.0.0' })
    ).toEqual({ compatible: false, reason: expect.stringContaining('2.0.0') })
  })

  it('connects the channel during assembly', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    expect(mock.connect).toHaveBeenCalledTimes(1)
  })

  it('passes the ready timeout to the channel as the connect deadline', () => {
    const mock = createMockChannel()
    const { broker, addChannel } = createMockBroker(mock.channel)
    createFeatureHandle(broker, hostWindow, createEventEmitter(), { contract: emptyContract, readyTimeoutMs: 4000 })
    expect(addChannel).toHaveBeenCalledWith('host', hostWindow, { contractCompat: expect.any(Function), connectTimeoutMs: 4000 })
  })

  it('passes the v1 security settings into the host channel', () => {
    const mock = createMockChannel()
    const { broker, addChannel } = createMockBroker(mock.channel)
    createFeatureHandle(broker, hostWindow, createEventEmitter(), { contract: emptyContract, protocol: 'v1' })
    expect(addChannel).toHaveBeenCalledWith('host', hostWindow, { contractCompat: expect.any(Function), security: { protocol: 'v1' } })
  })

  it('registers the v2 provider pairing the wire pipeline with the protocol', () => {
    const mock = createMockChannel()
    const { broker, registerProtocol } = createMockBroker(mock.channel)
    createFeatureHandle(broker, hostWindow, createEventEmitter(), { contract: emptyContract, protocol: 'v2', sharedKey: 'secret' })
    expect(registerProtocol).toHaveBeenCalledWith('v2', { createChannel: expect.any(Function), protocolProvider: 'v2-provider' })
  })

  it('passes the v2 security settings carrying the shared key into the host channel', () => {
    const mock = createMockChannel()
    const { broker, addChannel } = createMockBroker(mock.channel)
    createFeatureHandle(broker, hostWindow, createEventEmitter(), { contract: emptyContract, protocol: 'v2', sharedKey: 'secret' })
    expect(addChannel).toHaveBeenCalledWith('host', hostWindow, {
      contractCompat: expect.any(Function),
      security: { protocol: 'v2', sharedKey: 'secret' },
    })
  })

  it('combines security settings with the connect deadline', () => {
    const mock = createMockChannel()
    const { broker, addChannel } = createMockBroker(mock.channel)
    createFeatureHandle(broker, hostWindow, createEventEmitter(), { contract: emptyContract, protocol: 'v1', readyTimeoutMs: 4000 })
    expect(addChannel).toHaveBeenCalledWith('host', hostWindow, {
      contractCompat: expect.any(Function),
      security: { protocol: 'v1' },
      connectTimeoutMs: 4000,
    })
  })

  it('throws before adding the channel when the v2 protocol has no shared key', () => {
    const mock = createMockChannel()
    const { broker } = createMockBroker(mock.channel)
    expect(() => createFeatureHandle(broker, hostWindow, createEventEmitter(), { contract: emptyContract, protocol: 'v2' })).toThrow(
      'Security protocol \'v2\' requires a pre-shared key: set the "sharedKey" option to a non-empty string.'
    )
  })

  it('registers no protocol when security is not selected', () => {
    const mock = createMockChannel()
    const { broker, registerProtocol } = createMockBroker(mock.channel)
    createFeatureHandle(broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    expect(registerProtocol).not.toHaveBeenCalled()
  })

  it('rejects pending ready() promises when the channel times out', async () => {
    const mock = createMockChannel()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    const pending = handle.ready()
    mock.trigger('connect-timeout', { elapsedMs: 10_000 })
    await expect(pending).rejects.toThrow('did not open the connection within 10000ms')
  })

  it('emits a distinguishable error when the channel times out', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const errors: unknown[] = []
    emitter.on('error', (data) => errors.push(data))
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.trigger('connect-timeout', { elapsedMs: 10_000 })
    expect(errors).toEqual([{ reason: 'ready-timeout', elapsedMs: 10_000 }])
  })

  it('emits open when the channel opens', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('open', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.trigger('open')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('emits close when the channel closes', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('close', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.trigger('close')
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('emits error when the channel denies the connection', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('error', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.trigger('deny', { reason: 'origin' })
    expect(handler).toHaveBeenCalledWith({ reason: 'origin' })
  })

  it('emits error when the channel reports an invalid message', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('error', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.trigger('invalid', { reason: 'schema' })
    expect(handler).toHaveBeenCalledWith({ reason: 'schema' })
  })

  it('re-emits host messages keyed by action type', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const handler = jest.fn()
    emitter.on('setTimezone', handler)
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.triggerMessage('setTimezone', { tz: 'UTC' })
    expect(handler).toHaveBeenCalledWith({ tz: 'UTC' })
  })

  it('sends messages through the channel', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract }).send('ping', {
      n: 1,
    })
    expect(mock.send).toHaveBeenCalledWith('ping', { n: 1 })
  })

  it('disconnects the channel on close', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract }).close()
    expect(mock.disconnect).toHaveBeenCalledTimes(1)
  })

  it('subscribes via the shared emitter', () => {
    const mock = createMockChannel()
    const handler = jest.fn()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    handle.on('timeUpdated', handler)
    mock.triggerMessage('timeUpdated', { time: 1 })
    expect(handler).toHaveBeenCalledWith({ time: 1 })
  })

  it('resolves ready immediately when already open', async () => {
    const mock = createMockChannel()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.trigger('open')
    await expect(handle.ready()).resolves.toBeUndefined()
  })

  it('resolves ready once the channel opens later', async () => {
    const mock = createMockChannel()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    const pending = handle.ready()
    mock.trigger('open')
    await expect(pending).resolves.toBeUndefined()
  })

  it('does not add a channel when no host window is resolved', () => {
    const mock = createMockChannel()
    const { broker, addChannel } = createMockBroker(mock.channel)
    createFeatureHandle(broker, null, createEventEmitter(), { contract: emptyContract })
    expect(addChannel).not.toHaveBeenCalled()
  })

  it('treats send as a no-op when unembedded', () => {
    const handle = createFeatureHandle(createMockBroker(createMockChannel().channel).broker, null, createEventEmitter(), {
      contract: emptyContract,
    })
    expect(() => handle.send('ping')).not.toThrow()
  })

  it('treats close as a no-op when unembedded', () => {
    const handle = createFeatureHandle(createMockBroker(createMockChannel().channel).broker, null, createEventEmitter(), {
      contract: emptyContract,
    })
    expect(() => handle.close()).not.toThrow()
  })

  it('treats setDirty as a no-op when unembedded', () => {
    const handle = createFeatureHandle(createMockBroker(createMockChannel().channel).broker, null, createEventEmitter(), {
      contract: emptyContract,
    })
    expect(() => handle.setDirty(true)).not.toThrow()
  })

  it('starts the heartbeat when the host channel opens', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.trigger('open')
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 1000)
  })

  it('stops the heartbeat when the host channel closes', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.trigger('open')
    mock.trigger('close')
    expect(clearInterval).toHaveBeenCalledWith(1000)
  })

  it('sends a beat through the channel once running', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.trigger('open')
    expect(mock.send).toHaveBeenCalledWith(ControlType.Beat)
  })

  it('reports its page visibility when the host channel opens', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.trigger('open')
    expect(mock.send).toHaveBeenCalledWith(ControlType.Visibility, { hidden: false })
  })

  it('stops reporting visibility when the host channel closes', () => {
    const mock = createMockChannel()
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    mock.trigger('open')
    mock.trigger('close')
    mock.send.mockClear()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(mock.send).not.toHaveBeenCalledWith(ControlType.Visibility, expect.anything())
  })

  it('re-emits the closing notice so the app can flush before the close completes', () => {
    const mock = createMockChannel()
    const emitter = createEventEmitter()
    const closings: unknown[] = []
    emitter.on('closing', (data) => closings.push(data))
    createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
    mock.trigger('closing', { initiatedLocally: false })
    expect(closings).toEqual([{ initiatedLocally: false }])
  })

  it('sends the dirty declaration through the control plane', () => {
    const mock = createMockChannel()
    const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
    handle.setDirty(true)
    expect(mock.send).toHaveBeenCalledWith(ControlType.Dirty, { dirty: true })
    handle.setDirty(false)
    expect(mock.send).toHaveBeenCalledWith(ControlType.Dirty, { dirty: false })
  })

  describe('hosted', () => {
    it('reports hosted when a host window is resolved', () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
        contract: emptyContract,
      })
      expect(handle.hosted).toBe(true)
    })

    it('reads identically before ready() is awaited and after the channel opens', async () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
        contract: emptyContract,
      })
      const beforeReady = handle.hosted
      mock.trigger('open')
      await handle.ready()
      expect([beforeReady, handle.hosted]).toEqual([true, true])
    })

    it('stays true when the host never opens the connection', () => {
      const mock = createMockChannel()
      const emitter = createEventEmitter()
      const errors: unknown[] = []
      emitter.on('error', (data) => errors.push(data))
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract: emptyContract })
      mock.trigger('connect-timeout', { elapsedMs: 10_000 })
      expect({ hosted: handle.hosted, errors }).toEqual({ hosted: true, errors: [{ reason: 'ready-timeout', elapsedMs: 10_000 }] })
    })

    it('reports unhosted with no display mode when no host window is resolved', () => {
      const handle = createFeatureHandle(createMockBroker(createMockChannel().channel).broker, null, createEventEmitter(), {
        contract: emptyContract,
      })
      expect({ hosted: handle.hosted, displayMode: handle.displayMode }).toEqual({ hosted: false, displayMode: null })
    })

    it('leaves ready() pending while unhosted', async () => {
      const handle = createFeatureHandle(createMockBroker(createMockChannel().channel).broker, null, createEventEmitter(), {
        contract: emptyContract,
      })
      const settled = jest.fn()
      void handle.ready().then(settled, settled)
      await createPromise<void>((resolve) => {
        setTimeout(resolve, 0)
      })
      expect(settled).not.toHaveBeenCalled()
    })
  })

  describe('payload validation', () => {
    // note: Feature-oriented contract — emitted is what the feature sends; the schemas exercise both validation directions.
    const contract = {
      emitted: [
        { type: 'timeUpdated', schema: { type: 'object', properties: { iso: { type: 'string' } }, required: ['iso'] } },
        { type: 'reset' },
      ],
      accepted: [{ type: 'setTimezone', schema: { type: 'object', properties: { tz: { type: 'string' } }, required: ['tz'] } }],
    }

    it('throws in the feature frame when a send payload violates the emitted schema', () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract })
      expect(() => handle.send('timeUpdated', {})).toThrow("Invalid payload for action 'timeUpdated'")
    })

    it('keeps a schema-violating payload off the channel', () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract })
      expect(() => handle.send('timeUpdated', {})).toThrow()
      expect(mock.send).not.toHaveBeenCalled()
    })

    it('sends a schema-valid payload through the channel', () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract })
      handle.send('timeUpdated', { iso: '2026-07-26T00:00:00Z' })
      expect(mock.send).toHaveBeenCalledWith('timeUpdated', { iso: '2026-07-26T00:00:00Z' })
    })

    it('sends a schema-less action payload through unchanged', () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract })
      handle.send('reset', { anything: true })
      expect(mock.send).toHaveBeenCalledWith('reset', { anything: true })
    })

    it('drops an incoming payload that violates the accepted schema', () => {
      const mock = createMockChannel()
      const emitter = createEventEmitter()
      const handler = jest.fn()
      emitter.on('setTimezone', handler)
      createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract })
      mock.triggerMessage('setTimezone', { tz: 42 })
      expect(handler).not.toHaveBeenCalled()
    })

    it('surfaces a dropped incoming payload as an invalid-payload error', () => {
      const mock = createMockChannel()
      const emitter = createEventEmitter()
      const handler = jest.fn()
      emitter.on('error', handler)
      createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract })
      mock.triggerMessage('setTimezone', {})
      expect(handler).toHaveBeenCalledWith({
        reason: 'invalid-payload',
        type: 'setTimezone',
        errors: [expect.objectContaining({ message: 'Missing required property: tz' })],
      })
    })

    it('delivers a schema-valid incoming payload to subscribers', () => {
      const mock = createMockChannel()
      const emitter = createEventEmitter()
      const handler = jest.fn()
      emitter.on('setTimezone', handler)
      createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract })
      mock.triggerMessage('setTimezone', { tz: 'UTC' })
      expect(handler).toHaveBeenCalledWith({ tz: 'UTC' })
    })

    it('leaves control traffic outside payload validation', () => {
      const mock = createMockChannel()
      const emitter = createEventEmitter()
      const handler = jest.fn()
      emitter.on('error', handler)
      createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, emitter, { contract })
      mock.triggerMessage(ControlType.Response, { correlationId: 'nope', from: 'host', ok: true })
      expect(handler).not.toHaveBeenCalled()
    })
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
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
        contract: emptyContract,
      })
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
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
        contract: emptyContract,
      })
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
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
        contract: emptyContract,
      })
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
      const handle = createFeatureHandle(createMockBroker(createMockChannel().channel).broker, null, createEventEmitter(), {
        contract: emptyContract,
      })
      await expect(handle.request('getSettings')).rejects.toThrow(
        "Cannot send request 'getSettings': the feature is not connected to a host."
      )
    })

    it('rejects pending requests when the host channel closes', async () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
        contract: emptyContract,
      })
      const pending = handle.request('getSettings')
      mock.trigger('close')
      await expect(pending).rejects.toThrow('The host channel closed before the host responded.')
    })

    it('answers host requests through a registered handler', async () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
        contract: emptyContract,
      })
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
      createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), { contract: emptyContract })
      mock.triggerMessage(ControlType.Request, { correlationId: 'host-1', from: 'host', innerType: 'missing' })
      await flush()
      expect(mock.send).toHaveBeenCalledWith(
        ControlType.Response,
        expect.objectContaining({ ok: false, error: "No handler is registered for 'missing'." })
      )
    })

    it('ignores the echo of its own request envelope', async () => {
      const mock = createMockChannel()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
        contract: emptyContract,
      })
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
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
        contract: emptyContract,
      })
      handle.on(ControlType.Response, handler)
      mock.triggerMessage(ControlType.Response, { correlationId: 'nope', from: 'host', ok: true })
      expect(handler).not.toHaveBeenCalled()
    })

    it('hides heartbeat control echoes from consumer handlers', () => {
      const mock = createMockChannel()
      const handler = jest.fn()
      const handle = createFeatureHandle(createMockBroker(mock.channel).broker, hostWindow, createEventEmitter(), {
        contract: emptyContract,
      })
      handle.on(ControlType.Beat, handler)
      mock.triggerMessage(ControlType.Beat)
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
