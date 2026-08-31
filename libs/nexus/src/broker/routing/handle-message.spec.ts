import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleMessage } from './handle-message'

describe('handleMessage', () => {
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

  function addConnectedChannel(name: string, target: Window) {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, name, target)
    channel.activate('*', validContract, 'remote-broker-1')
    return channel
  }

  it('routes message to the channel registered for the source window', () => {
    const channel = addConnectedChannel('test-channel', mockWindow)
    const notifySpy = jest.spyOn(channel, 'notifyMessage')

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
      data: {
        type: 'test-message',
        data: 'Hello',
      },
    }

    handleMessage(routingContext, {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>)

    expect(notifySpy).toHaveBeenCalledWith({ type: 'test-message', data: 'Hello' })
  })

  it('ignores messages without a source window even when the sender id matches', () => {
    const channel = addConnectedChannel('test-channel', mockWindow)
    const notifySpy = jest.spyOn(channel, 'notifyMessage')

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: channel.id,
      data: {
        type: 'test-message',
        data: 'Hello',
      },
    }

    handleMessage(routingContext, {
      data: action,
      source: null,
    } as MessageEvent<IAction>)

    expect(notifySpy).not.toHaveBeenCalled()
  })

  it('ignore if channel not found', () => {
    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'non-existent-sender',
      data: {
        type: 'test-message',
        data: 'Hello',
      },
    }

    expect(() => {
      handleMessage(routingContext, {
        data: action,
        source: mockWindow,
      } as MessageEvent<IAction>)
    }).not.toThrow()
  })

  it('ignore if channel is not open', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const notifySpy = jest.spyOn(channel, 'notifyMessage')

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
      data: {
        type: 'test-message',
        data: 'Hello',
      },
    }

    handleMessage(routingContext, {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>)

    expect(notifySpy).not.toHaveBeenCalled()
  })

  it('logs and ignore invalid messages in debug mode', () => {
    const debugState: BrokerState = {
      ...mockBrokerState,
      settings: { ...mockBrokerState.settings, logLevel: 'debug' },
    }

    const debugContext: RoutingContext = {
      ...routingContext,
      state: debugState,
    }

    addConnectedChannel('test-channel', mockWindow)

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
      data: null as unknown,
    }

    handleMessage(debugContext, {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>)

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ignored message from'))
  })

  it('does not output to console when log level is error', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation()

    const { createLogger } = require('./../../utils/logging/create-logger') as typeof import('./../../utils/logging/create-logger')
    const realLogger = createLogger({ level: 'error' })

    const errorLevelContext: RoutingContext = {
      ...routingContext,
      logger: realLogger,
    }

    addConnectedChannel('test-channel', mockWindow)

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
      data: null as unknown,
    }

    handleMessage(errorLevelContext, {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>)

    expect(infoSpy).not.toHaveBeenCalled()
    infoSpy.mockRestore()
  })

  it('drops and logs messages whose type is not accepted by the channel contract', () => {
    const channel = addConnectedChannel('test-channel', mockWindow)
    const notifySpy = jest.spyOn(channel, 'notifyMessage')

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
      data: {
        type: 'unexpected-type',
        data: 'Hello',
      },
    }

    handleMessage(routingContext, {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>)

    expect(notifySpy).not.toHaveBeenCalled()
  })

  it('drops and logs a message from an instance other than the connected counterpart', () => {
    const channel = addConnectedChannel('test-channel', mockWindow)
    const notifySpy = jest.spyOn(channel, 'notifyMessage')

    handleMessage(routingContext, {
      data: {
        type: '[nexus] new-message',
        senderId: 'remote-broker-2',
        data: { type: 'test-message', data: 'from the previous incarnation' },
      } as IAction,
      source: mockWindow,
    } as MessageEvent<IAction>)

    expect({ notified: notifySpy.mock.calls, logged: (mockLogger.info as jest.Mock).mock.calls.length }).toEqual({
      notified: [],
      logged: 1,
    })
  })

  it('logs the dropped message type when it is not accepted by the channel contract', () => {
    addConnectedChannel('test-channel', mockWindow)

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
      data: {
        type: 'unexpected-type',
        data: 'Hello',
      },
    }

    handleMessage(routingContext, {
      data: action,
      source: mockWindow,
    } as MessageEvent<IAction>)

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("dropped message type 'unexpected-type'"))
  })

  it('handles accepted messages with different payload shapes', () => {
    const channel = addConnectedChannel('test-channel', mockWindow)
    const notifySpy = jest.spyOn(channel, 'notifyMessage')

    const payloads = ['Hello', 42, { nested: true }, [1, 2, 3]]

    payloads.forEach((payload) => {
      const action: IAction = {
        type: '[nexus] new-message',
        senderId: 'remote-broker-1',
        data: { type: 'test-message', data: payload },
      }

      handleMessage(routingContext, {
        data: action,
        source: mockWindow,
      } as MessageEvent<IAction>)
    })

    expect(notifySpy).toHaveBeenCalledTimes(4)
  })

  it('routes messages to correct channel among multiple channels', () => {
    const channel1 = addConnectedChannel('channel-1', mockWindow)
    const notify1Spy = jest.spyOn(channel1, 'notifyMessage')

    const window2 = { postMessage: jest.fn() } as unknown as Window
    const channel2 = addConnectedChannel('channel-2', window2)
    const notify2Spy = jest.spyOn(channel2, 'notifyMessage')

    handleMessage(routingContext, {
      data: {
        type: '[nexus] new-message',
        senderId: 'remote-broker-1',
        data: { type: 'test-message', data: 'for channel 2' },
      } as IAction,
      source: window2,
    } as MessageEvent<IAction>)

    expect(notify2Spy).toHaveBeenCalledWith({ type: 'test-message', data: 'for channel 2' })
    expect(notify1Spy).not.toHaveBeenCalled()
  })

  it('returns early when action does not have data property', () => {
    const action = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
    }

    expect(() => {
      handleMessage(routingContext, {
        data: action as IAction,
        source: mockWindow,
      } as MessageEvent<IAction>)
    }).not.toThrow()
  })
})
