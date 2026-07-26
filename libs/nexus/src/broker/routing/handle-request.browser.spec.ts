import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { IChannelContract } from '../../types/contract'
import type { SecurityTransport } from '../../types/security'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleRequest } from './handle-request'

describe('handleRequest', () => {
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
  let mockActions: ReturnType<typeof createActionCreators>
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
      window: <Window>global.window,
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
    mockWindow = <Window>(<unknown>{
      postMessage: jest.fn(),
    })

    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions: mockActions,
      logger: mockLogger,
      getSupportedProtocols: () => ['none'],
      getProtocol: () => undefined,
      routeAction: () => undefined,
    }
  })

  function requestEvent(
    overrides: Partial<{ senderId: string; processId: string; contract: IChannelContract; origin: string; security: unknown }> = {}
  ) {
    return <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] connection-request',
        senderId: overrides.senderId ?? 'remote-broker-1',
        processId: overrides.processId ?? 'process-1',
        contract: overrides.contract ?? peerContract,
        ...(overrides.security ? { security: overrides.security } : {}),
      },
      source: mockWindow,
      origin: overrides.origin ?? 'https://example.com',
    }
  }

  function addReadyChannel(settings: Record<string, unknown> = {}) {
    const channel = addChannel(mockBrokerState, registry, processManager, mockActions, 'local-channel', mockWindow, settings)
    // how: connect() marks the channel ready; cancel(false) clears the
    channel.connect()
    channel.cancel(false)
    ;(<jest.Mock>mockWindow.postMessage).mockClear()
    return channel
  }

  it('creates new channel for new connection request', () => {
    handleRequest(routingContext, requestEvent())

    expect(registry.getByName('remote-broker-1')).toBeDefined()
  })

  it('reuses the channel registered for the source window', () => {
    handleRequest(routingContext, requestEvent())
    const firstChannel = registry.getByName('remote-broker-1')

    handleRequest(routingContext, requestEvent())

    expect(registry.getAll()).toEqual([firstChannel])
  })

  it('schedules activation and tracks the process when the local side is not ready', () => {
    handleRequest(routingContext, requestEvent())

    const channel = registry.getByName('remote-broker-1')
    expect({ tracked: processManager.get('process-1'), accepted: (<jest.Mock>mockWindow.postMessage).mock.calls }).toEqual({
      tracked: channel,
      accepted: [],
    })
  })

  it('logs info when scheduling activation', () => {
    handleRequest(routingContext, requestEvent())

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('scheduled activation'))
  })

  it('sends ACCEPT with the broker contract when the local side is ready', () => {
    addReadyChannel()

    handleRequest(routingContext, requestEvent())

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-accepted',
        processId: 'process-1',
        senderId: 'broker-1',
        contract: ownContract,
      }),
      expect.any(String)
    )
  })

  it('pins the origin from the request event', () => {
    const channel = addReadyChannel()

    handleRequest(routingContext, requestEvent({ origin: 'https://feature.example' }))

    expect(channel.getOrigin()).toBe('https://feature.example')
  })

  it('records the peer details while waiting for OPEN', () => {
    const channel = addReadyChannel()

    handleRequest(routingContext, requestEvent())

    expect({ peerId: channel.getPeerId(), peerContract: channel.getPeerContract(), active: channel.isActive() }).toEqual({
      peerId: 'remote-broker-1',
      peerContract,
      active: false,
    })
  })

  it('re-sends ACCEPT until OPEN arrives', () => {
    addReadyChannel()

    handleRequest(routingContext, requestEvent())
    jest.advanceTimersByTime(1000)

    const acceptFrames = (<jest.Mock>mockWindow.postMessage).mock.calls.filter(
      (call) => (<IAction>call[0]).type === '[nexus] connection-request-accepted'
    )
    expect(acceptFrames).toHaveLength(3)
  })

  it('drops requests from an unexpected origin when one is pinned', () => {
    const channel = addReadyChannel({ origin: 'https://pinned.example' })
    const invalidHandler = jest.fn()
    channel.on('invalid', invalidHandler)

    handleRequest(routingContext, requestEvent({ origin: 'https://evil.example' }))

    expect({ posts: (<jest.Mock>mockWindow.postMessage).mock.calls, invalids: invalidHandler.mock.calls.length }).toEqual({
      posts: [],
      invalids: 1,
    })
  })

  it('denies connection for invalid contract', () => {
    addReadyChannel()

    handleRequest(routingContext, requestEvent({ contract: <IChannelContract>(<unknown>{ accepted: null }) }))

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-denied',
        error: 'Invalid contract.',
      }),
      expect.any(String)
    )
  })

  it('denies connection when the peer does not emit a required action', () => {
    addReadyChannel()

    handleRequest(
      routingContext,
      requestEvent({ contract: { accepted: [{ type: 'response-message' }], emitted: [{ type: 'unrelated-type' }] } })
    )

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-denied',
        error: 'Incompatible contract: missing required actions test-message.',
      }),
      expect.any(String)
    )
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

  it('denies connection when security policy rejects', () => {
    const contextWithPolicy: RoutingContext = {
      ...routingContext,
      state: {
        ...mockBrokerState,
        settings: {
          ...mockBrokerState.settings,
          securityPolicy: jest.fn(() => false),
        },
      },
    }
    addReadyChannel()

    handleRequest(contextWithPolicy, requestEvent())

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-denied',
        error: 'Not accepted.',
      }),
      expect.any(String)
    )
  })

  it('accepts connection when security policy allows', () => {
    const contextWithPolicy: RoutingContext = {
      ...routingContext,
      state: {
        ...mockBrokerState,
        settings: {
          ...mockBrokerState.settings,
          securityPolicy: jest.fn(() => true),
        },
      },
    }
    addReadyChannel()

    handleRequest(contextWithPolicy, requestEvent())

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-accepted',
        processId: 'process-1',
      }),
      expect.any(String)
    )
  })

  it('negotiates security protocol when request includes security', () => {
    addReadyChannel()

    handleRequest(routingContext, requestEvent({ security: { supported: ['v1', 'none'], preferred: 'v1' } }))

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-accepted',
        security: expect.objectContaining({ negotiated: expect.any(String) }),
      }),
      expect.any(String)
    )
  })

  it('logs security negotiation', () => {
    addReadyChannel()

    handleRequest(routingContext, requestEvent({ security: { supported: ['v1', 'none'], preferred: 'v1' } }))

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('negotiated security protocol'))
  })

  it('stores the pending security request in the channel', () => {
    const channel = addReadyChannel()

    handleRequest(routingContext, requestEvent({ security: { supported: ['v1'], preferred: 'v1' } }))

    expect(channel.getPendingSecurityRequest()).toEqual({ supported: ['v1'], preferred: 'v1' })
  })

  describe('registry-sourced negotiation', () => {
    function contextSupporting(...protocols: string[]): RoutingContext {
      return { ...routingContext, getSupportedProtocols: () => [...protocols, 'none'] }
    }

    it('negotiates the protocol offered by the broker protocol registry', () => {
      addReadyChannel()

      handleRequest(contextSupporting('v2'), requestEvent({ security: { supported: ['v2', 'none'], preferred: 'v2' } }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-accepted',
          security: { negotiated: 'v2' },
        }),
        expect.any(String)
      )
    })

    it('records the negotiated protocol on the channel', () => {
      const channel = addReadyChannel()

      handleRequest(contextSupporting('v2'), requestEvent({ security: { supported: ['v2', 'none'], preferred: 'v2' } }))

      expect(channel.getNegotiatedProtocol()).toBe('v2')
    })

    it('negotiates none when the registry has no protocol in common with the request', () => {
      addReadyChannel()

      handleRequest(contextSupporting('v2'), requestEvent({ security: { supported: ['v1', 'none'], preferred: 'v1' } }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(expect.objectContaining({ security: { negotiated: 'none' } }), expect.any(String))
    })

    it('answers the replayed ACCEPT with a registry-sourced negotiation', () => {
      const channel = addReadyChannel()
      channel.activate('https://example.com', peerContract, 'remote-broker-1')

      handleRequest(contextSupporting('v2'), requestEvent({ security: { supported: ['v2', 'none'], preferred: 'v2' } }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(expect.objectContaining({ security: { negotiated: 'v2' } }), expect.any(String))
    })

    it('carries the negotiated response through a scheduled activation into the ACCEPT', () => {
      const channel = addChannel(mockBrokerState, registry, processManager, mockActions, 'local-channel', mockWindow)

      handleRequest(contextSupporting('v2'), requestEvent({ security: { supported: ['v2', 'none'], preferred: 'v2' } }))
      channel.connect()

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-accepted',
          security: { negotiated: 'v2' },
        }),
        expect.any(String)
      )
    })
  })

  describe('fail-closed responder', () => {
    const failClosedSettings = { security: { protocol: 'v2', mode: 'fail-closed' } }

    it('denies with reason security-unavailable when the request carries no security slot', () => {
      addReadyChannel(failClosedSettings)

      handleRequest(routingContext, requestEvent())

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-denied',
          reason: 'security-unavailable',
          error: expect.stringContaining('Security is required'),
        }),
        expect.any(String)
      )
    })

    it('denies with reason security-unavailable when negotiation ends in plaintext', () => {
      addReadyChannel(failClosedSettings)

      handleRequest(routingContext, requestEvent({ security: { supported: ['v1', 'none'], preferred: 'v1' } }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-denied',
          reason: 'security-unavailable',
        }),
        expect.any(String)
      )
    })

    it('accepts when the registry satisfies the requested protocol', () => {
      addReadyChannel(failClosedSettings)

      handleRequest(
        { ...routingContext, getSupportedProtocols: () => ['v2', 'none'] },
        requestEvent({ security: { supported: ['v2', 'none'], preferred: 'v2' } })
      )

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-accepted',
          security: { negotiated: 'v2' },
        }),
        expect.any(String)
      )
    })
  })

  describe('fail-open responder wanting security', () => {
    it('warns and accepts in plaintext when the request carries no security slot', () => {
      addReadyChannel({ security: { protocol: 'v2' } })

      handleRequest(routingContext, requestEvent())

      expect({ accept: (<jest.Mock>mockWindow.postMessage).mock.calls[0][0], warns: (<jest.Mock>mockLogger.warn).mock.calls }).toEqual({
        accept: expect.objectContaining({ type: '[nexus] connection-request-accepted' }),
        warns: [[expect.stringContaining('continuing without encryption')]],
      })
    })
  })

  describe('active channel', () => {
    function addActiveChannel() {
      const channel = addReadyChannel()
      channel.activate('https://example.com', peerContract, 'remote-broker-1')
      return channel
    }

    it('replays ACCEPT for a duplicate request from the connected counterpart', () => {
      addActiveChannel()

      handleRequest(routingContext, requestEvent())

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-accepted',
          processId: 'process-1',
        }),
        expect.any(String)
      )
    })

    it('includes a security response in the replayed ACCEPT when the duplicate request has security', () => {
      addActiveChannel()

      handleRequest(routingContext, requestEvent({ security: { supported: ['none'], preferred: 'none' } }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: '[nexus] connection-request-accepted',
          security: expect.objectContaining({ negotiated: expect.any(String) }),
        }),
        expect.any(String)
      )
    })

    it('omits the security response from the replayed ACCEPT when the duplicate request has none', () => {
      addActiveChannel()

      handleRequest(routingContext, requestEvent())

      const sent = <IAction & { security?: unknown }>(<jest.Mock>mockWindow.postMessage).mock.calls[0][0]
      expect(sent.security).toBeUndefined()
    })

    it('tears down and re-handshakes when the counterpart reloaded with a new id', () => {
      const channel = addActiveChannel()

      handleRequest(routingContext, requestEvent({ senderId: 'remote-broker-2', processId: 'process-2' }))

      expect({ peerId: channel.getPeerId(), accepted: (<jest.Mock>mockWindow.postMessage).mock.calls[0][0] }).toEqual({
        peerId: 'remote-broker-2',
        accepted: expect.objectContaining({ type: '[nexus] connection-request-accepted', processId: 'process-2' }),
      })
    })

    it('logs the reload detection', () => {
      addActiveChannel()

      handleRequest(routingContext, requestEvent({ senderId: 'remote-broker-2', processId: 'process-2' }))

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('detected channel'))
    })

    it('detaches the stale security transport when the counterpart reloaded', () => {
      const channel = addActiveChannel()
      channel.setNegotiatedProtocol('v2')
      channel.setSecurityTransport(<SecurityTransport>(<unknown>{ send: jest.fn(), isReady: () => true }))

      handleRequest(routingContext, requestEvent({ senderId: 'remote-broker-2', processId: 'process-2' }))

      expect({ transport: channel.getSecurityTransport(), negotiated: channel.getNegotiatedProtocol() }).toEqual({
        transport: null,
        negotiated: null,
      })
    })
  })

  describe('glare', () => {
    function addRequestingChannel() {
      const channel = addChannel(mockBrokerState, registry, processManager, mockActions, 'local-channel', mockWindow)
      channel.connect()
      ;(<jest.Mock>mockWindow.postMessage).mockClear()
      return channel
    }

    it('yields and answers as responder when the local broker id is lower', () => {
      const channel = addRequestingChannel()

      handleRequest(routingContext, requestEvent({ senderId: 'z-remote-broker' }))

      expect({ pending: channel.getPendingProcessId(), reply: (<jest.Mock>mockWindow.postMessage).mock.calls[0][0] }).toEqual({
        pending: null,
        reply: expect.objectContaining({ type: '[nexus] connection-request-accepted', processId: 'process-1' }),
      })
    })

    it('ignores the inbound request when the local broker id is higher', () => {
      const channel = addRequestingChannel()

      handleRequest(routingContext, requestEvent({ senderId: 'a-remote-broker' }))

      expect({ pending: channel.getPendingProcessId(), posts: (<jest.Mock>mockWindow.postMessage).mock.calls }).toEqual({
        pending: expect.any(String),
        posts: [],
      })
    })
  })

  it('returns early when action lacks contract property', () => {
    const message = <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] connection-request',
        senderId: 'remote-broker-1',
        processId: 'process-1',
      },
      source: mockWindow,
      origin: 'https://example.com',
    }

    handleRequest(routingContext, message)

    expect(registry.getByName('remote-broker-1')).toBeUndefined()
  })

  it('tracks the process for the coming OPEN when responding', () => {
    const channel = <ChannelHandle>(<unknown>addReadyChannel())

    handleRequest(routingContext, requestEvent())

    expect(processManager.get('process-1')).toBe(channel)
  })
})
