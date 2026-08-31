import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleInvalid } from './handle-invalid'

describe('handleInvalid', () => {
  const validContract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message' }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  const mockBrokerState: BrokerState = {
    id: 'broker-1',
    name: 'test-broker',
    window: global.window as Window,
    contract: validContract,
    settings: {
      contract: validContract,
    },
  }

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ReturnType<typeof createActionCreators>
  let mockWindow: Window
  let mockLogger: Logger
  let routingContext: RoutingContext

  beforeEach(() => {
    registry = createRegistry()
    processManager = createProcessManager()
    actions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => mockBrokerState.contract,
    })
    mockWindow = {
      postMessage: jest.fn(),
    } as unknown as Window
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'debug'),
    }
    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions,
      logger: mockLogger,
      getSupportedProtocols: () => ['none'],
      getProtocol: () => undefined,
      routeAction: () => undefined,
    }
  })

  it('process invalid request for existing channel', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] invalid-request',
      processId,
      senderId: 'remote-broker-1',
      error: 'Invalid action format',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    expect(() => {
      handleInvalid(routingContext, message)
    }).not.toThrow()
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] invalid-request',
      processId: 'non-existent-process',
      senderId: 'remote-broker-1',
      error: 'Invalid action format',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    expect(() => {
      handleInvalid(routingContext, message)
    }).not.toThrow()
  })

  it('handles invalid request with error details', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] invalid-request',
      processId,
      senderId: 'remote-broker-1',
      error: 'Detailed error message',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    expect(() => {
      handleInvalid(routingContext, message)
    }).not.toThrow()
  })

  it('handles invalid request without error details', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] invalid-request',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    expect(() => {
      handleInvalid(routingContext, message)
    }).not.toThrow()
  })

  it('handles multiple invalid requests for different channels', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const processId1 = processManager.create(channel1)

    const window2 = { postMessage: jest.fn() } as unknown as Window
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    const processId2 = processManager.create(channel2)

    const action1: IAction = {
      type: '[nexus] invalid-request',
      processId: processId1,
      senderId: 'remote-1',
      error: 'Error 1',
    }

    const action2: IAction = {
      type: '[nexus] invalid-request',
      processId: processId2,
      senderId: 'remote-2',
      error: 'Error 2',
    }

    handleInvalid(routingContext, {
      data: action1,
      source: mockWindow,
    } as MessageEvent<IAction>)

    handleInvalid(routingContext, {
      data: action2,
      source: window2,
    } as MessageEvent<IAction>)

    expect(true).toBe(true)
  })

  it('handles different error types', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const errorTypes = ['Invalid action format', 'Contract mismatch', 'Security violation', 'Timeout', 'Unknown error']

    errorTypes.forEach((errorMessage) => {
      const action: IAction = {
        type: '[nexus] invalid-request',
        processId,
        senderId: 'remote-broker-1',
        error: errorMessage,
      }

      const message = {
        data: action,
        source: mockWindow,
      } as MessageEvent<IAction>

      expect(() => {
        handleInvalid(routingContext, message)
      }).not.toThrow()
    })
  })

  it('does not send any response messages', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] invalid-request',
      processId,
      senderId: 'remote-broker-1',
      error: 'Test error',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    const postMessageCallsBefore = (mockWindow.postMessage as jest.Mock).mock.calls.length

    handleInvalid(routingContext, message)

    expect((mockWindow.postMessage as jest.Mock).mock.calls.length).toBe(postMessageCallsBefore)
  })

  it('returns early when action does not have processId', () => {
    const action = {
      type: '[nexus] invalid-request',
      senderId: 'remote-broker-1',
      error: 'Test error',
    }

    const message = {
      data: action as IAction,
      source: mockWindow,
    } as MessageEvent<IAction>

    expect(() => {
      handleInvalid(routingContext, message)
    }).not.toThrow()

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })
})
