import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { ChannelSecurityDependencies } from '../../channel/types'
import type { IAction } from '../../types/action'
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

describe('handleRequest deny gates', () => {
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
      getProvider: jest.fn((protocol: SecurityProtocolVersion) => (protocol === 'v4' ? provider : undefined)),
      dispatch: jest.fn(),
    }

    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions: mockActions,
      logger: mockLogger,
      getSupportedProtocols: () => ['v4', 'none'],
      security,
    }
  })

  function requestEvent(
    overrides: Partial<{ senderId: string; processId: string; contract: IChannelContract; origin: string; security: unknown }> = {}
  ) {
    return {
      data: {
        type: '[nexus] connection-request',
        senderId: overrides.senderId ?? 'remote-broker-1',
        processId: overrides.processId ?? 'process-1',
        contract: overrides.contract ?? peerContract,
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

  function contextWithPolicy(allowed: boolean): RoutingContext {
    return {
      ...routingContext,
      state: {
        ...mockBrokerState,
        settings: { ...mockBrokerState.settings, securityPolicy: jest.fn(() => allowed) },
      },
    }
  }

  function denyFrames() {
    return (mockWindow.postMessage as Mock).mock.calls.filter((call) => (call[0] as IAction).type === '[nexus] connection-request-denied')
  }

  describe('invalid contract gate', () => {
    const brokenContract = { accepted: null } as unknown as IChannelContract

    it('denies with reason invalid-contract and the validator detail the requester can act on', () => {
      addReadyChannel()

      handleRequest(routingContext, requestEvent({ contract: brokenContract }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-denied',
          error: 'Invalid contract: Contract must contain at least one accepted or emitted action.',
          reason: 'invalid-contract',
        }),
        expect.any(String)
      )
    })

    it('fires the denial locally as a deny event on the responding channel', () => {
      const channel = addReadyChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleRequest(routingContext, requestEvent({ contract: brokenContract }))

      expect(denyHandler.mock.calls[0][0]).toEqual({
        error: 'Invalid contract: Contract must contain at least one accepted or emitted action.',
        reason: 'invalid-contract',
        origin: 'https://example.com',
      })
    })
  })

  describe('required actions gate', () => {
    const silentContract: IChannelContract = { accepted: [{ type: 'response-message' }], emitted: [{ type: 'unrelated-type' }] }

    it('denies with reason missing-required-actions when the peer does not emit a required action', () => {
      addReadyChannel()

      handleRequest(routingContext, requestEvent({ contract: silentContract }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-denied',
          error: 'Incompatible contract: missing required actions test-message.',
          reason: 'missing-required-actions',
        }),
        expect.any(String)
      )
    })

    it('fires the denial locally naming the missing actions', () => {
      const channel = addReadyChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleRequest(routingContext, requestEvent({ contract: silentContract }))

      expect(denyHandler.mock.calls[0][0]).toEqual({
        error: 'Incompatible contract: missing required actions test-message.',
        reason: 'missing-required-actions',
        origin: 'https://example.com',
      })
    })

    it('accepts a request whose contract emits additional unknown types', () => {
      addReadyChannel()

      handleRequest(
        routingContext,
        requestEvent({
          contract: { accepted: [{ type: 'response-message' }], emitted: [{ type: 'test-message' }, { type: 'newer-optional-type' }] },
        })
      )

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-request-accepted' }),
        expect.any(String)
      )
    })
  })

  describe('security policy gate', () => {
    it('denies without disclosing the policy to the refused requester', () => {
      addReadyChannel()

      handleRequest(contextWithPolicy(false), requestEvent())

      expect(denyFrames()[0][0]).toEqual({
        type: '[nexus] connection-request-denied',
        processId: 'process-1',
        senderId: 'broker-1',
        error: 'Not accepted.',
      })
    })

    it('fires the denial locally with reason policy-rejected and the refused origin', () => {
      const channel = addReadyChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleRequest(contextWithPolicy(false), requestEvent({ origin: 'https://evil.example' }))

      expect(denyHandler.mock.calls[0][0]).toEqual({
        error: "Connection request from 'https://evil.example' was rejected by the channel security policy.",
        reason: 'policy-rejected',
        origin: 'https://evil.example',
      })
    })

    it('hands the policy the request event', () => {
      const context = contextWithPolicy(true)
      addReadyChannel()
      const message = requestEvent()

      handleRequest(context, message)

      expect(context.state.settings.securityPolicy).toHaveBeenCalledWith(message)
    })

    it('accepts connection when security policy allows', () => {
      addReadyChannel()

      handleRequest(contextWithPolicy(true), requestEvent())

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-accepted',
          processId: 'process-1',
        }),
        expect.any(String)
      )
    })
  })

  describe('contract compatibility gate', () => {
    const rejectingRule = { contractCompat: () => ({ compatible: false, reason: 'own 1.0.0 does not match peer 2.0.0' }) }

    it('denies with the rule reason and reason incompatible-contract when the rule rejects', () => {
      addReadyChannel(rejectingRule)

      handleRequest(routingContext, requestEvent())

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-denied',
          error: 'own 1.0.0 does not match peer 2.0.0',
          reason: 'incompatible-contract',
        }),
        expect.any(String)
      )
    })

    it('fires the denial locally as a deny event on the responding channel', () => {
      const channel = addReadyChannel(rejectingRule)
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleRequest(routingContext, requestEvent())

      expect(denyHandler.mock.calls[0][0]).toEqual({
        error: 'own 1.0.0 does not match peer 2.0.0',
        reason: 'incompatible-contract',
        origin: 'https://example.com',
      })
    })

    it('fires the local deny once when the counterpart retries REQUEST with the same process id', () => {
      const channel = addReadyChannel(rejectingRule)
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleRequest(routingContext, requestEvent())
      handleRequest(routingContext, requestEvent())

      expect({ localDenies: denyHandler.mock.calls.length, deniedFrames: denyFrames().length }).toEqual({ localDenies: 1, deniedFrames: 2 })
    })

    it('fires the local deny again when a new handshake process is denied', () => {
      const channel = addReadyChannel(rejectingRule)
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleRequest(routingContext, requestEvent())
      handleRequest(routingContext, requestEvent({ processId: 'process-2' }))

      expect(denyHandler).toHaveBeenCalledTimes(2)
    })

    it('accepts when the rule reports compatible', () => {
      addReadyChannel({ contractCompat: () => ({ compatible: true }) })

      handleRequest(routingContext, requestEvent())

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-request-accepted' }),
        expect.any(String)
      )
    })

    it('hands the rule the own contract and the requested peer contract', () => {
      const contractCompat = jest.fn(() => ({ compatible: true }) as const)
      addReadyChannel({ contractCompat })

      handleRequest(routingContext, requestEvent())

      expect(contractCompat).toHaveBeenCalledWith(ownContract, peerContract)
    })
  })

  describe('fail-closed responder', () => {
    const failClosedSettings = { security: { protocol: 'v4', mode: 'fail-closed' } }
    const securityDeny = expect.objectContaining({
      type: '[nexus] connection-request-denied',
      reason: 'security-unavailable',
      error: 'Security is required for this channel but the counterpart cannot negotiate an encrypted protocol.',
    })

    it('denies with reason security-unavailable when the request carries no security slot', () => {
      addReadyChannel(failClosedSettings)

      handleRequest(routingContext, requestEvent())

      expect(mockWindow.postMessage).toHaveBeenCalledWith(securityDeny, expect.any(String))
    })

    it('denies with reason security-unavailable when negotiation ends in plaintext', () => {
      addReadyChannel(failClosedSettings)

      handleRequest(routingContext, requestEvent({ security: offerV3 }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(securityDeny, expect.any(String))
    })

    it('denies with reason security-unavailable when no provider can serve the negotiated protocol', () => {
      addReadyChannel(failClosedSettings)
      ;(security.getProvider as Mock).mockReturnValue(undefined)

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(securityDeny, expect.any(String))
    })

    it('denies with reason security-unavailable when the provider refuses the session', () => {
      addReadyChannel(failClosedSettings)
      ;(provider.createChannel as Mock).mockImplementation(() => {
        throw createError('session refused')
      })

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(securityDeny, expect.any(String))
    })

    it('leaves no transport on the channel after denying for a missing provider', () => {
      const channel = addReadyChannel(failClosedSettings)
      ;(security.getProvider as Mock).mockReturnValue(undefined)

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect({
        transport: channel.getSecurityTransport(),
        negotiated: channel.getNegotiatedProtocol(),
        awaiting: channel.isAwaitingOpen(),
      }).toEqual({
        transport: null,
        negotiated: 'none',
        awaiting: false,
      })
    })

    it('sends no ACCEPT after denying', () => {
      addReadyChannel(failClosedSettings)

      handleRequest(routingContext, requestEvent({ security: offerV3 }))

      expect((mockWindow.postMessage as Mock).mock.calls.map((call) => (call[0] as IAction).type)).toEqual([
        '[nexus] connection-request-denied',
      ])
    })

    it('fires the denial locally as a deny event on the responding channel', () => {
      const channel = addReadyChannel(failClosedSettings)
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleRequest(routingContext, requestEvent({ security: offerV3 }))

      expect(denyHandler.mock.calls[0][0]).toEqual({
        error: 'Security is required for this channel but the counterpart cannot negotiate an encrypted protocol.',
        reason: 'security-unavailable',
        origin: 'https://example.com',
      })
    })

    it('fires the local deny once when the counterpart retries REQUEST with the same process id', () => {
      const channel = addReadyChannel(failClosedSettings)
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleRequest(routingContext, requestEvent({ security: offerV3 }))
      handleRequest(routingContext, requestEvent({ security: offerV3 }))

      expect({ localDenies: denyHandler.mock.calls.length, deniedFrames: denyFrames().length }).toEqual({ localDenies: 1, deniedFrames: 2 })
    })

    it('does not warn about continuing without encryption when it denies', () => {
      addReadyChannel(failClosedSettings)

      handleRequest(routingContext, requestEvent({ security: offerV3 }))

      expect(mockLogger.warn).not.toHaveBeenCalled()
    })

    it('accepts when the registry and a working provider satisfy the requested protocol', () => {
      addReadyChannel(failClosedSettings)

      handleRequest(routingContext, requestEvent({ security: offerV4 }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-accepted',
          security: { negotiated: 'v4' },
        }),
        expect.any(String)
      )
    })
  })

  it('fires the denial locally after yielding the glare tie-break, when no handshake timer is left to expire', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, mockActions, 'local-channel', mockWindow, {}, security)
    channel.connect()
    const denyHandler = jest.fn()
    channel.on('deny', denyHandler)

    handleRequest(
      routingContext,
      requestEvent({
        senderId: 'z-remote-broker',
        contract: { accepted: [{ type: 'response-message' }], emitted: [{ type: 'unrelated-type' }] },
      })
    )

    expect({ pending: channel.getPendingProcessId(), deny: denyHandler.mock.calls[0]?.[0] }).toEqual({
      pending: null,
      deny: expect.objectContaining({ reason: 'missing-required-actions' }),
    })
  })
})
