import type { BrokerState } from '../types'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import { handleRequest } from './handle-request'
import { createRegistry } from '../../core/registry/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createActionCreators, type ActionCreators } from '../../core/actions/factory'

describe('handleRequest', () => {
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
  let mockActions: ActionCreators
  let mockWindow: Window
  let consoleInfoSpy: jest.SpyInstance

  beforeEach(() => {
    registry = createRegistry()
    processManager = createProcessManager()
    mockActions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => validContract,
    })
    mockWindow = <Window>(<unknown>{
      postMessage: jest.fn(),
    })
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation()
  })

  afterEach(() => {
    consoleInfoSpy.mockRestore()
  })

  it('creates new channel for new connection request', () => {
    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleRequest(mockBrokerState, registry, processManager, mockActions, message)

    // Channel should be created and added to registry
    const channel = registry.getByName('remote-broker-1')
    expect(channel).toBeDefined()
  })

  it('reuses existing channel if already registered', () => {
    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    // First request
    handleRequest(mockBrokerState, registry, processManager, mockActions, message)
    const firstChannel = registry.getById('remote-broker-1')

    // Second request with same sender
    handleRequest(mockBrokerState, registry, processManager, mockActions, message)
    const secondChannel = registry.getById('remote-broker-1')

    expect(secondChannel).toBe(firstChannel)
  })

  it('sends acceptance for already open channel with matching sender', () => {
    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    // First request to establish channel
    handleRequest(mockBrokerState, registry, processManager, mockActions, message)

    // Simulate channel being open (in real scenario, would be opened via handshake)
    const channel = registry.getById('remote-broker-1')
    if (channel) {
      // Mock isOpen property
      Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })
      Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

      // Re-add to registry with new ID so getById can find it
      registry.add(channel)
    }

    // Second request when channel already open
    handleRequest(mockBrokerState, registry, processManager, mockActions, message)

    // Should have sent acceptance
    expect(mockWindow.postMessage).toHaveBeenCalled()
  })

  it('logs info when detecting channel reload in debug mode', () => {
    const debugState: BrokerState = {
      ...mockBrokerState,
      settings: { ...mockBrokerState.settings, debug: true },
    }

    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'different-sender-id',
      processId: 'process-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    // First request
    handleRequest(debugState, registry, processManager, mockActions, message)

    // Get channel and mock it as open with different name
    const channel = registry.getByName('different-sender-id')
    if (channel) {
      // Make channel active and change its ID to simulate reload scenario
      // We need to access the internal state setter
      Object.defineProperty(channel, 'isActive', { value: () => true, writable: true, configurable: true })
      Object.defineProperty(channel, 'id', { value: 'original-id', writable: true, configurable: true })
      Object.defineProperty(channel, 'name', { value: 'test-channel', writable: true, configurable: true })
    }

    // Second request with different sender ID (simulating reload)
    handleRequest(debugState, registry, processManager, mockActions, message)

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('detected channel'))
  })

  it('denies connection for invalid contract', () => {
    const invalidContract = <IChannelContract>(<unknown>{
      // Missing required fields
      accepted: null,
    })

    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: invalidContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleRequest(mockBrokerState, registry, processManager, mockActions, message)

    // Should have sent denial
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-denied',
        error: 'Invalid contract.',
      }),
      expect.any(String)
    )
  })

  it('denies connection when security policy rejects', () => {
    const stateWithPolicy: BrokerState = {
      ...mockBrokerState,
      settings: {
        ...mockBrokerState.settings,
        securityPolicy: jest.fn(() => false), // Reject all
      },
    }

    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleRequest(stateWithPolicy, registry, processManager, mockActions, message)

    // Should have sent denial
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-denied',
        error: 'Not accepted.',
      }),
      expect.any(String)
    )
  })

  it('accepts connection when security policy allows', () => {
    const stateWithPolicy: BrokerState = {
      ...mockBrokerState,
      settings: {
        ...mockBrokerState.settings,
        securityPolicy: jest.fn(() => true), // Allow all
      },
    }

    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleRequest(stateWithPolicy, registry, processManager, mockActions, message)

    // Should have sent acceptance
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-accepted',
        processId: 'process-1',
      }),
      expect.any(String)
    )
  })

  it('includes broker contract in acceptance message', () => {
    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleRequest(mockBrokerState, registry, processManager, mockActions, message)

    // Should have sent acceptance with broker's contract
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        contract: mockBrokerState.contract,
        senderId: mockBrokerState.id,
      }),
      expect.any(String)
    )
  })

  it('immediately accepts broker-managed channels (isReadyToConnect returns true)', () => {
    // Channels created by broker.addChannel are broker-managed
    // and should accept immediately without scheduling
    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
      origin: 'https://example.com',
    }

    handleRequest(mockBrokerState, registry, processManager, mockActions, message)

    // Broker-managed channels have isReadyToConnect() = true
    // So acceptance should be sent immediately
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-accepted',
      }),
      expect.any(String)
    )
  })

  it('schedules activation when channel not ready to connect', () => {
    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
      origin: 'https://example.com',
    }

    handleRequest(mockBrokerState, registry, processManager, mockActions, message)

    const channel = registry.getByName('remote-broker-1')
    expect(channel).toBeDefined()

    // Mock channel as not ready
    Object.defineProperty(channel, 'isReadyToConnect', { value: () => false, writable: true })
    const scheduleActivationMock = jest.fn()
    Object.defineProperty(channel, 'scheduleActivation', { value: scheduleActivationMock, writable: true })

    // New request
    const nextAction: IAction = {
      type: '[nexus] connection-request',
      senderId: 'new-remote-broker',
      processId: 'process-2',
      contract: validContract,
    }

    const window2 = <Window>(<unknown>{ postMessage: jest.fn() })
    const nextMessage = <MessageEvent<IAction>>{
      data: nextAction,
      source: window2,
      origin: 'https://other.com',
    }

    handleRequest(mockBrokerState, registry, processManager, mockActions, nextMessage)
  })

  it('logs debug info when scheduling activation', () => {
    const debugState: BrokerState = {
      ...mockBrokerState,
      settings: { ...mockBrokerState.settings, debug: true },
    }

    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
      origin: 'https://example.com',
    }

    handleRequest(debugState, registry, processManager, mockActions, message)

    const channel = registry.getByName('remote-broker-1')
    Object.defineProperty(channel, 'isReadyToConnect', { value: () => false, writable: true, configurable: true })
    Object.defineProperty(channel, 'scheduleActivation', { value: jest.fn(), writable: true, configurable: true })

    const consoleInfoSpy2 = jest.spyOn(console, 'info').mockImplementation()

    handleRequest(debugState, registry, processManager, mockActions, message)

    expect(consoleInfoSpy2).toHaveBeenCalled()
    consoleInfoSpy2.mockRestore()
  })

  it('negotiates security protocol when request includes security', () => {
    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
      security: { supported: ['v1', 'v2'], preferred: 'v2' },
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
      origin: 'https://example.com',
    }

    handleRequest(mockBrokerState, registry, processManager, mockActions, message)

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-accepted',
        security: expect.objectContaining({
          negotiated: expect.any(String),
        }),
      }),
      expect.any(String)
    )
  })

  it('stores pending security request in channel', () => {
    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
      security: { supported: ['v1'], preferred: 'v1' },
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
      origin: 'https://example.com',
    }

    handleRequest(mockBrokerState, registry, processManager, mockActions, message)

    const channel = registry.getByName('remote-broker-1')
    expect(channel).toBeDefined()
  })

  it('logs security negotiation in debug mode', () => {
    const debugState: BrokerState = {
      ...mockBrokerState,
      settings: { ...mockBrokerState.settings, debug: true },
    }

    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'remote-broker-1',
      processId: 'process-1',
      contract: validContract,
      security: { supported: ['v1', 'none'], preferred: 'v1' },
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
      origin: 'https://example.com',
    }

    handleRequest(debugState, registry, processManager, mockActions, message)

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('negotiated security protocol'))
  })
})
