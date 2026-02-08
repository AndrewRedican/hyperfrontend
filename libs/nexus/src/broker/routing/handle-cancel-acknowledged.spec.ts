/**
 * Tests for handleCancelAcknowledged function
 */

import { handleCancelAcknowledged } from './handle-cancel-acknowledged'
import { createRegistry } from '../../core/registry/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createActionCreators } from '../../core/actions/factory'
import { addChannel } from '../channels/add'
import type { BrokerState } from '../types'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'

describe('handleCancelAcknowledged', () => {
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

  it('process cancel acknowledgement for existing channel', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-cancelled-acknowledged',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleCancelAcknowledged(mockBrokerState, registry, processManager, actions, message)
    }).not.toThrow()

    // Process should be terminated (removed)
    expect(processManager.get(processId)).toBeUndefined()
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] connection-request-cancelled-acknowledged',
      processId: 'non-existent-process',
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleCancelAcknowledged(mockBrokerState, registry, processManager, actions, message)
    }).not.toThrow()
  })

  it('calls notifyEvent when channel has the method', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    // Add notifyEvent mock to channel
    const notifyEventMock = jest.fn()
    Object.defineProperty(channel, 'notifyEvent', {
      value: notifyEventMock,
      writable: true,
    })

    const action: IAction = {
      type: '[nexus] connection-request-cancelled-acknowledged',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleCancelAcknowledged(mockBrokerState, registry, processManager, actions, message)

    expect(notifyEventMock).toHaveBeenCalledWith('cancel', { notify: false })
  })

  it('handles multiple cancel acknowledgements for different channels', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const processId1 = processManager.create(channel1)

    const window2 = <Window>(<unknown>{
      postMessage: jest.fn(),
      _uniqueId: 'window-2',
    })
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    const processId2 = processManager.create(channel2)

    const action1: IAction = {
      type: '[nexus] connection-request-cancelled-acknowledged',
      processId: processId1,
      senderId: 'remote-1',
    }

    const action2: IAction = {
      type: '[nexus] connection-request-cancelled-acknowledged',
      processId: processId2,
      senderId: 'remote-2',
    }

    handleCancelAcknowledged(mockBrokerState, registry, processManager, actions, <MessageEvent<IAction>>{
      data: action1,
      source: mockWindow,
    })

    handleCancelAcknowledged(mockBrokerState, registry, processManager, actions, <MessageEvent<IAction>>{
      data: action2,
      source: window2,
    })

    // Both should be processed (terminated)
    expect(processManager.get(processId1)).toBeUndefined()
    expect(processManager.get(processId2)).toBeUndefined()
  })
})
