import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
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
      window: <Window>global.window,
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
    mockWindow = <Window>(<unknown>{
      postMessage: jest.fn(),
    })

    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions,
      logger: mockLogger,
    }
  })

  function acceptEvent(
    processId: string,
    overrides: Partial<{ senderId: string; contract: IChannelContract; origin: string; security: unknown }> = {}
  ) {
    return <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] connection-request-accepted',
        processId,
        senderId: overrides.senderId ?? 'remote-broker-1',
        contract: overrides.contract ?? peerContract,
        ...(overrides.security ? { security: overrides.security } : {}),
      },
      origin: overrides.origin ?? 'http://remote.example',
      source: mockWindow,
    }
  }

  function addRequestingChannel(context: RoutingContext = routingContext) {
    const channel = addChannel(context.state, registry, processManager, actions, 'test-channel', mockWindow)
    channel.connect()
    const processId = channel.getPendingProcessId()
    if (processId === null) throw new Error('connect() did not record a pending process')
    ;(<jest.Mock>mockWindow.postMessage).mockClear()
    return { channel, processId }
  }

  it('completes the handshake and sends OPEN', () => {
    const { channel, processId } = addRequestingChannel()

    handleAccept(routingContext, acceptEvent(processId))

    expect({ active: channel.isActive(), open: (<jest.Mock>mockWindow.postMessage).mock.calls[0][0] }).toEqual({
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
    ;(<jest.Mock>mockWindow.postMessage).mockClear()
    jest.advanceTimersByTime(20_000)

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })

  it('replays OPEN for a duplicate ACCEPT from the connected counterpart', () => {
    const { processId } = addRequestingChannel()
    handleAccept(routingContext, acceptEvent(processId))
    ;(<jest.Mock>mockWindow.postMessage).mockClear()

    handleAccept(routingContext, acceptEvent(processId))

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: '[nexus] connection-opened', processId }),
      expect.any(String)
    )
  })

  it('ignores an ACCEPT from a different sender when already open', () => {
    const { processId } = addRequestingChannel()
    handleAccept(routingContext, acceptEvent(processId))
    ;(<jest.Mock>mockWindow.postMessage).mockClear()

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
    ;(<jest.Mock>mockWindow.postMessage).mockClear()
    const invalidHandler = jest.fn()
    channel.on('invalid', invalidHandler)

    handleAccept(contextWithOrigin, acceptEvent(processId, { origin: 'http://evil.example' }))

    expect({
      active: channel.isActive(),
      invalids: invalidHandler.mock.calls.length,
      posts: (<jest.Mock>mockWindow.postMessage).mock.calls,
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

    handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v1' } }))

    expect({ negotiated: channel.getNegotiatedProtocol(), open: (<jest.Mock>mockWindow.postMessage).mock.calls[0][0] }).toEqual({
      negotiated: 'v1',
      open: expect.objectContaining({ security: { active: true, protocol: 'v1' } }),
    })
  })

  it('logs the accepted security protocol', () => {
    const { processId } = addRequestingChannel()

    handleAccept(routingContext, acceptEvent(processId, { security: { negotiated: 'v1' } }))

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('accepted security protocol: v1'))
  })

  it('cancel connection for invalid contract', () => {
    const { channel, processId } = addRequestingChannel()

    handleAccept(routingContext, acceptEvent(processId, { contract: <IChannelContract>(<unknown>{ accepted: null }) }))

    expect({ active: channel.isActive(), cancel: (<jest.Mock>mockWindow.postMessage).mock.calls[0][0] }).toEqual({
      active: false,
      cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
    })
  })

  it('cancel connection when the responder does not emit a required action', () => {
    const { channel, processId } = addRequestingChannel()

    handleAccept(
      routingContext,
      acceptEvent(processId, { contract: { accepted: [{ type: 'response-message' }], emitted: [{ type: 'unrelated-type' }] } })
    )

    expect({ active: channel.isActive(), cancel: (<jest.Mock>mockWindow.postMessage).mock.calls[0][0] }).toEqual({
      active: false,
      cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
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

  it('stops retrying after cancelling on an invalid contract', () => {
    const { processId } = addRequestingChannel()

    handleAccept(routingContext, acceptEvent(processId, { contract: <IChannelContract>(<unknown>{ accepted: null }) }))
    ;(<jest.Mock>mockWindow.postMessage).mockClear()
    jest.advanceTimersByTime(20_000)

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })

  it('cancel connection when security policy rejects', () => {
    const stateWithPolicy: BrokerState = {
      ...mockBrokerState,
      settings: {
        ...mockBrokerState.settings,
        securityPolicy: jest.fn(() => false),
      },
    }
    const contextWithPolicy: RoutingContext = { ...routingContext, state: stateWithPolicy }
    const { processId } = addRequestingChannel(contextWithPolicy)

    const message = acceptEvent(processId)
    handleAccept(contextWithPolicy, message)

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
      expect.any(String)
    )
    expect(stateWithPolicy.settings.securityPolicy).toHaveBeenCalledWith(message)
  })

  it('proceed when security policy allows', () => {
    const stateWithPolicy: BrokerState = {
      ...mockBrokerState,
      settings: {
        ...mockBrokerState.settings,
        securityPolicy: jest.fn(() => true),
      },
    }
    const contextWithPolicy: RoutingContext = { ...routingContext, state: stateWithPolicy }
    const { processId } = addRequestingChannel(contextWithPolicy)

    handleAccept(contextWithPolicy, acceptEvent(processId))

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: '[nexus] connection-opened', processId }),
      expect.any(String)
    )
  })

  it('returns early when action does not have contract', () => {
    const message = <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] connection-request-accepted',
        processId: 'some-process-id',
        senderId: 'remote-broker-1',
      },
      source: mockWindow,
      origin: 'http://remote.example',
    }

    handleAccept(routingContext, message)

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })

  it('returns early when neither the process nor the source window is known', () => {
    const message = acceptEvent('non-existent-process')

    handleAccept(routingContext, message)

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })
})
