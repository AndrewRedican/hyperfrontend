import type { BrokerState } from '../types'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import { handleClose } from './handle-close'
import { createRegistry } from '../../core/registry/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createActionCreators } from '../../core/actions/factory'
import { addChannel } from '../channels/add'

describe('handleClose', () => {
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

  it('close open channel and send acknowledgement', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    // Mock channel as open
    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })
    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)

    const action: IAction = {
      type: '[nexus] connection-closed',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleClose(mockBrokerState, registry, processManager, actions, message)

    // Should send acknowledgement
    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-closed-acknowledged',
        processId,
      }),
      expect.any(String)
    )
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] connection-closed',
      processId: 'process-1',
      senderId: 'non-existent-sender',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleClose(mockBrokerState, registry, processManager, actions, message)
    }).not.toThrow()
  })

  it('ignore if channel is not open', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    // Channel is not open (isOpen = false by default)
    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)

    const action: IAction = {
      type: '[nexus] connection-closed',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    const postMessageCallsBefore = (<jest.Mock>mockWindow.postMessage).mock.calls.length

    handleClose(mockBrokerState, registry, processManager, actions, message)

    // Should not send any messages
    expect((<jest.Mock>mockWindow.postMessage).mock.calls.length).toBe(postMessageCallsBefore)
  })

  it('calls channel close method without notification', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })
    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)

    const closeSpy = jest.spyOn(channel, 'disconnect')

    const action: IAction = {
      type: '[nexus] connection-closed',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleClose(mockBrokerState, registry, processManager, actions, message)

    // Should call close with notify=false
    expect(closeSpy).toHaveBeenCalledWith(false)
  })

  it('handles close for multiple channels independently', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    Object.defineProperty(channel1, 'isActive', { value: () => true, writable: true })
    Object.defineProperty(channel1, 'id', { value: 'remote-1', writable: true })

    // Re-add to registry with new ID
    registry.add(channel1)
    const processId1 = processManager.create(channel1)

    const window2 = <Window>(<unknown>{ postMessage: jest.fn() })
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    Object.defineProperty(channel2, 'isActive', { value: () => true, writable: true })
    Object.defineProperty(channel2, 'id', { value: 'remote-2', writable: true })

    // Re-add to registry with new ID
    registry.add(channel2)
    const processId2 = processManager.create(channel2)

    handleClose(mockBrokerState, registry, processManager, actions, <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] connection-closed',
        processId: processId1,
        senderId: 'remote-1',
      },
      source: mockWindow,
    })

    handleClose(mockBrokerState, registry, processManager, actions, <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] connection-closed',
        processId: processId2,
        senderId: 'remote-2',
      },
      source: window2,
    })

    expect(mockWindow.postMessage).toHaveBeenCalled()
    expect(window2.postMessage).toHaveBeenCalled()
  })

  it('includes correct broker ID in acknowledgement', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })
    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)

    const action: IAction = {
      type: '[nexus] connection-closed',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleClose(mockBrokerState, registry, processManager, actions, message)

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: mockBrokerState.id,
      }),
      expect.any(String)
    )
  })

  it('returns early when action does not have processId', () => {
    const action = {
      type: '[nexus] connection-closed',
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: <IAction>action,
      source: mockWindow,
    }

    expect(() => {
      handleClose(mockBrokerState, registry, processManager, actions, message)
    }).not.toThrow()

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })
})
