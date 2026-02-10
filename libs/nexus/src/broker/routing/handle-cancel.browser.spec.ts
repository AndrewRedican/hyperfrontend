import type { BrokerState } from '../types'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import { handleCancel } from './handle-cancel'
import { createRegistry } from '../../core/registry/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createActionCreators } from '../../core/actions/factory'
import { addChannel } from '../channels/add'

describe('handleCancel', () => {
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

    handleCancel(mockBrokerState, registry, processManager, actions, message)

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

    handleCancel(mockBrokerState, registry, processManager, actions, message)

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

    handleCancel(mockBrokerState, registry, processManager, actions, message)

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
      handleCancel(mockBrokerState, registry, processManager, actions, message)
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

    handleCancel(mockBrokerState, registry, processManager, actions, message)

    // Should call cancel with notify=false
    expect(cancelSpy).toHaveBeenCalledWith(false)
  })

  it('handles multiple cancellations', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const processId1 = processManager.create(channel1)

    const window2 = <Window>(<unknown>{ postMessage: jest.fn() })
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    const processId2 = processManager.create(channel2)

    handleCancel(mockBrokerState, registry, processManager, actions, <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] connection-request-cancelled',
        processId: processId1,
        senderId: 'remote-1',
      },
      source: mockWindow,
    })

    handleCancel(mockBrokerState, registry, processManager, actions, <MessageEvent<IAction>>{
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
