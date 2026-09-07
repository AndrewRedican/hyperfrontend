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
import { describe, expect, it, jest } from '@hyperfrontend/testing'
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
      getSupportedProtocols: () => ['none'],
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

  function contextSupporting(...protocols: SecurityProtocolVersion[]): RoutingContext {
    return { ...routingContext, getSupportedProtocols: () => [...protocols, 'none'] }
  }

  it('creates a channel named from the requester origin, not its instance id', () => {
    handleRequest(routingContext, requestEvent())

    expect({
      byOrigin: registry.getByName('inbound-https://example.com')?.name,
      byInstance: registry.getByName('remote-broker-1'),
    }).toEqual({
      byOrigin: 'inbound-https://example.com',
      byInstance: undefined,
    })
  })

  it('reuses the channel registered for the source window', () => {
    handleRequest(routingContext, requestEvent())
    const firstChannel = registry.getByName('inbound-https://example.com')

    handleRequest(routingContext, requestEvent())

    expect(registry.getAll()).toEqual([firstChannel])
  })

  it('schedules activation and tracks the process when the local side is not ready', () => {
    handleRequest(routingContext, requestEvent())

    const channel = registry.getByName('inbound-https://example.com')
    expect({ tracked: processManager.get('process-1'), accepted: (mockWindow.postMessage as Mock).mock.calls }).toEqual({
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

  it('omits the security slot from ACCEPT when the request carried none', () => {
    addReadyChannel()

    handleRequest(routingContext, requestEvent())

    const sent = (mockWindow.postMessage as Mock).mock.calls[0][0] as IAction & { security?: unknown }
    expect(sent.security).toBeUndefined()
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

    const acceptFrames = (mockWindow.postMessage as Mock).mock.calls.filter(
      (call) => (call[0] as IAction).type === '[nexus] connection-request-accepted'
    )
    expect(acceptFrames).toHaveLength(3)
  })

  it('drops requests from an unexpected origin when one is pinned', () => {
    const channel = addReadyChannel({ origin: 'https://pinned.example' })
    const invalidHandler = jest.fn()
    channel.on('invalid', invalidHandler)

    handleRequest(routingContext, requestEvent({ origin: 'https://evil.example' }))

    expect({ posts: (mockWindow.postMessage as Mock).mock.calls, invalids: invalidHandler.mock.calls.length }).toEqual({
      posts: [],
      invalids: 1,
    })
  })

  it('returns early when action lacks contract property', () => {
    const message = {
      data: {
        type: '[nexus] connection-request',
        senderId: 'remote-broker-1',
        processId: 'process-1',
      } as IAction,
      source: mockWindow,
      origin: 'https://example.com',
    } as MessageEvent<IAction>

    handleRequest(routingContext, message)

    expect(registry.getAll()).toEqual([])
  })

  it('tracks the process for the coming OPEN when responding', () => {
    const channel = addReadyChannel() as unknown as ChannelHandle

    handleRequest(routingContext, requestEvent())

    expect(processManager.get('process-1')).toBe(channel)
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

    it('repeats the recorded plaintext outcome in the replayed ACCEPT', () => {
      const channel = addActiveChannel()
      channel.setNegotiatedProtocol('none')

      handleRequest(routingContext, requestEvent({ security: { supported: ['none'], preferred: 'none' } }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-request-accepted', security: { negotiated: 'none' } }),
        expect.any(String)
      )
    })

    it('repeats the recorded protocol instead of renegotiating what the duplicate request offers', () => {
      const channel = addActiveChannel()
      channel.setNegotiatedProtocol('v4')

      handleRequest(contextSupporting('v3'), requestEvent({ security: { supported: ['v3', 'none'], preferred: 'v3' } }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-request-accepted', security: { negotiated: 'v4' } }),
        expect.any(String)
      )
    })

    it('attaches no transport while replaying ACCEPT', () => {
      const channel = addActiveChannel()
      channel.setNegotiatedProtocol('v4')

      handleRequest(contextSupporting('v4'), requestEvent({ security: { supported: ['v4', 'none'], preferred: 'v4' } }))

      expect(provider.createChannel).not.toHaveBeenCalled()
    })

    it('omits the security response from the replayed ACCEPT when the duplicate request has none', () => {
      const channel = addActiveChannel()
      channel.setNegotiatedProtocol('v4')

      handleRequest(routingContext, requestEvent())

      const sent = (mockWindow.postMessage as Mock).mock.calls[0][0] as IAction & { security?: unknown }
      expect(sent.security).toBeUndefined()
    })

    it('omits the security response from the replayed ACCEPT when no protocol is recorded', () => {
      addActiveChannel()

      handleRequest(routingContext, requestEvent({ security: { supported: ['none'], preferred: 'none' } }))

      const sent = (mockWindow.postMessage as Mock).mock.calls[0][0] as IAction & { security?: unknown }
      expect(sent.security).toBeUndefined()
    })

    it('ends the stale session with a reload reason and re-handshakes with the new instance', () => {
      const channel = addActiveChannel()
      const close = jest.fn()
      channel.on('close', close)

      handleRequest(routingContext, requestEvent({ senderId: 'remote-broker-2', processId: 'process-2' }))

      expect({
        peerId: channel.getPeerId(),
        closed: close.mock.calls[0]?.[0],
        accepted: (mockWindow.postMessage as Mock).mock.calls[0][0],
      }).toEqual({
        peerId: 'remote-broker-2',
        closed: { notify: false, reason: 'peer-reload' },
        accepted: expect.objectContaining({ type: '[nexus] connection-request-accepted', processId: 'process-2' }),
      })
    })

    it('logs the reload detection', () => {
      addActiveChannel()

      handleRequest(routingContext, requestEvent({ senderId: 'remote-broker-2', processId: 'process-2' }))

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('detected channel'))
    })

    it('releases the stale security transport when the counterpart reloaded', () => {
      const channel = addActiveChannel()
      channel.setNegotiatedProtocol('v4')
      channel.attachSecurityTransport('v4', 'remote-broker-1', 'responder')

      handleRequest(routingContext, requestEvent({ senderId: 'remote-broker-2', processId: 'process-2' }))

      expect({
        transport: channel.getSecurityTransport(),
        negotiated: channel.getNegotiatedProtocol(),
      }).toEqual({
        transport: null,
        negotiated: null,
      })
    })
  })

  describe('glare', () => {
    function addRequestingChannel() {
      const channel = addChannel(mockBrokerState, registry, processManager, mockActions, 'local-channel', mockWindow, {}, security)
      channel.connect()
      ;(mockWindow.postMessage as Mock).mockClear()
      return channel
    }

    it('yields and answers as responder when the local broker id is lower', () => {
      const channel = addRequestingChannel()

      handleRequest(routingContext, requestEvent({ senderId: 'z-remote-broker' }))

      expect({ pending: channel.getPendingProcessId(), reply: (mockWindow.postMessage as Mock).mock.calls[0][0] }).toEqual({
        pending: null,
        reply: expect.objectContaining({ type: '[nexus] connection-request-accepted', processId: 'process-1' }),
      })
    })

    it('ignores the inbound request when the local broker id is higher', () => {
      const channel = addRequestingChannel()

      handleRequest(routingContext, requestEvent({ senderId: 'a-remote-broker' }))

      expect({ pending: channel.getPendingProcessId(), posts: (mockWindow.postMessage as Mock).mock.calls }).toEqual({
        pending: expect.any(String),
        posts: [],
      })
    })
  })
})
