import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { ChannelSecurityDependencies } from '../../channel/types'
import type { IAction } from '../../types/action'
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
      getProvider: jest.fn((protocol: SecurityProtocolVersion) => (protocol === 'v4' ? provider : undefined)),
      dispatch: jest.fn(),
    }

    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions,
      logger: mockLogger,
      getSupportedProtocols: () => ['v4', 'none'],
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

  function addRequestingChannel(settings: Record<string, unknown> = {}) {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow, settings, security)
    channel.connect()
    const processId = channel.getPendingProcessId()
    if (processId === null) throw new Error('connect() did not record a pending process')
    ;(mockWindow.postMessage as Mock).mockClear()
    return { channel, processId }
  }

  function postedTypes() {
    return (mockWindow.postMessage as Mock).mock.calls.map((call) => (call[0] as IAction).type)
  }

  it('completes the handshake and sends OPEN', () => {
    const { channel, processId } = addRequestingChannel()

    handleAccept(routingContext, acceptEvent(processId))

    expect({ active: channel.isActive(), open: (mockWindow.postMessage as Mock).mock.calls[0][0] }).toEqual({
      active: true,
      open: expect.objectContaining({ type: '[nexus] connection-opened', processId, senderId: 'broker-1' }),
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
    ;(mockWindow.postMessage as Mock).mockClear()
    jest.advanceTimersByTime(20_000)

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })

  it('flushes queued messages in plaintext after a plaintext handshake', () => {
    const { channel, processId } = addRequestingChannel()
    channel.send('response-message', { seq: 1 })

    handleAccept(routingContext, acceptEvent(processId))

    expect(postedTypes()).toEqual(['[nexus] connection-opened', '[nexus] new-message'])
  })

  describe('replayed ACCEPT', () => {
    it('replays OPEN for a duplicate ACCEPT from the connected counterpart', () => {
      const { processId } = addRequestingChannel()
      handleAccept(routingContext, acceptEvent(processId))
      ;(mockWindow.postMessage as Mock).mockClear()

      handleAccept(routingContext, acceptEvent(processId))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-opened', processId }),
        expect.any(String)
      )
    })

    it('repeats the security confirmation in the replayed OPEN after an encrypted handshake', () => {
      const { processId } = addRequestingChannel({ security: { protocol: 'v4' } })
      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v4' } }))
      ;(mockWindow.postMessage as Mock).mockClear()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v4' } }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-opened', security: { active: true, protocol: 'v4' } }),
        expect.any(String)
      )
    })

    it('repeats the plaintext confirmation in the replayed OPEN after a degraded handshake', () => {
      const { processId } = addRequestingChannel()
      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))
      ;(mockWindow.postMessage as Mock).mockClear()

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'none' } }))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-opened', security: { active: false, protocol: 'none' } }),
        expect.any(String)
      )
    })

    it('omits the security confirmation from the replayed OPEN when the handshake carried none', () => {
      const { processId } = addRequestingChannel()
      handleAccept(routingContext, acceptEvent(processId))
      ;(mockWindow.postMessage as Mock).mockClear()

      handleAccept(routingContext, acceptEvent(processId))

      const sent = (mockWindow.postMessage as Mock).mock.calls[0][0] as IAction & { security?: unknown }
      expect(sent.security).toBeUndefined()
    })

    it('attaches no second transport while replaying OPEN', () => {
      const { processId } = addRequestingChannel({ security: { protocol: 'v4' } })
      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v4' } }))

      handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v4' } }))

      expect(provider.createChannel).toHaveBeenCalledTimes(1)
    })

    it('ignores an ACCEPT from a different sender when already open', () => {
      const { processId } = addRequestingChannel()
      handleAccept(routingContext, acceptEvent(processId))
      ;(mockWindow.postMessage as Mock).mockClear()

      handleAccept(routingContext, acceptEvent(processId, { senderId: 'someone-else' }))

      expect(mockWindow.postMessage).not.toHaveBeenCalled()
    })
  })

  it('drops an ACCEPT from an unexpected origin when one is pinned', () => {
    const { channel, processId } = addRequestingChannel({ origin: 'http://remote.example' })
    const invalidHandler = jest.fn()
    channel.on('invalid', invalidHandler)

    handleAccept(routingContext, acceptEvent(processId, { origin: 'http://evil.example' }))

    expect({
      active: channel.isActive(),
      invalids: invalidHandler.mock.calls.length,
      posts: (mockWindow.postMessage as Mock).mock.calls,
    }).toEqual({
      active: false,
      invalids: 1,
      posts: [],
    })
  })

  describe('unknown process', () => {
    it('fires invalid for an ACCEPT that does not answer the pending request', () => {
      const { channel } = addRequestingChannel()
      const invalidHandler = jest.fn()
      channel.on('invalid', invalidHandler)
      const message = acceptEvent('forged-process')

      handleAccept(routingContext, message)

      expect(invalidHandler.mock.calls[0][0]).toEqual({
        error: "Dropped connection acceptance for unknown process 'forged-process'.",
        action: message.data,
      })
    })

    it('leaves the pending request in flight', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent('forged-process'))

      expect({
        pending: channel.getPendingProcessId(),
        active: channel.isActive(),
        posts: (mockWindow.postMessage as Mock).mock.calls,
      }).toEqual({
        pending: processId,
        active: false,
        posts: [],
      })
    })

    it('fires no deny for an ACCEPT that does not answer the pending request', () => {
      const { channel } = addRequestingChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent('forged-process'))

      expect(denyHandler).not.toHaveBeenCalled()
    })

    it('fires invalid for an ACCEPT resolved by process when the channel is not requesting', () => {
      const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow, {}, security)
      processManager.track('tracked-process', channel)
      const invalidHandler = jest.fn()
      channel.on('invalid', invalidHandler)

      handleAccept(routingContext, acceptEvent('tracked-process'))

      expect({ invalid: invalidHandler.mock.calls[0]?.[0], active: channel.isActive() }).toEqual({
        invalid: expect.objectContaining({ error: "Dropped connection acceptance for unknown process 'tracked-process'." }),
        active: false,
      })
    })

    it('keeps the tracked process when the ACCEPT is dropped', () => {
      const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow, {}, security)
      processManager.track('tracked-process', channel)

      handleAccept(routingContext, acceptEvent('tracked-process'))

      expect(processManager.get('tracked-process')).toBe(channel)
    })
  })

  it('returns early when action does not have contract', () => {
    const { channel, processId } = addRequestingChannel()
    const message = {
      data: {
        type: '[nexus] connection-request-accepted',
        processId,
        senderId: 'remote-broker-1',
      } as IAction,
      source: mockWindow,
      origin: 'http://remote.example',
    } as MessageEvent<IAction>

    handleAccept(routingContext, message)

    expect({ active: channel.isActive(), posts: (mockWindow.postMessage as Mock).mock.calls }).toEqual({ active: false, posts: [] })
  })

  it('returns early when neither the process nor the source window is known', () => {
    handleAccept(routingContext, acceptEvent('non-existent-process'))

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })

  it('resolves the channel by source window when the process is unknown', () => {
    const { channel } = addRequestingChannel()
    const invalidHandler = jest.fn()
    channel.on('invalid', invalidHandler)

    handleAccept(routingContext, acceptEvent('non-existent-process'))

    expect(invalidHandler).toHaveBeenCalledTimes(1)
  })
})
