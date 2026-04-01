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
  const validContract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message' }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  let mockLogger: Logger
  let mockBrokerState: BrokerState

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ReturnType<typeof createActionCreators>
  let mockWindow: Window
  let routingContext: RoutingContext

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
      contract: validContract,
      settings: {
        contract: validContract,
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

  it('handles acceptance and send open connection', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-accepted',
      processId,
      senderId: 'remote-broker-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleAccept(routingContext, message)

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-opened',
        processId,
      }),
      expect.any(String)
    )
  })

  it('handles security response with none protocol', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const setNegotiatedProtocolMock = jest.fn()
    const setSecurityReadyMock = jest.fn()
    Object.defineProperty(channel, 'setNegotiatedProtocol', { value: setNegotiatedProtocolMock, writable: true })
    Object.defineProperty(channel, 'setSecurityReady', { value: setSecurityReadyMock, writable: true })

    const action: IAction = {
      type: '[nexus] connection-request-accepted',
      processId,
      senderId: 'remote-broker-1',
      contract: validContract,
      security: { negotiated: 'none' },
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      origin: 'http://example.com',
      source: mockWindow,
    }

    handleAccept(routingContext, message)

    expect(setNegotiatedProtocolMock).toHaveBeenCalledWith('none')
    expect(setSecurityReadyMock).toHaveBeenCalledWith(true)
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-opened',
        security: { active: false, protocol: 'none' },
      }),
      expect.any(String)
    )
  })

  it('handles security response with v1 protocol', () => {
    const debugState: BrokerState = {
      ...mockBrokerState,
      settings: { ...mockBrokerState.settings, logLevel: 'debug' },
    }

    const debugContext: RoutingContext = {
      ...routingContext,
      state: debugState,
    }

    const channel = addChannel(debugState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const setNegotiatedProtocolMock = jest.fn()
    Object.defineProperty(channel, 'setNegotiatedProtocol', { value: setNegotiatedProtocolMock, writable: true })

    const action: IAction = {
      type: '[nexus] connection-request-accepted',
      processId,
      senderId: 'remote-broker-1',
      contract: validContract,
      security: { negotiated: 'v1' },
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      origin: 'http://example.com',
      source: mockWindow,
    }

    handleAccept(debugContext, message)

    expect(setNegotiatedProtocolMock).toHaveBeenCalledWith('v1')
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('accepted security protocol: v1'))
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        security: { active: true, protocol: 'v1' },
      }),
      expect.any(String)
    )
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] connection-request-accepted',
      processId: 'non-existent-process',
      senderId: 'remote-broker-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleAccept(routingContext, message)
    }).not.toThrow()
  })

  it('ignore if channel already open', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })

    const action: IAction = {
      type: '[nexus] connection-request-accepted',
      processId,
      senderId: 'remote-broker-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    const postMessageCallsBefore = (<jest.Mock>mockWindow.postMessage).mock.calls.length

    handleAccept(routingContext, message)

    expect((<jest.Mock>mockWindow.postMessage).mock.calls.length).toBe(postMessageCallsBefore)
  })

  it('cancel connection for invalid contract', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const invalidContract = <IChannelContract>(<unknown>{
      accepted: null,
    })

    const action: IAction = {
      type: '[nexus] connection-request-accepted',
      processId,
      senderId: 'remote-broker-1',
      contract: invalidContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleAccept(routingContext, message)

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-cancelled',
        processId,
      }),
      expect.any(String)
    )
  })

  it('cancel connection when security policy rejects', () => {
    const stateWithPolicy: BrokerState = {
      ...mockBrokerState,
      settings: {
        ...mockBrokerState.settings,
        securityPolicy: jest.fn(() => false),
      },
    }

    const contextWithPolicy: RoutingContext = {
      ...routingContext,
      state: stateWithPolicy,
    }

    const channel = addChannel(stateWithPolicy, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-accepted',
      processId,
      senderId: 'remote-broker-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleAccept(contextWithPolicy, message)

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-cancelled',
        processId,
      }),
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

    const contextWithPolicy: RoutingContext = {
      ...routingContext,
      state: stateWithPolicy,
    }

    const channel = addChannel(stateWithPolicy, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-accepted',
      processId,
      senderId: 'remote-broker-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleAccept(contextWithPolicy, message)

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-opened',
        processId,
      }),
      expect.any(String)
    )
  })

  it('returns early when action does not have contract', () => {
    const action = {
      type: '[nexus] connection-request-accepted',
      processId: 'some-process-id',
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: <IAction>action,
      source: mockWindow,
    }

    expect(() => {
      handleAccept(routingContext, message)
    }).not.toThrow()

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })

  it('returns early when channel not found via processId', () => {
    const action: IAction = {
      type: '[nexus] connection-request-accepted',
      processId: 'non-existent-process',
      senderId: 'remote-broker-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleAccept(routingContext, message)
    }).not.toThrow()

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })
})
