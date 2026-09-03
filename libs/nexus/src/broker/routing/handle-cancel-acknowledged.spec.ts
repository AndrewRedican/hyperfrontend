import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleCancelAcknowledged } from './handle-cancel-acknowledged'

describe('handleCancelAcknowledged', () => {
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

  it('process cancel acknowledgement for existing channel', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-request-cancelled-acknowledged',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    expect(() => {
      handleCancelAcknowledged(routingContext, message)
    }).not.toThrow()

    expect(processManager.get(processId)).toBeUndefined()
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] connection-request-cancelled-acknowledged',
      processId: 'non-existent-process',
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    expect(() => {
      handleCancelAcknowledged(routingContext, message)
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
      type: '[nexus] connection-request-cancelled-acknowledged',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    handleCancelAcknowledged(routingContext, message)

    expect(notifyEventMock).toHaveBeenCalledWith('cancel', { notify: false })
  })

  it('handles multiple cancel acknowledgements for different channels', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const processId1 = processManager.create(channel1)

    const window2 = {
      postMessage: jest.fn(),
      _uniqueId: 'window-2',
    } as unknown as Window
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

    handleCancelAcknowledged(routingContext, {
      data: action1,
      source: mockWindow,
    } as MessageEvent<IAction>)

    handleCancelAcknowledged(routingContext, {
      data: action2,
      source: window2,
    } as MessageEvent<IAction>)

    expect(processManager.get(processId1)).toBeUndefined()
    expect(processManager.get(processId2)).toBeUndefined()
  })
})
