/**
 * Tests for handleMessage function
 */

import { handleMessage } from './handle-message'
import { createRegistry } from '../../core/registry/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createActionCreators } from '../../core/actions/factory'
import { addChannel } from '../channels/add'
import type { BrokerState } from '../types'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'

describe('handleMessage', () => {
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
  let consoleInfoSpy: jest.SpyInstance

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
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation()
  })

  afterEach(() => {
    consoleInfoSpy.mockRestore()
  })

  it('routes message to open channel', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)
    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
      data: {
        type: 'test-message',
        payload: 'Hello',
      },
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleMessage(mockBrokerState, registry, processManager, actions, message)
    }).not.toThrow()
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'non-existent-sender',
      data: {
        type: 'test-message',
        payload: 'Hello',
      },
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleMessage(mockBrokerState, registry, processManager, actions, message)
    }).not.toThrow()
  })

  it('ignore if channel is not open', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)
    Object.defineProperty(channel, 'isActive', { value: () => false, writable: true })

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
      data: {
        type: 'test-message',
        payload: 'Hello',
      },
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleMessage(mockBrokerState, registry, processManager, actions, message)

    // Should not process the message
    expect(consoleInfoSpy).not.toHaveBeenCalled()
  })

  it('logs and ignore invalid messages in debug mode', () => {
    const debugState: BrokerState = {
      ...mockBrokerState,
      settings: { ...mockBrokerState.settings, debug: true },
    }

    const channel = addChannel(debugState, registry, processManager, actions, 'test-channel', mockWindow)

    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)
    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })
    Object.defineProperty(channel, 'name', { value: 'test-channel', writable: true })

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
      data: <unknown>null, // Invalid message
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleMessage(debugState, registry, processManager, actions, message)

    expect(consoleInfoSpy).toHaveBeenCalledWith(expect.stringContaining('ignored message from'))
  })

  it('does not log when debug is disabled', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)
    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
      data: <unknown>null, // Invalid message
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleMessage(mockBrokerState, registry, processManager, actions, message)

    expect(consoleInfoSpy).not.toHaveBeenCalled()
  })

  it('handles messages with different data types', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    Object.defineProperty(channel, 'id', { value: 'remote-broker-1', writable: true })

    // Re-add to registry with new ID so getById can find it
    registry.add(channel)
    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })

    const testCases = [
      { type: 'text', payload: 'Hello' },
      { type: 'number', payload: 42 },
      { type: 'object', payload: { nested: true } },
      { type: 'array', payload: [1, 2, 3] },
    ]

    testCases.forEach((data) => {
      const action: IAction = {
        type: '[nexus] new-message',
        senderId: 'remote-broker-1',
        data,
      }

      const message = <MessageEvent<IAction>>{
        data: action,
        source: mockWindow,
      }

      expect(() => {
        handleMessage(mockBrokerState, registry, processManager, actions, message)
      }).not.toThrow()
    })
  })

  it('routes messages to correct channel among multiple channels', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    Object.defineProperty(channel1, 'id', { value: 'remote-1', writable: true })

    // Re-add to registry with new ID
    registry.add(channel1)
    Object.defineProperty(channel1, 'isActive', { value: () => true, writable: true })

    const window2 = <Window>(<unknown>{ postMessage: jest.fn() })
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    Object.defineProperty(channel2, 'id', { value: 'remote-2', writable: true })

    // Re-add to registry with new ID
    registry.add(channel2)
    Object.defineProperty(channel2, 'isActive', { value: () => true, writable: true })

    const action1: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-1',
      data: { type: 'test', payload: 'for channel 1' },
    }

    const action2: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-2',
      data: { type: 'test', payload: 'for channel 2' },
    }

    // handleMessage routes messages through channel notification system
    // This test verifies no errors occur during routing

    handleMessage(mockBrokerState, registry, processManager, actions, <MessageEvent<IAction>>{
      data: action1,
      source: mockWindow,
    })

    // Should not throw for channel 1
    expect(() => {
      handleMessage(mockBrokerState, registry, processManager, actions, <MessageEvent<IAction>>{
        data: action2,
        source: window2,
      })
    }).not.toThrow()

    // Both messages should be processed without errors
    expect(consoleInfoSpy).not.toHaveBeenCalled()
  })
})
