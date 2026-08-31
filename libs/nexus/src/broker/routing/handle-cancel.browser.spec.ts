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
      window: global.window as Window,
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
    mockWindow = {
      postMessage: jest.fn(),
    } as unknown as Window

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

  it('cancel connection and send acknowledgement', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-cancelled',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    handleCancel(routingContext, message)

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: '[nexus] connection-request-cancelled-acknowledged',
        processId,
      }),
      expect.any(String)
    )
  })

  it('find channel by sender ID when the event has no source window', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-cancelled',
      processId,
      senderId: channel.id,
    }

    const message = {
      data: action,
      source: null,
    } as MessageEvent<IAction>

    handleCancel(routingContext, message)

    expect(mockWindow.postMessage).toHaveBeenCalled()
  })

  it('find channel by process ID if channel lookup fails', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-cancelled',
      processId,
      senderId: 'different-id',
    }

    const message = {
      data: action,
      source: null,
    } as MessageEvent<IAction>

    handleCancel(routingContext, message)

    expect(mockWindow.postMessage).toHaveBeenCalled()
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] connection-request-cancelled',
      processId: 'non-existent-process',
      senderId: 'non-existent-sender',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

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

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    handleCancel(routingContext, message)

    expect(cancelSpy).toHaveBeenCalledWith(false)
  })

  it('handles multiple cancellations', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const processId1 = processManager.create(channel1)

    const window2 = { postMessage: jest.fn() } as unknown as Window
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    const processId2 = processManager.create(channel2)

    handleCancel(routingContext, {
      data: {
        type: '[nexus] connection-request-cancelled',
        processId: processId1,
        senderId: 'remote-1',
      } as IAction,
      source: mockWindow,
    } as MessageEvent<IAction>)

    handleCancel(routingContext, {
      data: {
        type: '[nexus] connection-request-cancelled',
        processId: processId2,
        senderId: 'remote-2',
      } as IAction,
      source: window2,
    } as MessageEvent<IAction>)

    expect(mockWindow.postMessage).toHaveBeenCalled()
    expect(window2.postMessage).toHaveBeenCalled()
  })

  it('ignores a cancel from an instance other than the counterpart the channel answered', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    channel.activate('*', validContract, 'remote-broker-1')
    const processId = processManager.create(channel)
    const cancelSpy = jest.spyOn(channel, 'cancel')

    handleCancel(routingContext, {
      data: {
        type: '[nexus] connection-request-cancelled',
        processId,
        senderId: 'remote-broker-2',
      } as IAction,
      source: mockWindow,
    } as MessageEvent<IAction>)

    expect({ cancelled: cancelSpy.mock.calls, acknowledged: (mockWindow.postMessage as jest.Mock).mock.calls }).toEqual({
      cancelled: [],
      acknowledged: [],
    })
  })
})
