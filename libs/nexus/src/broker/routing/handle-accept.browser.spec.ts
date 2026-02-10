import type { BrokerState } from '../types'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import { handleAccept } from './handle-accept'
import { createRegistry } from '../../core/registry/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createActionCreators } from '../../core/actions/factory'
import { addChannel } from '../channels/add'

describe('handleAccept', () => {
  const validContract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message' }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  const mockBrokerState: BrokerState = {
    id: 'broker-1',
    name: 'test-broker',
    window: <Window>global.window,
    contract: validContract,
    settings: {
      contract: validContract,
      debug: false,
    },
  }

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ReturnType<typeof createActionCreators>
  let mockWindow: Window

  beforeEach(() => {
    registry = createRegistry()
    processManager = createProcessManager()
    actions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => mockBrokerState.contract,
    })
    mockWindow = <Window>(<unknown>{
      postMessage: jest.fn(),
    })
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

    handleAccept(mockBrokerState, registry, processManager, actions, message)

    // Should send OPEN_CONNECTION
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

    handleAccept(mockBrokerState, registry, processManager, actions, message)

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
      settings: { ...mockBrokerState.settings, debug: true },
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

    const consoleSpy = jest.spyOn(console, 'info').mockImplementation()

    const message = <MessageEvent<IAction>>{
      data: action,
      origin: 'http://example.com',
      source: mockWindow,
    }

    handleAccept(debugState, registry, processManager, actions, message)

    expect(setNegotiatedProtocolMock).toHaveBeenCalledWith('v1')
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('accepted security protocol: v1'))
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        security: { active: true, protocol: 'v1' },
      }),
      expect.any(String)
    )

    consoleSpy.mockRestore()
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
      handleAccept(mockBrokerState, registry, processManager, actions, message)
    }).not.toThrow()
  })

  it('ignore if channel already open', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    // Mock channel as already open
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

    handleAccept(mockBrokerState, registry, processManager, actions, message)

    // Should not send any new messages
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

    handleAccept(mockBrokerState, registry, processManager, actions, message)

    // Should send cancellation
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
        securityPolicy: jest.fn(() => false), // Reject all
      },
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

    handleAccept(stateWithPolicy, registry, processManager, actions, message)

    // Should send cancellation
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-cancelled',
        processId,
      }),
      expect.any(String)
    )

    // Security policy should have been called
    expect(stateWithPolicy.settings.securityPolicy).toHaveBeenCalledWith(message)
  })

  it('proceed when security policy allows', () => {
    const stateWithPolicy: BrokerState = {
      ...mockBrokerState,
      settings: {
        ...mockBrokerState.settings,
        securityPolicy: jest.fn(() => true), // Allow all
      },
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

    handleAccept(stateWithPolicy, registry, processManager, actions, message)

    // Should send OPEN_CONNECTION
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-opened',
        processId,
      }),
      expect.any(String)
    )
  })
})
