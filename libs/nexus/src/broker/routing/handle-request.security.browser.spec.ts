import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { ChannelSecurityDependencies } from '../../channel/types'
import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { IChannelContract } from '../../types/contract'
import type { SecurityProtocolVersion, SecurityProvider, SecurityWireChannel } from '../../types/security'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { after as afterAll, afterEach, before as beforeAll, beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleRequest } from './handle-request'

describe('handleRequest security negotiation', () => {
  const ownContract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message', required: true }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  const peerContract: IChannelContract = {
    accepted: [{ type: 'response-message' }],
    emitted: [{ type: 'test-message' }],
  }

  const offerV4 = { supported: ['v4', 'none'], preferred: 'v4' }
  const offerV3 = { supported: ['v3', 'none'], preferred: 'v3' }
  const offerBoth = { supported: ['v4', 'v3', 'none'], preferred: 'v4' }
  const offerNone = { supported: ['none'], preferred: 'none' }
  const missingProviderWarning = "test-broker has no working provider for the negotiated 'v4' protocol."

  let mockLogger: Logger
  let mockBrokerState: BrokerState

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let mockActions: ReturnType<typeof createActionCreators>
  let mockWindow: Window
  let wire: SecurityWireChannel
  let provider: SecurityProvider
  let security: ChannelSecurityDependencies
  let routingContext: RoutingContext

  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'debug'),
    } as unknown as Logger

    mockBrokerState = {
      id: 'broker-1',
      name: 'test-broker',
      window: global.window as Window,
      contract: ownContract,
      settings: {
        contract: ownContract,
      },
      logger: mockLogger,
    }

    registry = createRegistry()
    processManager = createProcessManager()
    mockActions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => ownContract,
    })
    mockWindow = {
      postMessage: jest.fn(),
    } as unknown as Window

    wire = {
      label: 'wire',
      send: jest.fn(),
      receive: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
      hello: jest.fn(async () => new Uint8Array([1])),
      isHello: jest.fn(() => false),
      acceptHello: jest.fn(() => 'accepted'),
    }
    provider = { createChannel: jest.fn(() => wire), protocolProvider: jest.fn() }
    security = {
      localId: 'broker-1',
      getProvider: jest.fn((protocol: SecurityProtocolVersion) => (protocol === 'v4' || protocol === 'v3' ? provider : undefined)),
      dispatch: jest.fn(),
    }

    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions: mockActions,
      logger: mockLogger,
      getSupportedProtocols: () => ['v4', 'v3', 'none'],
      security,
    }
  })

  function requestEvent(overrides: Partial<{ senderId: string; processId: string; origin: string; security: unknown }> = {}) {
    return {
      data: {
        type: '[nexus] connection-request',
        senderId: overrides.senderId ?? 'remote-broker-1',
        processId: overrides.processId ?? 'process-1',
        contract: peerContract,
        ...(overrides.security ? { security: overrides.security } : {}),
      } as IAction,
      source: mockWindow,
      origin: overrides.origin ?? 'https://example.com',
    } as MessageEvent<IAction>
  }

  function addReadyChannel(settings: Record<string, unknown> = {}) {
    const channel = addChannel(mockBrokerState, registry, processManager, mockActions, 'local-channel', mockWindow, settings, security)
    // how: connect() marks the channel ready; cancel(false) clears the request it sent so the channel idles as a ready responder.
    channel.connect()
    channel.cancel(false)
    ;(mockWindow.postMessage as Mock).mockClear()
    return channel
  }

  function withoutProviders(): RoutingContext {
    // why: The channel attaches through the security dependencies it was created with, so the provider lookup is starved there.
    ;(security.getProvider as Mock).mockReturnValue(undefined)
    return routingContext
  }

  function acceptedSecurity() {
    return ((mockWindow.postMessage as Mock).mock.calls[0][0] as IAction & { security?: unknown }).security
  }

  describe('negotiation', () => {
    it('stores the pending security request in the channel', () => {
      const channel = addReadyChannel()

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect(channel.getPendingSecurityRequest()).toEqual(offerV4)
    })

    it('answers ACCEPT with the protocol the registry has in common with the request', () => {
      addReadyChannel()

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-request-accepted', security: { negotiated: 'v4' } }),
        expect.any(String)
      )
    })

    it('records the negotiated protocol on the channel', () => {
      const channel = addReadyChannel()

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect(channel.getNegotiatedProtocol()).toBe('v4')
    })

    it('logs the negotiated protocol', () => {
      addReadyChannel()

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect(mockLogger.info).toHaveBeenCalledWith('test-broker negotiated security protocol: v4')
    })

    it('negotiates none when the registry has no protocol in common with the request', () => {
      addReadyChannel()

      handleRequest({ ...routingContext, getSupportedProtocols: () => ['v3', 'none'] }, requestEvent({ security: offerV4 }))

      expect(acceptedSecurity()).toEqual({ negotiated: 'none' })
    })

    it('records none when the request offers only plaintext', () => {
      const channel = addReadyChannel()

      handleRequest(routingContext, requestEvent({ security: offerNone }))

      expect(channel.getNegotiatedProtocol()).toBe('none')
    })
  })

  describe('protocol pin', () => {
    it('negotiates the protocol the channel asked for even when the counterpart prefers another the broker holds', () => {
      addReadyChannel({ security: { protocol: 'v3' } })

      handleRequest(routingContext, requestEvent({ security: offerBoth }))

      expect(acceptedSecurity()).toEqual({ negotiated: 'v3' })
    })

    it('negotiates none when the counterpart offers only a protocol other than the one the channel asked for', () => {
      addReadyChannel({ security: { protocol: 'v3' } })

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect(acceptedSecurity()).toEqual({ negotiated: 'none' })
    })

    it('offers every registered protocol when the channel asked for none', () => {
      addReadyChannel()

      handleRequest(routingContext, requestEvent({ security: offerBoth }))

      expect(acceptedSecurity()).toEqual({ negotiated: 'v4' })
    })

    it('offers every registered protocol when the channel disabled security', () => {
      addReadyChannel({ security: { protocol: 'v3', disabled: true } })

      handleRequest(routingContext, requestEvent({ security: offerBoth }))

      expect(acceptedSecurity()).toEqual({ negotiated: 'v4' })
    })
  })

  describe('transport attachment', () => {
    it('attaches the transport as responder between the broker and the requester', () => {
      addReadyChannel()

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect(provider.createChannel).toHaveBeenCalledWith(
        'local-channel',
        expect.objectContaining({ session: { protocol: 'v4', role: 'responder', localId: 'broker-1', peerId: 'remote-broker-1' } })
      )
    })

    it('holds the transport for the negotiated protocol while waiting for OPEN', () => {
      const channel = addReadyChannel()

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect(channel.getSecurityTransport()?.getProtocol()).toBe('v4')
    })

    it('starts the hello exchange after ACCEPT leaves', () => {
      addReadyChannel()

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect({
        hellos: (wire.hello as Mock).mock.calls.length,
        postedTypes: (mockWindow.postMessage as Mock).mock.calls.map((call) => (call[0] as IAction).type),
      }).toEqual({ hellos: 1, postedTypes: ['[nexus] connection-request-accepted'] })
    })

    it('attaches no transport when negotiation ends in plaintext', () => {
      addReadyChannel()

      handleRequest(routingContext, requestEvent({ security: offerNone }))

      expect(provider.createChannel).not.toHaveBeenCalled()
    })

    it('does not fire security-ready during the handshake', () => {
      const channel = addReadyChannel()
      const readyHandler = jest.fn()
      channel.on('security-ready', readyHandler)

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect(readyHandler).not.toHaveBeenCalled()
    })

    describe('scheduled answer', () => {
      it('negotiates without attaching when the local side has not called connect()', () => {
        const channel = addChannel(mockBrokerState, registry, processManager, mockActions, 'local-channel', mockWindow, {}, security)

        handleRequest(routingContext, requestEvent({ security: offerV4 }))

        expect({
          negotiated: channel.getNegotiatedProtocol(),
          transport: channel.getSecurityTransport(),
          created: (provider.createChannel as Mock).mock.calls.length,
        }).toEqual({ negotiated: 'v4', transport: null, created: 0 })
      })

      it('carries the negotiated response through the scheduled activation into the ACCEPT', () => {
        const channel = addChannel(mockBrokerState, registry, processManager, mockActions, 'local-channel', mockWindow, {}, security)

        handleRequest(routingContext, requestEvent({ security: offerV4 }))
        channel.connect()

        expect(mockWindow.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: '[nexus] connection-request-accepted', security: { negotiated: 'v4' } }),
          expect.any(String)
        )
      })

      it('attaches the transport when connect() composes the ACCEPT', () => {
        const channel = addChannel(mockBrokerState, registry, processManager, mockActions, 'local-channel', mockWindow, {}, security)

        handleRequest(routingContext, requestEvent({ security: offerV4 }))
        channel.connect()

        expect(provider.createChannel).toHaveBeenCalledWith(
          'local-channel',
          expect.objectContaining({ session: expect.objectContaining({ role: 'responder', peerId: 'remote-broker-1' }) })
        )
      })

      it('hands the broker security dependencies to a channel it creates for an unknown window', () => {
        handleRequest(routingContext, requestEvent({ security: offerV4 }))
        ;(registry.getByName('inbound-https://example.com') as ChannelHandle | undefined)?.connect()

        expect(provider.createChannel).toHaveBeenCalledWith(
          'inbound-https://example.com',
          expect.objectContaining({ session: expect.anything() })
        )
      })
    })

    describe('provider unavailable', () => {
      it('warns when no provider can serve the negotiated protocol', () => {
        addReadyChannel()

        handleRequest(withoutProviders(), requestEvent({ security: offerV4 }))

        expect(mockLogger.warn).toHaveBeenCalledWith(missingProviderWarning)
      })

      it('answers ACCEPT with plaintext when no provider can serve the negotiated protocol', () => {
        addReadyChannel()

        handleRequest(withoutProviders(), requestEvent({ security: offerV4 }))

        expect(acceptedSecurity()).toEqual({ negotiated: 'none' })
      })

      it('records plaintext when no provider can serve the negotiated protocol', () => {
        const channel = addReadyChannel()

        handleRequest(withoutProviders(), requestEvent({ security: offerV4 }))

        expect({ negotiated: channel.getNegotiatedProtocol(), transport: channel.getSecurityTransport() }).toEqual({
          negotiated: 'none',
          transport: null,
        })
      })

      it('answers ACCEPT with plaintext when the provider refuses the session', () => {
        addReadyChannel()
        ;(provider.createChannel as Mock).mockImplementation(() => {
          throw createError('session refused')
        })

        handleRequest(routingContext, requestEvent({ security: offerV4 }))

        expect(acceptedSecurity()).toEqual({ negotiated: 'none' })
      })

      it('warns about the refused session before degrading', () => {
        addReadyChannel()
        ;(provider.createChannel as Mock).mockImplementation(() => {
          throw createError('session refused')
        })

        handleRequest(routingContext, requestEvent({ security: offerV4 }))

        expect((mockLogger.warn as Mock).mock.calls).toEqual([
          ["Cannot attach the 'v4' security transport to channel local-channel: session refused"],
          [missingProviderWarning],
        ])
      })

      it('still answers the scheduled request when the provider disappears before connect()', () => {
        const channel = addChannel(mockBrokerState, registry, processManager, mockActions, 'local-channel', mockWindow, {}, security)
        ;(security.getProvider as Mock).mockReturnValue(undefined)

        handleRequest(routingContext, requestEvent({ security: offerV4 }))
        channel.connect()

        expect(acceptedSecurity()).toEqual({ negotiated: 'none' })
      })
    })
  })

  describe('fail-open responder wanting security', () => {
    it('warns and accepts in plaintext when the request carries no security slot', () => {
      addReadyChannel({ security: { protocol: 'v4' } })

      handleRequest(routingContext, requestEvent())

      expect({ accept: (mockWindow.postMessage as Mock).mock.calls[0][0], warns: (mockLogger.warn as Mock).mock.calls }).toEqual({
        accept: expect.objectContaining({ type: '[nexus] connection-request-accepted' }),
        warns: [[expect.stringContaining('continuing without encryption')]],
      })
    })

    it('warns and accepts in plaintext when the negotiation ends in plaintext', () => {
      addReadyChannel({ security: { protocol: 'v4' } })

      handleRequest(routingContext, requestEvent({ security: offerV3 }))

      expect({ security: acceptedSecurity(), warns: (mockLogger.warn as Mock).mock.calls }).toEqual({
        security: { negotiated: 'none' },
        warns: [[expect.stringContaining('continuing without encryption')]],
      })
    })

    it('warns twice when the negotiated provider is missing', () => {
      addReadyChannel({ security: { protocol: 'v4' } })

      handleRequest(withoutProviders(), requestEvent({ security: offerV4 }))

      expect((mockLogger.warn as Mock).mock.calls).toEqual([
        [missingProviderWarning],
        [expect.stringContaining('continuing without encryption')],
      ])
    })

    it('stays silent when the channel asked for no security and the negotiation ends in plaintext', () => {
      addReadyChannel()

      handleRequest(routingContext, requestEvent({ security: offerNone }))

      expect(mockLogger.warn).not.toHaveBeenCalled()
    })
  })
})
