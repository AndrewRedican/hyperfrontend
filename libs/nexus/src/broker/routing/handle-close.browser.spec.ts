import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
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
import { handleClose } from './handle-close'

describe('handleClose', () => {
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

  it('close open channel and send acknowledgement', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })

    const action: IAction = {
      type: '[nexus] connection-closed',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    handleClose(routingContext, message)

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

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    expect(() => {
      handleClose(routingContext, message)
    }).not.toThrow()
  })

  it('ignore if channel is not open', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    const action: IAction = {
      type: '[nexus] connection-closed',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    const postMessageCallsBefore = (mockWindow.postMessage as Mock).mock.calls.length

    handleClose(routingContext, message)

    expect((mockWindow.postMessage as Mock).mock.calls.length).toBe(postMessageCallsBefore)
  })

  it('calls channel close method without notification', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })

    const closeSpy = jest.spyOn(channel, 'disconnect')

    const action: IAction = {
      type: '[nexus] connection-closed',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    handleClose(routingContext, message)

    expect(closeSpy).toHaveBeenCalledWith(false)
  })

  it('handles close for multiple channels independently', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    Object.defineProperty(channel1, 'isActive', { value: () => true, writable: true })
    const processId1 = processManager.create(channel1)

    const window2 = { postMessage: jest.fn() } as unknown as Window
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    Object.defineProperty(channel2, 'isActive', { value: () => true, writable: true })
    const processId2 = processManager.create(channel2)

    handleClose(routingContext, {
      data: {
        type: '[nexus] connection-closed',
        processId: processId1,
        senderId: 'remote-1',
      } as IAction,
      source: mockWindow,
    } as MessageEvent<IAction>)

    handleClose(routingContext, {
      data: {
        type: '[nexus] connection-closed',
        processId: processId2,
        senderId: 'remote-2',
      } as IAction,
      source: window2,
    } as MessageEvent<IAction>)

    expect(mockWindow.postMessage).toHaveBeenCalled()
    expect(window2.postMessage).toHaveBeenCalled()
  })

  it('includes correct broker ID in acknowledgement', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = processManager.create(channel)

    Object.defineProperty(channel, 'isActive', { value: () => true, writable: true })

    const action: IAction = {
      type: '[nexus] connection-closed',
      processId,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    handleClose(routingContext, message)

    expect(mockWindow.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: mockBrokerState.id,
      }),
      expect.any(String)
    )
  })

  it('ignores a close from an instance other than the connected counterpart', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    channel.activate('*', validContract, 'remote-broker-1')
    const processId = processManager.create(channel)

    handleClose(routingContext, {
      data: {
        type: '[nexus] connection-closed',
        processId,
        senderId: 'remote-broker-2',
      } as IAction,
      source: mockWindow,
    } as MessageEvent<IAction>)

    expect({ active: channel.isActive(), acknowledged: (mockWindow.postMessage as Mock).mock.calls }).toEqual({
      active: true,
      acknowledged: [],
    })
  })

  it('returns early when action does not have processId', () => {
    const action = {
      type: '[nexus] connection-closed',
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action as IAction,
      source: mockWindow,
    } as MessageEvent<IAction>

    expect(() => {
      handleClose(routingContext, message)
    }).not.toThrow()

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })
})
