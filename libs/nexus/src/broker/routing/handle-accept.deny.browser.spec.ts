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
import { handleAccept } from './handle-accept'

describe('handleAccept deny gates', () => {
  const ownContract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message', required: true }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  const peerContract: IChannelContract = {
    accepted: [{ type: 'response-message' }],
    emitted: [{ type: 'test-message' }],
  }

  const brokenContract = { accepted: null } as unknown as IChannelContract
  const silentContract: IChannelContract = { accepted: [{ type: 'response-message' }], emitted: [{ type: 'unrelated-type' }] }

  let mockLogger: Logger
  let mockBrokerState: BrokerState

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ReturnType<typeof createActionCreators>
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
    actions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => mockBrokerState.contract,
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
      actions,
      logger: mockLogger,
      getSupportedProtocols: () => ['v4', 'v3', 'none'],
      security,
    }
  })

  function acceptEvent(
    processId: string,
    overrides: Partial<{ senderId: string; contract: IChannelContract; origin: string; security: unknown }> = {}
  ) {
    return {
      data: {
        type: '[nexus] connection-request-accepted',
        processId,
        senderId: overrides.senderId ?? 'remote-broker-1',
        contract: overrides.contract ?? peerContract,
        ...(overrides.security ? { security: overrides.security } : {}),
      } as IAction,
      origin: overrides.origin ?? 'http://remote.example',
      source: mockWindow,
    } as MessageEvent<IAction>
  }

  function addRequestingChannel(context: RoutingContext = routingContext, settings: Record<string, unknown> = {}) {
    const channel = addChannel(context.state, registry, processManager, actions, 'test-channel', mockWindow, settings, security)
    channel.connect()
    const processId = channel.getPendingProcessId()
    if (processId === null) throw new Error('connect() did not record a pending process')
    ;(mockWindow.postMessage as Mock).mockClear()
    return { channel, processId }
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

  function cancelFrames() {
    return (mockWindow.postMessage as Mock).mock.calls.filter(
      (call) => (call[0] as IAction).type === '[nexus] connection-request-cancelled'
    )
  }

  describe('invalid contract gate', () => {
    it('cancels the connection and stays inactive', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, { contract: brokenContract }))

      expect({ active: channel.isActive(), cancel: (mockWindow.postMessage as Mock).mock.calls[0][0] }).toEqual({
        active: false,
        cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
      })
    })

    it('fires deny with reason invalid-contract and the validator detail', () => {
      const { channel, processId } = addRequestingChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent(processId, { contract: brokenContract }))

      expect(denyHandler.mock.calls[0][0]).toEqual({
        error: 'Invalid contract: Contract must contain at least one accepted or emitted action.',
        reason: 'invalid-contract',
        origin: 'http://remote.example',
      })
    })

    it('logs a warning naming the channel when the abort happens', () => {
      const { processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, { contract: brokenContract }))

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'test-broker aborted the test-channel connection: the counterpart accepted with an invalid contract.'
      )
    })

    it('stops retrying after cancelling on an invalid contract', () => {
      const { processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, { contract: brokenContract }))
      ;(mockWindow.postMessage as Mock).mockClear()
      jest.advanceTimersByTime(20_000)

      expect(mockWindow.postMessage).not.toHaveBeenCalled()
    })

    it('fires deny once when a replayed ACCEPT races the cancellation', () => {
      const { channel, processId } = addRequestingChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent(processId, { contract: brokenContract }))
      channel.connect()
      const retried = channel.getPendingProcessId()
      if (retried === null) throw new Error('connect() did not record a pending process')
      handleAccept(routingContext, acceptEvent(retried, { contract: brokenContract }))

      expect({ denies: denyHandler.mock.calls.length, cancels: cancelFrames().length }).toEqual({ denies: 2, cancels: 2 })
    })
  })

  describe('required actions gate', () => {
    it('cancels the connection when the responder does not emit a required action', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, { contract: silentContract }))

      expect({ active: channel.isActive(), cancel: (mockWindow.postMessage as Mock).mock.calls[0][0] }).toEqual({
        active: false,
        cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
      })
    })

    it('fires deny with reason missing-required-actions naming the missing actions', () => {
      const { channel, processId } = addRequestingChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent(processId, { contract: silentContract }))

      expect(denyHandler.mock.calls[0][0]).toEqual({
        error: 'Incompatible contract: missing required actions test-message.',
        reason: 'missing-required-actions',
        origin: 'http://remote.example',
      })
    })

    it('completes the handshake when the responder emits additional unknown types', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(
        routingContext,
        acceptEvent(processId, {
          contract: { accepted: [{ type: 'response-message' }], emitted: [{ type: 'test-message' }, { type: 'newer-optional-type' }] },
        })
      )

      expect(channel.isActive()).toBe(true)
    })
  })

  describe('security policy gate', () => {
    it('cancels the connection when the policy rejects the acceptance', () => {
      const context = contextWithPolicy(false)
      const { processId } = addRequestingChannel(context)

      handleAccept(context, acceptEvent(processId))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
        expect.any(String)
      )
    })

    it('hands the policy the acceptance event', () => {
      const context = contextWithPolicy(false)
      const { processId } = addRequestingChannel(context)
      const message = acceptEvent(processId)

      handleAccept(context, message)

      expect(context.state.settings.securityPolicy).toHaveBeenCalledWith(message)
    })

    it('fires deny with reason policy-rejected and the rejected origin', () => {
      const context = contextWithPolicy(false)
      const { channel, processId } = addRequestingChannel(context)
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(context, acceptEvent(processId))

      expect(denyHandler.mock.calls[0][0]).toEqual({
        error: "Connection acceptance from 'http://remote.example' was rejected by the channel security policy.",
        reason: 'policy-rejected',
        origin: 'http://remote.example',
      })
    })

    it('proceeds when the policy allows the acceptance', () => {
      const context = contextWithPolicy(true)
      const { processId } = addRequestingChannel(context)

      handleAccept(context, acceptEvent(processId))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-opened', processId }),
        expect.any(String)
      )
    })
  })

  describe('contract compatibility gate', () => {
    const rejectingRule = { contractCompat: () => ({ compatible: false, reason: 'own 1.0.0 does not match peer 2.0.0' }) }

    it('cancels the connection and stays inactive when the rule rejects', () => {
      const { channel, processId } = addRequestingChannel(routingContext, rejectingRule)

      handleAccept(routingContext, acceptEvent(processId))

      expect({ active: channel.isActive(), cancel: (mockWindow.postMessage as Mock).mock.calls[0][0] }).toEqual({
        active: false,
        cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
      })
    })

    it('fires deny carrying the rule reason and reason incompatible-contract', () => {
      const { channel, processId } = addRequestingChannel(routingContext, rejectingRule)
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent(processId))

      expect(denyHandler).toHaveBeenCalledWith(
        { error: 'own 1.0.0 does not match peer 2.0.0', reason: 'incompatible-contract', origin: 'http://remote.example' },
        expect.anything()
      )
    })

    it('logs a warning naming the channel and the rule reason when the rule rejects', () => {
      const { processId } = addRequestingChannel(routingContext, rejectingRule)

      handleAccept(routingContext, acceptEvent(processId))

      expect(mockLogger.warn).toHaveBeenCalledWith('test-broker aborted the test-channel connection: own 1.0.0 does not match peer 2.0.0')
    })

    it('completes the handshake when the rule reports compatible', () => {
      const { channel, processId } = addRequestingChannel(routingContext, { contractCompat: () => ({ compatible: true }) })

      handleAccept(routingContext, acceptEvent(processId))

      expect(channel.isActive()).toBe(true)
    })

    it('hands the rule the own contract and the responder contract', () => {
      const contractCompat = jest.fn(() => ({ compatible: true }) as const)
      const { processId } = addRequestingChannel(routingContext, { contractCompat })

      handleAccept(routingContext, acceptEvent(processId))

      expect(contractCompat).toHaveBeenCalledWith(ownContract, peerContract)
    })
  })

  describe('fail-closed initiator', () => {
    const failClosedSettings = { security: { protocol: 'v4', mode: 'fail-closed' } }
    const securityDeny = {
      error: 'Security is required for this channel but the counterpart cannot provide an encrypted protocol.',
      reason: 'security-unavailable',
      origin: 'http://remote.example',
    }

    function addFailClosedChannel() {
      const { channel, processId } = addRequestingChannel(routingContext, failClosedSettings)
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)
      return { channel, processId, denyHandler }
    }

    it('aborts before OPEN when the responder negotiated down to plaintext', () => {
      const { channel, processId, denyHandler } = addFailClosedChannel()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))

      expect({
        active: channel.isActive(),
        cancel: (mockWindow.postMessage as Mock).mock.calls[0][0],
        deny: denyHandler.mock.calls[0][0],
      }).toEqual({
        active: false,
        cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
        deny: securityDeny,
      })
    })

    it('aborts before OPEN when the responder predates security negotiation', () => {
      const { channel, processId, denyHandler } = addFailClosedChannel()

      handleAccept(routingContext, acceptEvent(processId))

      expect({ active: channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({ active: false, deny: securityDeny })
    })

    it('aborts before OPEN when the responder selected a protocol the channel did not ask for', () => {
      const { channel, processId, denyHandler } = addFailClosedChannel()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v3' } }))

      expect({ active: channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({ active: false, deny: securityDeny })
    })

    it('aborts before OPEN when no provider can serve the negotiated protocol', () => {
      const { channel, processId, denyHandler } = addFailClosedChannel()
      ;(security.getProvider as Mock).mockReturnValue(undefined)

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v4' } }))

      expect({ active: channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({ active: false, deny: securityDeny })
    })

    it('aborts before OPEN when the provider refuses the session', () => {
      const { channel, processId, denyHandler } = addFailClosedChannel()
      ;(provider.createChannel as Mock).mockImplementation(() => {
        throw createError('session refused')
      })

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v4' } }))

      expect({ active: channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({ active: false, deny: securityDeny })
    })

    it('sends no OPEN after aborting', () => {
      const { processId } = addFailClosedChannel()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))

      expect((mockWindow.postMessage as Mock).mock.calls.map((call) => (call[0] as IAction).type)).toEqual([
        '[nexus] connection-request-cancelled',
      ])
    })

    it('logs a warning naming the channel when the security abort happens', () => {
      const { processId } = addFailClosedChannel()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))

      expect(mockLogger.warn).toHaveBeenCalledWith('test-broker aborted the test-channel connection: security is required but unavailable.')
    })

    it('does not warn about continuing without encryption when it aborts', () => {
      const { processId } = addFailClosedChannel()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))

      expect((mockLogger.warn as Mock).mock.calls).toEqual([[expect.stringContaining('aborted the test-channel connection')]])
    })

    it('stops retrying after the abort', () => {
      const { processId } = addFailClosedChannel()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))
      ;(mockWindow.postMessage as Mock).mockClear()
      jest.advanceTimersByTime(20_000)

      expect(mockWindow.postMessage).not.toHaveBeenCalled()
    })

    it('fires deny once when a replayed ACCEPT races the cancellation', () => {
      const { channel, processId, denyHandler } = addFailClosedChannel()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))
      channel.connect()
      const retried = channel.getPendingProcessId()
      if (retried === null) throw new Error('connect() did not record a pending process')
      handleAccept(routingContext, acceptEvent(retried, { security: { negotiated: 'none' } }))

      expect({ denies: denyHandler.mock.calls.length, cancels: cancelFrames().length }).toEqual({ denies: 2, cancels: 2 })
    })

    it('completes the handshake when the negotiated protocol is deliverable', () => {
      const { channel, processId } = addFailClosedChannel()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v4' } }))

      expect({ active: channel.isActive(), transport: channel.getSecurityTransport()?.getProtocol() }).toEqual({
        active: true,
        transport: 'v4',
      })
    })
  })
})
