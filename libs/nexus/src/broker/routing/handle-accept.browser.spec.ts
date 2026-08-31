import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { SecurityProvider, SecurityProtocolProvider } from '../../types/security'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleAccept } from './handle-accept'

describe('handleAccept', () => {
  const ownContract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message', required: true }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  const peerContract: IChannelContract = {
    accepted: [{ type: 'response-message' }],
    emitted: [{ type: 'test-message' }],
  }

  let mockLogger: Logger
  let mockBrokerState: BrokerState

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ReturnType<typeof createActionCreators>
  let mockWindow: Window
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
    }

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

    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions,
      logger: mockLogger,
      getSupportedProtocols: () => ['none'],
      getProtocol: () => undefined,
      routeAction: () => undefined,
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

  function addRequestingChannel(context: RoutingContext = routingContext) {
    const channel = addChannel(context.state, registry, processManager, actions, 'test-channel', mockWindow)
    channel.connect()
    const processId = channel.getPendingProcessId()
    if (processId === null) throw new Error('connect() did not record a pending process')
    ;(mockWindow.postMessage as jest.Mock).mockClear()
    return { channel, processId }
  }

  function contextWithProvider() {
    const sent: unknown[] = []
    const provider: SecurityProvider = {
      createChannel: (label) => ({
        label,
        send: (origin: string, target: string, data: unknown) => {
          sent.push({ origin, target, data })
        },
        receive: () => undefined,
        stop: () => undefined,
        resume: () => undefined,
      }),
      protocolProvider: (() => undefined) as unknown as SecurityProtocolProvider,
    }
    const context: RoutingContext = {
      ...routingContext,
      getSupportedProtocols: () => ['v2', 'v1', 'none'],
      getProtocol: () => provider,
    }
    return { context, sent }
  }

  it('completes the handshake and sends OPEN', () => {
    const { channel, processId } = addRequestingChannel()

    handleAccept(routingContext, acceptEvent(processId))

    expect({ active: channel.isActive(), open: (mockWindow.postMessage as jest.Mock).mock.calls[0][0] }).toEqual({
      active: true,
      open: expect.objectContaining({ type: '[nexus] connection-opened', processId }),
    })
  })

  it('keeps the own contract and stores the responder contract as the peer contract', () => {
    const { channel, processId } = addRequestingChannel()

    handleAccept(routingContext, acceptEvent(processId))

    expect(channel.toJSON()).toEqual(expect.objectContaining({ contract: ownContract, peerContract, peerId: 'remote-broker-1' }))
  })

  it('pins the origin from the accept event', () => {
    const { channel, processId } = addRequestingChannel()

    handleAccept(routingContext, acceptEvent(processId))

    expect(channel.getOrigin()).toBe('http://remote.example')
  })

  it('fires the open event with the origin and responder contract', () => {
    const { channel, processId } = addRequestingChannel()
    const openHandler = jest.fn()
    channel.on('open', openHandler)

    handleAccept(routingContext, acceptEvent(processId))

    expect(openHandler).toHaveBeenCalledWith(
      expect.objectContaining({ origin: 'http://remote.example', contract: peerContract }),
      expect.anything()
    )
  })

  it('removes the process after completing the handshake', () => {
    const { processId } = addRequestingChannel()

    handleAccept(routingContext, acceptEvent(processId))

    expect(processManager.get(processId)).toBeUndefined()
  })

  it('stops the request retry timers after completing the handshake', () => {
    const { processId } = addRequestingChannel()

    handleAccept(routingContext, acceptEvent(processId))
    ;(mockWindow.postMessage as jest.Mock).mockClear()
    jest.advanceTimersByTime(20_000)

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })

  it('replays OPEN for a duplicate ACCEPT from the connected counterpart', () => {
    const { processId } = addRequestingChannel()
    handleAccept(routingContext, acceptEvent(processId))
    ;(mockWindow.postMessage as jest.Mock).mockClear()

    handleAccept(routingContext, acceptEvent(processId))

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: '[nexus] connection-opened', processId }),
      expect.any(String)
    )
  })

  it('repeats the security confirmation in the replayed OPEN after an encrypted handshake', () => {
    const { context } = contextWithProvider()
    const { processId } = addRequestingChannel()
    handleAccept(context, acceptEvent(processId, { security: { negotiated: 'v2' } }))
    ;(mockWindow.postMessage as jest.Mock).mockClear()

    handleAccept(context, acceptEvent(processId, { security: { negotiated: 'v2' } }))

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: '[nexus] connection-opened', security: { active: true, protocol: 'v2' } }),
      expect.any(String)
    )
  })

  it('repeats the plaintext confirmation in the replayed OPEN after a degraded handshake', () => {
    const { processId } = addRequestingChannel()
    handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))
    ;(mockWindow.postMessage as jest.Mock).mockClear()

    handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: '[nexus] connection-opened', security: { active: false, protocol: 'none' } }),
      expect.any(String)
    )
  })

  it('omits the security confirmation from the replayed OPEN when the handshake carried none', () => {
    const { processId } = addRequestingChannel()
    handleAccept(routingContext, acceptEvent(processId))
    ;(mockWindow.postMessage as jest.Mock).mockClear()

    handleAccept(routingContext, acceptEvent(processId))

    const sent = (mockWindow.postMessage as jest.Mock).mock.calls[0][0] as IAction & { security?: unknown }
    expect(sent.security).toBeUndefined()
  })

  it('ignores an ACCEPT from a different sender when already open', () => {
    const { processId } = addRequestingChannel()
    handleAccept(routingContext, acceptEvent(processId))
    ;(mockWindow.postMessage as jest.Mock).mockClear()

    handleAccept(routingContext, acceptEvent(processId, { senderId: 'someone-else' }))

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })

  it('drops an ACCEPT from an unexpected origin when one is pinned', () => {
    const contextWithOrigin = routingContext
    const channel = addChannel(contextWithOrigin.state, registry, processManager, actions, 'test-channel', mockWindow, {
      origin: 'http://remote.example',
    })
    channel.connect()
    const processId = channel.getPendingProcessId()
    if (processId === null) throw new Error('connect() did not record a pending process')
    ;(mockWindow.postMessage as jest.Mock).mockClear()
    const invalidHandler = jest.fn()
    channel.on('invalid', invalidHandler)

    handleAccept(contextWithOrigin, acceptEvent(processId, { origin: 'http://evil.example' }))

    expect({
      active: channel.isActive(),
      invalids: invalidHandler.mock.calls.length,
      posts: (mockWindow.postMessage as jest.Mock).mock.calls,
    }).toEqual({
      active: false,
      invalids: 1,
      posts: [],
    })
  })

  it('handles security response with none protocol', () => {
    const { processId } = addRequestingChannel()

    handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-opened',
        security: { active: false, protocol: 'none' },
      }),
      expect.any(String)
    )
  })

  it('handles security response with v1 protocol', () => {
    const { channel, processId } = addRequestingChannel()

    handleAccept(contextWithProvider().context, acceptEvent(processId, { security: { negotiated: 'v1' } }))

    expect({ negotiated: channel.getNegotiatedProtocol(), open: (mockWindow.postMessage as jest.Mock).mock.calls[0][0] }).toEqual({
      negotiated: 'v1',
      open: expect.objectContaining({ security: { active: true, protocol: 'v1' } }),
    })
  })

  it('logs the accepted security protocol', () => {
    const { processId } = addRequestingChannel()

    handleAccept(contextWithProvider().context, acceptEvent(processId, { security: { negotiated: 'v1' } }))

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('accepted security protocol: v1'))
  })

  describe('contract compatibility gate', () => {
    function addRequestingChannelWith(settings: Record<string, unknown>) {
      const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow, settings)
      channel.connect()
      const processId = channel.getPendingProcessId()
      if (processId === null) throw new Error('connect() did not record a pending process')
      ;(mockWindow.postMessage as jest.Mock).mockClear()
      return { channel, processId }
    }

    it('cancels the connection and stays inactive when the rule rejects', () => {
      const { channel, processId } = addRequestingChannelWith({
        contractCompat: () => ({ compatible: false, reason: 'own 1.0.0 does not match peer 2.0.0' }),
      })

      handleAccept(routingContext, acceptEvent(processId))

      expect({ active: channel.isActive(), cancel: (mockWindow.postMessage as jest.Mock).mock.calls[0][0] }).toEqual({
        active: false,
        cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
      })
    })

    it('fires deny carrying the rule reason and reason incompatible-contract', () => {
      const { channel, processId } = addRequestingChannelWith({
        contractCompat: () => ({ compatible: false, reason: 'own 1.0.0 does not match peer 2.0.0' }),
      })
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent(processId))

      expect(denyHandler).toHaveBeenCalledWith(
        { error: 'own 1.0.0 does not match peer 2.0.0', reason: 'incompatible-contract', origin: 'http://remote.example' },
        expect.anything()
      )
    })

    it('logs a warning naming the channel and the rule reason when the rule rejects', () => {
      const { processId } = addRequestingChannelWith({
        contractCompat: () => ({ compatible: false, reason: 'own 1.0.0 does not match peer 2.0.0' }),
      })

      handleAccept(routingContext, acceptEvent(processId))

      expect(mockLogger.warn).toHaveBeenCalledWith('test-broker aborted the test-channel connection: own 1.0.0 does not match peer 2.0.0')
    })

    it('completes the handshake when the rule reports compatible', () => {
      const { channel, processId } = addRequestingChannelWith({ contractCompat: () => ({ compatible: true }) })

      handleAccept(routingContext, acceptEvent(processId))

      expect(channel.isActive()).toBe(true)
    })

    it('hands the rule the own contract and the responder contract', () => {
      const contractCompat = jest.fn(() => ({ compatible: true }) as const)
      const { processId } = addRequestingChannelWith({ contractCompat })

      handleAccept(routingContext, acceptEvent(processId))

      expect(contractCompat).toHaveBeenCalledWith(ownContract, peerContract)
    })
  })

  describe('security transport attachment', () => {
    it('attaches the transport for the negotiated protocol', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(contextWithProvider().context, acceptEvent(processId, { security: { negotiated: 'v2' } }))

      expect(channel.getSecurityTransport()?.getProtocol()).toBe('v2')
    })

    it('fires security-ready once the transport is attached', () => {
      const { channel, processId } = addRequestingChannel()
      const securityReadyHandler = jest.fn()
      channel.on('security-ready', securityReadyHandler)

      handleAccept(contextWithProvider().context, acceptEvent(processId, { security: { negotiated: 'v2' } }))

      expect(securityReadyHandler).toHaveBeenCalledWith({ protocol: 'v2', active: true }, expect.anything())
    })

    it('keeps the OPEN confirmation plaintext on the wire', () => {
      const { processId } = addRequestingChannel()

      handleAccept(contextWithProvider().context, acceptEvent(processId, { security: { negotiated: 'v2' } }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-opened' }),
        expect.any(String)
      )
    })

    it('flushes queued product messages through the transport, not postMessage', () => {
      const { channel, processId } = addRequestingChannel()
      channel.send('response-message', { seq: 1 })
      const wire = contextWithProvider()

      handleAccept(wire.context, acceptEvent(processId, { security: { negotiated: 'v2' } }))

      expect({
        throughTransport: wire.sent,
        postedTypes: (mockWindow.postMessage as jest.Mock).mock.calls.map((call) => (call[0] as IAction).type),
      }).toEqual({
        throughTransport: [
          expect.objectContaining({
            data: expect.objectContaining({ message: expect.objectContaining({ type: '[nexus] new-message' }) }),
          }),
        ],
        postedTypes: ['[nexus] connection-opened'],
      })
    })

    it('downgrades to plaintext with a warning when no provider is registered for the negotiated protocol', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v2' } }))

      expect({
        negotiated: channel.getNegotiatedProtocol(),
        transport: channel.getSecurityTransport(),
        open: (mockWindow.postMessage as jest.Mock).mock.calls[0][0],
        warns: (mockLogger.warn as jest.Mock).mock.calls,
      }).toEqual({
        negotiated: 'none',
        transport: null,
        open: expect.objectContaining({ security: { active: false, protocol: 'none' } }),
        warns: [[expect.stringContaining("no provider registered for the negotiated 'v2' protocol")]],
      })
    })
  })

  describe('fail-closed initiator', () => {
    const failClosedSettings = { security: { protocol: 'v2', mode: 'fail-closed' } }

    function addFailClosedChannel() {
      const channel = addChannel(routingContext.state, registry, processManager, actions, 'test-channel', mockWindow, failClosedSettings)
      channel.connect()
      const processId = channel.getPendingProcessId()
      if (processId === null) throw new Error('connect() did not record a pending process')
      ;(mockWindow.postMessage as jest.Mock).mockClear()
      return { channel, processId }
    }

    it('aborts before OPEN when the responder negotiated down to plaintext', () => {
      const { channel, processId } = addFailClosedChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))

      expect({
        active: channel.isActive(),
        cancel: (mockWindow.postMessage as jest.Mock).mock.calls[0][0],
        deny: denyHandler.mock.calls[0][0],
      }).toEqual({
        active: false,
        cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
        deny: expect.objectContaining({ reason: 'security-unavailable' }),
      })
    })

    it('aborts before OPEN when the responder predates security negotiation', () => {
      const { channel, processId } = addFailClosedChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent(processId))

      expect({ active: channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({
        active: false,
        deny: expect.objectContaining({ reason: 'security-unavailable', origin: 'http://remote.example' }),
      })
    })

    it('aborts before OPEN when the negotiated provider is missing locally', () => {
      const { channel, processId } = addFailClosedChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v2' } }))

      expect({ active: channel.isActive(), deny: denyHandler.mock.calls[0][0] }).toEqual({
        active: false,
        deny: expect.objectContaining({ reason: 'security-unavailable' }),
      })
    })

    it('logs a warning naming the channel when the security abort happens', () => {
      const { processId } = addFailClosedChannel()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))

      expect(mockLogger.warn).toHaveBeenCalledWith('test-broker aborted the test-channel connection: security is required but unavailable.')
    })

    it('stops retrying after the abort', () => {
      const { processId } = addFailClosedChannel()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))
      ;(mockWindow.postMessage as jest.Mock).mockClear()
      jest.advanceTimersByTime(20_000)

      expect(mockWindow.postMessage).not.toHaveBeenCalled()
    })

    it('completes the handshake when the negotiated protocol is deliverable', () => {
      const { channel, processId } = addFailClosedChannel()

      handleAccept(contextWithProvider().context, acceptEvent(processId, { security: { negotiated: 'v2' } }))

      expect({ active: channel.isActive(), transport: channel.getSecurityTransport()?.getProtocol() }).toEqual({
        active: true,
        transport: 'v2',
      })
    })
  })

  describe('fail-open initiator wanting security', () => {
    it('warns and opens in plaintext when the responder negotiated down to none', () => {
      const channel = addChannel(routingContext.state, registry, processManager, actions, 'test-channel', mockWindow, {
        security: { protocol: 'v2' },
      })
      channel.connect()
      const processId = channel.getPendingProcessId() as string

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))

      expect({ active: channel.isActive(), warns: (mockLogger.warn as jest.Mock).mock.calls }).toEqual({
        active: true,
        warns: [[expect.stringContaining('continuing without encryption')]],
      })
    })

    it('warns and opens in plaintext when the responder predates security negotiation', () => {
      const channel = addChannel(routingContext.state, registry, processManager, actions, 'test-channel', mockWindow, {
        security: { protocol: 'v2' },
      })
      channel.connect()
      const processId = channel.getPendingProcessId() as string

      handleAccept(routingContext, acceptEvent(processId))

      expect({ active: channel.isActive(), warns: (mockLogger.warn as jest.Mock).mock.calls }).toEqual({
        active: true,
        warns: [[expect.stringContaining('predates security negotiation')]],
      })
    })
  })

  it('returns early when action does not have contract', () => {
    const message = {
      data: {
        type: '[nexus] connection-request-accepted',
        processId: 'some-process-id',
        senderId: 'remote-broker-1',
      } as IAction,
      source: mockWindow,
      origin: 'http://remote.example',
    } as MessageEvent<IAction>

    handleAccept(routingContext, message)

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })

  it('returns early when neither the process nor the source window is known', () => {
    const message = acceptEvent('non-existent-process')

    handleAccept(routingContext, message)

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })
})
