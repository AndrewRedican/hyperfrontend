import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { ACTION_TYPES } from '../../types/action'
import { addChannel } from '../channels/add'
import { handleDestroy } from './handle-destroy'

describe('handleDestroy', () => {
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

  it('destroy channel immediately', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    const destroySpy = jest.spyOn(channel, 'destroy')

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleDestroy(routingContext, message)

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
      handleDestroy(routingContext, message)
    }).not.toThrow()
  })

  it('destroy channel without sending acknowledgement', () => {
    addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    const postMessageCallsBefore = (<jest.Mock>mockWindow.postMessage).mock.calls.length

    handleDestroy(routingContext, message)

    expect((<jest.Mock>mockWindow.postMessage).mock.calls.length).toBe(postMessageCallsBefore)
  })

  it('destroy open channels', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

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

    handleDestroy(routingContext, message)

    expect(destroySpy).toHaveBeenCalledWith(false)
  })

  it('destroy closed channels', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

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

    handleDestroy(routingContext, message)

    expect(destroySpy).toHaveBeenCalledWith(false)
  })

  it('handles multiple destroy requests independently', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)

    const window2 = <Window>(<unknown>{ postMessage: jest.fn() })
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)

    const destroy1Spy = jest.spyOn(channel1, 'destroy')
    const destroy2Spy = jest.spyOn(channel2, 'destroy')

    handleDestroy(routingContext, <MessageEvent<IAction>>{
      data: <IAction>{
        type: ACTION_TYPES.DESTROY_CONNECTION,
        senderId: 'remote-1',
      },
      source: mockWindow,
    })

    handleDestroy(routingContext, <MessageEvent<IAction>>{
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

    const destroySpy = jest.spyOn(channel, 'destroy')

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    }

    handleDestroy(routingContext, message)

    expect(destroySpy).toHaveBeenCalledWith(false)
    expect(destroySpy).not.toHaveBeenCalledWith(true)
  })

  it('ignores a destroy from an instance other than the connected counterpart', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    channel.activate('*', validContract, 'remote-broker-1')
    const destroySpy = jest.spyOn(channel, 'destroy')

    handleDestroy(routingContext, <MessageEvent<IAction>>{
      data: <IAction>{
        type: ACTION_TYPES.DESTROY_CONNECTION,
        senderId: 'remote-broker-2',
      },
      source: mockWindow,
    })

    expect({ destroyed: destroySpy.mock.calls, registered: registry.getAll().length }).toEqual({ destroyed: [], registered: 1 })
  })
})
