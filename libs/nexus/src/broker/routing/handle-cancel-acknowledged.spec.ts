import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { afterEach, beforeEach } from 'node:test'
import { createMock, describe, expect, it, jest } from '@hyperfrontend/testing'
import { createFakeWindow } from '@hyperfrontend/testing/browser'
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

  afterEach(() => {
    jest.restoreAllMocks()
  })

  beforeEach(() => {
    mockLogger = createMock<Logger>({ getLogLevel: () => 'debug' })

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
    mockWindow = createFakeWindow()

    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions,
      logger: mockLogger,
      getSupportedProtocols: () => ['none'],
      security: { localId: 'broker-1', getProvider: () => undefined, dispatch: () => undefined },
    }
  })

  it('removes the pending process for an existing channel', () => {
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

    handleCancelAcknowledged(routingContext, message)

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

  it('fires no event, the cancel that sent the frame already did', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const notifyEventMock = jest.fn()
    jest.replaceProperty(channel, 'notifyEvent', notifyEventMock)

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

    expect(notifyEventMock).not.toHaveBeenCalled()
  })

  it('handles multiple cancel acknowledgements for different channels', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const processId1 = processManager.create(channel1)

    const window2: Window = createFakeWindow()
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

    expect([processId1, processId2].filter((processId) => processManager.has(processId))).toEqual([])
  })
})
