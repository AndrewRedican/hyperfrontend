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

  function addConnectedChannel(name: string, target: Window) {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, name, target)
    channel.connect()
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

    handleMessage(routingContext, <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    })

    expect(notifySpy).toHaveBeenCalledWith({ type: 'test-message', data: 'Hello' })
  })

  it('falls back to sender id lookup when the event has no source window', () => {
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

    handleMessage(routingContext, <MessageEvent<IAction>>{
      data: action,
      source: null,
    })

    expect(notifySpy).toHaveBeenCalledWith({ type: 'test-message', data: 'Hello' })
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
      handleMessage(routingContext, <MessageEvent<IAction>>{
        data: action,
        source: mockWindow,
      })
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

    handleMessage(routingContext, <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    })

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
      data: <unknown>null,
    }

    handleMessage(debugContext, <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    })

    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('ignored message from'))
  })

  it('does not output to console when log level is error', () => {
    const infoSpy = jest.spyOn(console, 'info').mockImplementation()

    const { createLogger } = <typeof import('./../../utils/logging/create-logger')>require('./../../utils/logging/create-logger')
    const realLogger = createLogger({ level: 'error' })

    const errorLevelContext: RoutingContext = {
      ...routingContext,
      logger: realLogger,
    }

    addConnectedChannel('test-channel', mockWindow)

    const action: IAction = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
      data: <unknown>null,
    }

    handleMessage(errorLevelContext, <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    })

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

    handleMessage(routingContext, <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    })

    expect(notifySpy).not.toHaveBeenCalled()
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

    handleMessage(routingContext, <MessageEvent<IAction>>{
      data: action,
      source: mockWindow,
    })

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

      handleMessage(routingContext, <MessageEvent<IAction>>{
        data: action,
        source: mockWindow,
      })
    })

    expect(notifySpy).toHaveBeenCalledTimes(4)
  })

  it('routes messages to correct channel among multiple channels', () => {
    const channel1 = addConnectedChannel('channel-1', mockWindow)
    const notify1Spy = jest.spyOn(channel1, 'notifyMessage')

    const window2 = <Window>(<unknown>{ postMessage: jest.fn() })
    const channel2 = addConnectedChannel('channel-2', window2)
    const notify2Spy = jest.spyOn(channel2, 'notifyMessage')

    handleMessage(routingContext, <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] new-message',
        senderId: 'remote-2',
        data: { type: 'test-message', data: 'for channel 2' },
      },
      source: window2,
    })

    expect(notify2Spy).toHaveBeenCalledWith({ type: 'test-message', data: 'for channel 2' })
    expect(notify1Spy).not.toHaveBeenCalled()
  })

  it('returns early when action does not have data property', () => {
    const action = {
      type: '[nexus] new-message',
      senderId: 'remote-broker-1',
    }

    expect(() => {
      handleMessage(routingContext, <MessageEvent<IAction>>{
        data: <IAction>action,
        source: mockWindow,
      })
    }).not.toThrow()
  })
})
