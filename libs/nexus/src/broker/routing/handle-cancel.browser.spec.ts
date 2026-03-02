import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleCancel } from './handle-cancel'

describe('handleCancel', () => {
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

  it('cancel connection and send acknowledgement', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-cancelled',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleCancel(routingContext, message)

    // Should send acknowledgement
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-cancelled-acknowledged',
        processId,
      }),
      expect.any(String)
    )
  })

  it('find channel by sender ID', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    // Mock channel with ID
    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)

    const action: IAction = {
      type: '[nexus] connection-request-cancelled',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleCancel(routingContext, message)

    expect(mockWindow.postMessage).toHaveBeenCalled()
  })

  it('find channel by process ID if sender ID lookup fails', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-cancelled',
      processId,
      senderId: 'different-id',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleCancel(routingContext, message)

    expect(mockWindow.postMessage).toHaveBeenCalled()
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] connection-request-cancelled',
      processId: 'non-existent-process',
      senderId: 'non-existent-sender',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleCancel(routingContext, message)
    }).not.toThrow()
  })

  it('calls channel cancel method without notification', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const cancelSpy = jest.spyOn(channel, 'cancel')

    const action: IAction = {
      type: '[nexus] connection-request-cancelled',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleCancel(routingContext, message)

    // Should call cancel with notify=false
    expect(cancelSpy).toHaveBeenCalledWith(false)
  })

  it('handles multiple cancellations', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const processId1 = processManager.create(channel1)

    const window2 = <Window>(<unknown>{ postMessage: jest.fn() })
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    const processId2 = processManager.create(channel2)

    handleCancel(routingContext, <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] connection-request-cancelled',
        processId: processId1,
        senderId: 'remote-1',
      },
      source: mockWindow,
    })

    handleCancel(routingContext, <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] connection-request-cancelled',
        processId: processId2,
        senderId: 'remote-2',
      },
      source: window2,
    })

    expect(mockWindow.postMessage).toHaveBeenCalled()
    expect(window2.postMessage).toHaveBeenCalled()
  })
})
