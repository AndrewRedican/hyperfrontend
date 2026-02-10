import type { BrokerState } from '../types'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import { handleDestroy } from './handle-destroy'
import { createRegistry } from '../../core/registry/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createActionCreators } from '../../core/actions/factory'
import { addChannel } from '../channels/add'
import { ACTION_TYPES } from '../../types/action'

describe('handleDestroy', () => {
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

  it('destroy channel immediately', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)

    const destroySpy = jest.spyOn(channel, 'destroy')

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleDestroy(mockBrokerState, registry, processManager, actions, message)

    // Should call destroy with notify=false
    expect(destroySpy).toHaveBeenCalledWith(false)
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'non-existent-sender',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleDestroy(mockBrokerState, registry, processManager, actions, message)
    }).not.toThrow()
  })

  it('destroy channel without sending acknowledgement', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    const postMessageCallsBefore = (<jest.Mock>mockWindow.postMessage).mock.calls.length

    handleDestroy(mockBrokerState, registry, processManager, actions, message)

    // Should not send any messages (immediate destruction)
    expect((<jest.Mock>mockWindow.postMessage).mock.calls.length).toBe(postMessageCallsBefore)
  })

  it('destroy open channels', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)
    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })

    const destroySpy = jest.spyOn(channel, 'destroy')

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleDestroy(mockBrokerState, registry, processManager, actions, message)

    expect(destroySpy).toHaveBeenCalledWith(false)
  })

  it('destroy closed channels', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)
    Object.defineProperty(channel, 'isActive', { value: () => false, writable: true })

    const destroySpy = jest.spyOn(channel, 'destroy')

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleDestroy(mockBrokerState, registry, processManager, actions, message)

    expect(destroySpy).toHaveBeenCalledWith(false)
  })

  it('handles multiple destroy requests independently', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    Object.defineProperty(channel1, 'id', { value: 'remote-1', writable: true })

    // Re-add to registry with new ID
    registry.add(channel1)

    const window2 = <Window>(<unknown>{ postMessage: jest.fn() })
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    Object.defineProperty(channel2, 'id', { value: 'remote-2', writable: true })

    // Re-add to registry with new ID
    registry.add(channel2)

    const destroy1Spy = jest.spyOn(channel1, 'destroy')
    const destroy2Spy = jest.spyOn(channel2, 'destroy')

    handleDestroy(mockBrokerState, registry, processManager, actions, <MessageEvent<IAction>>{
      data: <IAction>{
        type: ACTION_TYPES.DESTROY_CONNECTION,
        senderId: 'remote-1',
      },
      source: mockWindow,
    })

    handleDestroy(mockBrokerState, registry, processManager, actions, <MessageEvent<IAction>>{
      data: <IAction>{
        type: ACTION_TYPES.DESTROY_CONNECTION,
        senderId: 'remote-2',
      },
      source: window2,
    })

    expect(destroy1Spy).toHaveBeenCalledWith(false)
    expect(destroy2Spy).toHaveBeenCalledWith(false)
  })

  it('passs notify=false to destroy method', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)

    const destroySpy = jest.spyOn(channel, 'destroy')

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleDestroy(mockBrokerState, registry, processManager, actions, message)

    // Verify notify parameter is false (immediate, no handshake)
    expect(destroySpy).toHaveBeenCalledWith(false)
    expect(destroySpy).not.toHaveBeenCalledWith(true)
  })
})
