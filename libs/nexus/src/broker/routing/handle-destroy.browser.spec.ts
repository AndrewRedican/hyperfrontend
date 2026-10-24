import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
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

  it('destroy channel immediately', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    const destroySpy = jest.spyOn(channel, 'destroy')

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    handleDestroy(routingContext, message)

    expect(destroySpy).toHaveBeenCalledWith(false)
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'non-existent-sender',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

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

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    const postMessageCallsBefore = (mockWindow.postMessage as Mock).mock.calls.length

    handleDestroy(routingContext, message)

    expect((mockWindow.postMessage as Mock).mock.calls.length).toBe(postMessageCallsBefore)
  })

  it('destroy open channels', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    jest.replaceProperty(channel, 'isActive', () => true)

    const destroySpy = jest.spyOn(channel, 'destroy')

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    handleDestroy(routingContext, message)

    expect(destroySpy).toHaveBeenCalledWith(false)
  })

  it('destroy closed channels', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    jest.replaceProperty(channel, 'isActive', () => false)

    const destroySpy = jest.spyOn(channel, 'destroy')

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    handleDestroy(routingContext, message)

    expect(destroySpy).toHaveBeenCalledWith(false)
  })

  it('handles multiple destroy requests independently', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)

    const window2: Window = createFakeWindow()
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)

    const destroy1Spy = jest.spyOn(channel1, 'destroy')
    const destroy2Spy = jest.spyOn(channel2, 'destroy')

    handleDestroy(routingContext, {
      data: {
        type: ACTION_TYPES.DESTROY_CONNECTION,
        senderId: 'remote-1',
      } as IAction,
      source: mockWindow,
    } as MessageEvent<IAction>)

    handleDestroy(routingContext, {
      data: {
        type: ACTION_TYPES.DESTROY_CONNECTION,
        senderId: 'remote-2',
      } as IAction,
      source: window2,
    } as MessageEvent<IAction>)

    expect({ first: destroy1Spy.mock.calls, second: destroy2Spy.mock.calls }).toEqual({ first: [[false]], second: [[false]] })
  })

  it('passes notify=false to the destroy method', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)

    const destroySpy = jest.spyOn(channel, 'destroy')

    const action: IAction = {
      type: ACTION_TYPES.DESTROY_CONNECTION,
      senderId: 'remote-broker-1',
    }

    const message = {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>

    handleDestroy(routingContext, message)

    expect(destroySpy.mock.calls).toEqual([[false]])
  })

  it('ignores a destroy from an instance other than the connected counterpart', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    channel.activate('*', validContract, 'remote-broker-1')
    const destroySpy = jest.spyOn(channel, 'destroy')

    handleDestroy(routingContext, {
      data: {
        type: ACTION_TYPES.DESTROY_CONNECTION,
        senderId: 'remote-broker-2',
      } as IAction,
      source: mockWindow,
    } as MessageEvent<IAction>)

    expect({ destroyed: destroySpy.mock.calls, registered: registry.getAll().length }).toEqual({ destroyed: [], registered: 1 })
  })
})
