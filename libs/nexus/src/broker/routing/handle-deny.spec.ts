/**
 * Tests for handleDeny function
 */

import type { RoutingContext } from './types'
import type { Logger } from '@hyperfrontend/logging'
import { handleDeny } from './handle-deny'
import { createRegistry } from '../../core/registry/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createActionCreators } from '../../core/actions/factory'
import { addChannel } from '../channels/add'
import type { BrokerState } from '../types'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'

describe('handleDeny', () => {
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

  it('process denial for existing channel', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-denied',
      processId,
      senderId: 'remote-broker-1',
      error: 'Connection denied',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleDeny(routingContext, message)
    }).not.toThrow()
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] connection-request-denied',
      processId: 'non-existent-process',
      senderId: 'remote-broker-1',
      error: 'Connection denied',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleDeny(routingContext, message)
    }).not.toThrow()
  })

  it('handles denial with error message', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-denied',
      processId,
      senderId: 'remote-broker-1',
      error: 'Security policy violation',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleDeny(routingContext, message)
    }).not.toThrow()
  })

  it('handles denial without error message', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-denied',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleDeny(routingContext, message)
    }).not.toThrow()
  })

  it('handles multiple denials for different channels', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const processId1 = processManager.create(channel1)

    // Create a truly unique window object for channel2
    const window2 = <Window>(<unknown>{
      postMessage: jest.fn(),
      _uniqueId: 'window-2', // Ensure uniqueness
    })
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    expect(channel2).toBeDefined() // Channel should be created
    const processId2 = processManager.create(channel2)

    const action1: IAction = {
      type: '[nexus] connection-request-denied',
      processId: processId1,
      senderId: 'remote-1',
      error: 'Denied 1',
    }

    const action2: IAction = {
      type: '[nexus] connection-request-denied',
      processId: processId2,
      senderId: 'remote-2',
      error: 'Denied 2',
    }

    handleDeny(routingContext, <MessageEvent<IAction>>{
      data: action1,
      source: mockWindow,
    })

    handleDeny(routingContext, <MessageEvent<IAction>>{
      data: action2,
      source: window2,
    })

    // Both should be processed without errors
    expect(processManager.get(processId1)).toBeUndefined() // Terminated
    expect(processManager.get(processId2)).toBeUndefined() // Terminated
  })
})
