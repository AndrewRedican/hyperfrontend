import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleCloseAcknowledged } from './handle-close-acknowledged'

describe('handleCloseAcknowledged', () => {
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
      getSupportedProtocols: () => ['none'],
      getProtocol: () => undefined,
      routeAction: () => undefined,
    }
  })

  it('process close acknowledgement for existing channel', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-closed-acknowledged',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleCloseAcknowledged(routingContext, message)
    }).not.toThrow()

    expect(processManager.get(processId)).toBeUndefined()
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] connection-closed-acknowledged',
      processId: 'non-existent-process',
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    expect(() => {
      handleCloseAcknowledged(routingContext, message)
    }).not.toThrow()
  })

  it('calls notifyEvent when channel has the method', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const notifyEventMock = jest.fn()
    Object.defineProperty(channel, 'notifyEvent', {
      value: notifyEventMock,
      writable: true,
    })

    const action: IAction = {
      type: '[nexus] connection-closed-acknowledged',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleCloseAcknowledged(routingContext, message)

    expect(notifyEventMock).toHaveBeenCalledWith('close', { notify: false })
  })

  it('handles multiple close acknowledgements for different channels', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const processId1 = processManager.create(channel1)

    const window2 = <Window>(<unknown>{
      postMessage: jest.fn(),
      _uniqueId: 'window-2',
    })
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    const processId2 = processManager.create(channel2)

    const action1: IAction = {
      type: '[nexus] connection-closed-acknowledged',
      processId: processId1,
      senderId: 'remote-1',
    }

    const action2: IAction = {
      type: '[nexus] connection-closed-acknowledged',
      processId: processId2,
      senderId: 'remote-2',
    }

    handleCloseAcknowledged(routingContext, <MessageEvent<IAction>>{
      data: action1,
      source: mockWindow,
    })

    handleCloseAcknowledged(routingContext, <MessageEvent<IAction>>{
      data: action2,
      source: window2,
    })

    expect(processManager.get(processId1)).toBeUndefined()
    expect(processManager.get(processId2)).toBeUndefined()
  })
})
