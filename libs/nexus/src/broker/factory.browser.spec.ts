import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { IAction } from '../types/action'
import type { ChannelHandle } from '../types/channel'
import type { IChannelContract } from '../types/contract'
import type { SecurityChannelOptions, SecurityProvider, SecurityWireChannel } from '../types/security'
import type { BrokerHandle, BrokerSettings, SecurityPolicy } from './types'
import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { ACTION_TYPES } from '../types/action'
import { createBroker } from './factory'

// why: the counter lives in the factory because the replacement stands as a module of its own and cannot reach the spec's scope. Nothing asserts where the sequence starts, only that two brokers differ.
jest.mock('@hyperfrontend/random-generator-utils', () => {
  let uuidCounter = 0
  return {
    uuidV4: () => {
      uuidCounter++
      return `12345678-1234-1234-1234-${String(uuidCounter).padStart(12, '0')}`
    },
    isUuidV4: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value),
  }
})

/** A broker window whose message listener the spec drives directly */
type Host = {
  /** The window handed to the broker */
  window: Window
  /** Hands a synthetic message event to every listener the broker registered */
  deliver: (event: { data: unknown; origin: string; source: Window | null }) => void
}

/** A broker wired to a fake host window and a secured, activated channel */
type SecuredSetup = {
  /** The broker under test */
  broker: BrokerHandle
  /** The fake host window and its delivery hook */
  host: Host
  /** The logger the broker writes to */
  logger: Logger
  /** The wire pipeline the provider handed to the channel transport */
  wire: SecurityWireChannel
  /** The counterpart window the channel targets */
  source: Window
  /** The channel carrying the transport */
  channel: ChannelHandle
  /** Feeds an opened packet carrying the action into the transport, as the pipeline would after opening a sealed frame */
  receiveOpened: (action: IAction) => void
}

describe('createBroker', () => {
  const mockContract: IChannelContract = {
    accepted: [{ type: 'test-action', description: 'Test action' }],
    emitted: [],
  }

  afterEach(() => {
    jest.clearAllMocks()
  })

  function createMockLogger(): Logger {
    return {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'debug'),
    } as unknown as Logger
  }

  function createHost(): Host {
    const listeners: EventListener[] = []
    const hostWindow = {
      addEventListener: jest.fn((_type: string, listener: EventListener) => {
        listeners.push(listener)
      }),
    } as unknown as Window
    return {
      window: hostWindow,
      deliver: (event) => {
        for (const listener of listeners) {
          listener(event as unknown as Event)
        }
      },
    }
  }

  function createWire(): SecurityWireChannel {
    return {
      label: 'wire',
      send: jest.fn(),
      receive: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
      hello: jest.fn(async () => new Uint8Array([1])),
      isHello: jest.fn(() => false),
      acceptHello: jest.fn(() => 'accepted'),
    }
  }

  function createProvider(wire: SecurityWireChannel = createWire(), capture?: (options: SecurityChannelOptions) => void): SecurityProvider {
    return {
      createChannel: jest.fn((_label: string, options: SecurityChannelOptions) => {
        capture?.(options)
        return wire
      }),
      protocolProvider: jest.fn(),
    }
  }

  function createTestBroker(settings: Partial<BrokerSettings> = {}, hostWindow?: Window): BrokerHandle {
    return createBroker({ name: 'test-broker', contract: mockContract, settings, window: hostWindow })
  }

  function peerAction(type: string, fields: Record<string, unknown> = {}): IAction {
    return { type, senderId: 'peer-1', ...fields } as IAction
  }

  function createSecuredSetup(options: { active: boolean; settings?: Partial<BrokerSettings> } = { active: true }): SecuredSetup {
    const host = createHost()
    const logger = createMockLogger()
    const wire = createWire()
    let wireOptions: SecurityChannelOptions | null = null
    const provider = createProvider(wire, (captured) => {
      wireOptions = captured
    })
    const broker = createTestBroker(
      { logLevel: 'debug', logger, security: { protocols: { v4: provider } }, ...options.settings },
      host.window
    )
    const source = { postMessage: jest.fn() } as unknown as Window
    const channel = broker.addChannel('test-channel', source)
    if (options.active) {
      channel.activate('https://app.example', mockContract, 'peer-1')
    }
    channel.attachSecurityTransport('v4', 'peer-1', 'initiator')
    return {
      broker,
      host,
      logger,
      wire,
      source,
      channel,
      receiveOpened: (action) => {
        wireOptions?.receive({
          origin: 'peer-1',
          target: broker.id,
          data: { pid: 'pid-1', id: 'id-1', sequence: 1, message: action, schema: {}, schemaHash: '' },
        })
      },
    }
  }

  describe('initialization', () => {
    it('creates a broker with the given name', () => {
      expect(createTestBroker().name).toBe('test-broker')
    })

    it('generates a unique id for each broker', () => {
      const broker1 = createBroker({ name: 'broker-1', contract: mockContract })
      const broker2 = createBroker({ name: 'broker-2', contract: mockContract })

      expect(broker1.id).not.toBe(broker2.id)
    })

    it('applies the default log level when none is provided', () => {
      expect(createTestBroker().logger.getLogLevel()).toBe('error')
    })

    it('merges custom settings with the defaults', () => {
      const broker = createTestBroker({ logLevel: 'debug', whitelist: ['https://trusted.com'] })

      expect({ level: broker.logger.getLogLevel(), whitelist: broker.settings.whitelist }).toEqual({
        level: 'debug',
        whitelist: ['https://trusted.com'],
      })
    })

    it('throws for an invalid broker name', () => {
      expect(() => createBroker({ name: '', contract: mockContract })).toThrow()
    })

    it('throws for an invalid contract', () => {
      expect(() => createBroker({ name: 'test-broker', contract: {} as unknown as IChannelContract })).toThrow()
    })

    it('listens for messages on the window it was given', () => {
      const host = createHost()

      createTestBroker({}, host.window)

      expect(host.window.addEventListener).toHaveBeenCalledWith('message', expect.any(Function))
    })
  })

  describe('properties', () => {
    it('exposes a non-empty string id', () => {
      const broker = createTestBroker()

      expect({ type: typeof broker.id, populated: broker.id.length > 0 }).toEqual({ type: 'string', populated: true })
    })

    it('exposes the settings', () => {
      expect(createTestBroker({ logLevel: 'debug' }).settings.logLevel).toBe('debug')
    })

    it('exposes the accepted action types', () => {
      expect(createTestBroker().acceptedActionTypes).toEqual(['test-action'])
    })

    it('starts without channels', () => {
      expect(createTestBroker().channels).toEqual([])
    })
  })

  describe('channel management', () => {
    it('adds a channel under the given name', () => {
      const broker = createTestBroker()

      const channel = broker.addChannel('test-channel', {} as Window)

      expect(channel.name).toBe('test-channel')
    })

    it('finds a channel by id', () => {
      const broker = createTestBroker()
      const channel = broker.addChannel('test-channel', {} as Window)

      expect(broker.getChannel(channel.id)).toBe(channel)
    })

    it('finds a channel by name', () => {
      const broker = createTestBroker()
      const channel = broker.addChannel('test-channel', {} as Window)

      expect(broker.getChannel('test-channel')).toBe(channel)
    })

    it('finds a channel by window', () => {
      const broker = createTestBroker()
      const mockWindow = {} as Window
      const channel = broker.addChannel('test-channel', mockWindow)

      expect(broker.getChannel(mockWindow)).toBe(channel)
    })

    it('returns null for an unknown channel', () => {
      expect(createTestBroker().getChannel('unknown')).toBeNull()
    })

    it('removes a channel', () => {
      const broker = createTestBroker()
      const channel = broker.addChannel('test-channel', {} as Window)

      broker.removeChannel(channel.id)

      expect(broker.getChannel(channel.id)).toBeNull()
    })

    it('tolerates removing an unknown channel', () => {
      const broker = createTestBroker()

      expect(() => {
        broker.removeChannel('non-existent-id')
        broker.removeChannel({} as Window)
      }).not.toThrow()
    })
  })

  describe('security policy', () => {
    it('stores the security policy', () => {
      const broker = createTestBroker()
      const policy: SecurityPolicy = () => true

      broker.setSecurityPolicy(policy)

      expect(broker.settings.securityPolicy).toBe(policy)
    })

    it('rejects a policy that is not a function', () => {
      expect(() => createTestBroker().setSecurityPolicy('not-a-function' as unknown as SecurityPolicy)).toThrow()
    })

    it('replaces an earlier policy', () => {
      const broker = createTestBroker()
      const policy2: SecurityPolicy = () => false

      broker.setSecurityPolicy(() => true)
      broker.setSecurityPolicy(policy2)

      expect(broker.settings.securityPolicy).toBe(policy2)
    })
  })

  describe('contract extension', () => {
    const extension: IChannelContract = {
      accepted: [{ type: 'new-action', description: 'New action' }],
      emitted: [],
    }

    it('extends the contract when enabled', () => {
      const broker = createTestBroker({ contractExtension: true })

      broker.extendContract(extension)

      expect(broker.acceptedActionTypes).toEqual(['test-action', 'new-action'])
    })

    it('throws when contract extension is disabled', () => {
      const broker = createTestBroker({ contractExtension: false })

      expect(() => broker.extendContract(extension)).toThrow('Original contract cannot be extended')
    })

    it('validates the extension contract', () => {
      const broker = createTestBroker({ contractExtension: true })

      expect(() => broker.extendContract({} as unknown as IChannelContract)).toThrow()
    })
  })

  describe('serialization', () => {
    it('serializes the broker properties', () => {
      const broker = createTestBroker({ logLevel: 'debug' })

      expect(broker.toJSON()).toEqual({
        id: broker.id,
        name: 'test-broker',
        settings: broker.settings,
        acceptedActionTypes: ['test-action'],
        channels: [],
      })
    })

    it('includes the channels', () => {
      const broker = createTestBroker()
      broker.addChannel('test-channel', {} as Window)

      expect(broker.toJSON()['channels']).toEqual([expect.objectContaining({ name: 'test-channel' })])
    })
  })

  describe('protocol management', () => {
    it('registers the v3 provider from the settings', () => {
      const broker = createTestBroker({ security: { protocols: { v3: createProvider() } } })

      expect(broker.hasProtocol('v3')).toBe(true)
    })

    it('registers the v4 provider from the settings', () => {
      const broker = createTestBroker({ security: { protocols: { v4: createProvider() } } })

      expect(broker.hasProtocol('v4')).toBe(true)
    })

    it('lists v4 before v3 whatever the order of the settings bag', () => {
      const broker = createTestBroker({ security: { protocols: { v3: createProvider(), v4: createProvider() } } })

      expect(broker.getSupportedProtocols()).toEqual(['v4', 'v3', 'none'])
    })

    it('registers only v3 when the bag has no v4', () => {
      const broker = createTestBroker({ security: { protocols: { v3: createProvider() } } })

      expect(broker.getSupportedProtocols()).toEqual(['v3', 'none'])
    })

    it('registers only v4 when the bag has no v3', () => {
      const broker = createTestBroker({ security: { protocols: { v4: createProvider() } } })

      expect(broker.getSupportedProtocols()).toEqual(['v4', 'none'])
    })

    it('supports only none when the security settings carry no protocols', () => {
      const broker = createTestBroker({ security: {} })

      expect(broker.getSupportedProtocols()).toEqual(['none'])
    })

    it('supports only none without security settings', () => {
      expect(createTestBroker().getSupportedProtocols()).toEqual(['none'])
    })

    it('reports unregistered protocols as unsupported', () => {
      const broker = createTestBroker()

      expect([broker.hasProtocol('v3'), broker.hasProtocol('v4')]).toEqual([false, false])
    })

    it('registers a provider manually', () => {
      const broker = createTestBroker()

      broker.registerProtocol('v4', createProvider())

      expect(broker.hasProtocol('v4')).toBe(true)
    })

    it('returns the broker for chaining when registering', () => {
      const broker = createTestBroker()

      expect(broker.registerProtocol('v4', createProvider())).toBe(broker)
    })

    it('unregisters a provider', () => {
      const broker = createTestBroker({ security: { protocols: { v4: createProvider() } } })

      broker.unregisterProtocol('v4')

      expect(broker.hasProtocol('v4')).toBe(false)
    })

    it('returns the broker for chaining when unregistering', () => {
      const broker = createTestBroker({ security: { protocols: { v4: createProvider() } } })

      expect(broker.unregisterProtocol('v4')).toBe(broker)
    })

    it('orders the supported protocols v4, v3, other registrations in order, then none', () => {
      const broker = createTestBroker({ security: { protocols: { v3: createProvider() } } })

      broker
        .registerProtocol('custom-a', createProvider())
        .registerProtocol('v4', createProvider())
        .registerProtocol('custom-b', createProvider())

      expect(broker.getSupportedProtocols()).toEqual(['v4', 'v3', 'custom-a', 'custom-b', 'none'])
    })

    it('hands the registered provider to channels that attach a transport', () => {
      const provider = createProvider()
      const broker = createTestBroker({ security: { protocols: { v4: provider } } })
      const channel = broker.addChannel('test-channel', {} as Window)

      channel.attachSecurityTransport('v4', 'peer-1', 'initiator')

      expect(provider.createChannel).toHaveBeenCalledWith(
        'test-channel',
        expect.objectContaining({ session: { protocol: 'v4', role: 'initiator', localId: broker.id, peerId: 'peer-1' } })
      )
    })

    it('looks the provider up at attach time, so a later registration serves existing channels', () => {
      const broker = createTestBroker()
      const channel = broker.addChannel('test-channel', {} as Window)

      broker.registerProtocol('v3', createProvider())

      expect(channel.attachSecurityTransport('v3', 'peer-1', 'responder')).toBe(true)
    })

    it('refuses to attach a transport for an unregistered protocol', () => {
      const channel = createTestBroker().addChannel('test-channel', {} as Window)

      expect(channel.attachSecurityTransport('v4', 'peer-1', 'initiator')).toBe(false)
    })
  })

  describe('message handling', () => {
    const userMessage = peerAction(ACTION_TYPES.NEW_MESSAGE, { data: { type: 'test-action', data: 'hello' } })

    function createPlainSetup(settings: Partial<BrokerSettings>) {
      const host = createHost()
      const logger = createMockLogger()
      const broker = createTestBroker({ logLevel: 'debug', logger, ...settings }, host.window)
      const source = { postMessage: jest.fn() } as unknown as Window
      const channel = broker.addChannel('test-channel', source)
      channel.activate('https://app.example', mockContract, 'peer-1')
      const onMessage = jest.fn()
      channel.onMessage(onMessage)
      return { host, logger, broker, source, onMessage }
    }

    it('ignores messages from blacklisted origins', () => {
      const { host, logger, source, onMessage } = createPlainSetup({ blacklist: ['https://app.example'] })

      host.deliver({ data: userMessage, origin: 'https://app.example', source })

      expect({ logged: (logger.info as Mock).mock.calls, delivered: onMessage.mock.calls }).toEqual({
        logged: [['test-broker ignored message from https://app.example']],
        delivered: [],
      })
    })

    it('ignores messages from origins outside the whitelist', () => {
      const { host, logger, source, onMessage } = createPlainSetup({ whitelist: ['https://trusted.example'] })

      host.deliver({ data: userMessage, origin: 'https://app.example', source })

      expect({ logged: (logger.info as Mock).mock.calls, delivered: onMessage.mock.calls }).toEqual({
        logged: [['test-broker ignored message from https://app.example']],
        delivered: [],
      })
    })

    it('routes plaintext actions from admitted origins to the handlers', () => {
      const { host, source, onMessage } = createPlainSetup({ whitelist: ['https://app.example'] })

      host.deliver({ data: userMessage, origin: 'https://app.example', source })

      expect(onMessage).toHaveBeenCalledWith({ type: 'test-action', data: 'hello' })
    })

    it('ignores wire frames from windows without a channel', () => {
      const host = createHost()
      const logger = createMockLogger()
      createTestBroker({ logLevel: 'debug', logger }, host.window)

      host.deliver({ data: new Uint8Array([9]), origin: 'https://app.example', source: { postMessage: jest.fn() } as unknown as Window })

      expect(logger.info).toHaveBeenCalledWith('test-broker ignored a wire frame - no channel for the source window')
    })

    it('routes wire frames to the channel transport without gating them as plaintext', () => {
      const { host, wire, source, channel } = createSecuredSetup()
      const invalidHandler = jest.fn()
      channel.on('invalid', invalidHandler)

      host.deliver({ data: new Uint8Array([9]), origin: 'https://app.example', source })

      expect({ received: (wire.receive as Mock).mock.calls, invalid: invalidHandler.mock.calls }).toEqual({
        received: [[new Uint8Array([9])]],
        invalid: [],
      })
    })

    it('drops plaintext actions for a secured channel before the handlers see them', () => {
      const { host, source, channel } = createSecuredSetup()
      const onMessage = jest.fn()
      channel.onMessage(onMessage)

      host.deliver({ data: userMessage, origin: 'https://app.example', source })

      expect(onMessage).not.toHaveBeenCalled()
    })

    it('reports a dropped plaintext action through the invalid event', () => {
      const { host, source, channel } = createSecuredSetup()
      const invalidHandler = jest.fn()
      channel.on('invalid', invalidHandler)

      host.deliver({ data: userMessage, origin: 'https://app.example', source })

      expect(invalidHandler).toHaveBeenCalledWith(
        { error: "Dropped plaintext '[nexus] new-message' action: the channel is secured.", action: userMessage },
        expect.anything()
      )
    })

    it('lets handshake actions through the gate on a secured channel', () => {
      const { host, source } = createSecuredSetup({ active: false })

      host.deliver({ data: peerAction(ACTION_TYPES.CANCEL_CONNECTION, { processId: 'process-9' }), origin: 'https://app.example', source })

      expect(source.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: ACTION_TYPES.CANCEL_CONNECTION_ACKNOWLEDGED, processId: 'process-9' }),
        '*'
      )
    })

    it('dispatches opened actions to the handlers past the plaintext gate', () => {
      const { channel, receiveOpened } = createSecuredSetup()
      const onMessage = jest.fn()
      channel.onMessage(onMessage)

      receiveOpened(peerAction(ACTION_TYPES.NEW_MESSAGE, { data: { type: 'test-action', data: 'sealed hello' } }))

      expect(onMessage).toHaveBeenCalledWith({ type: 'test-action', data: 'sealed hello' })
    })

    it('dispatches opened actions with the counterpart window as their source', () => {
      const { channel, receiveOpened } = createSecuredSetup()
      const invalidHandler = jest.fn()
      channel.on('invalid', invalidHandler)

      receiveOpened(peerAction(ACTION_TYPES.NEW_MESSAGE, { data: { type: 'test-action', data: 'sealed hello' } }))

      expect(invalidHandler).not.toHaveBeenCalled()
    })
  })
})
