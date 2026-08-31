import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
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
    jest.useFakeTimers()
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

  afterEach(() => {
    jest.useRealTimers()
  })

  const startPoliteClose = (channel: ChannelHandle, target: Window): string => {
    channel.activate('https://example.com', validContract)
    channel.disconnect()
    const posted = (target.postMessage as jest.Mock).mock.calls.map(([action]) => action as IAction)
    const closeAction = posted.find((action) => action.type === '[nexus] connection-closed')
    return (closeAction as unknown as Record<string, unknown>)['processId'] as string
  }

  const acknowledgement = (processId: string, source: Window, senderId = 'remote-broker-1'): MessageEvent<IAction> =>
    ({
      data: { type: '[nexus] connection-closed-acknowledged', processId, senderId },
      source,
    }) as MessageEvent<IAction>

  it('completes the close for a channel awaiting acknowledgement', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const processId = startPoliteClose(channel, mockWindow)

    expect(channel.isActive()).toBe(true)
    expect(channel.isClosing()).toBe(true)

    expect(() => {
      handleCloseAcknowledged(routingContext, acknowledgement(processId, mockWindow))
    }).not.toThrow()

    expect(channel.isActive()).toBe(false)
    expect(channel.isClosing()).toBe(false)
    expect(processManager.get(processId)).toBeUndefined()
  })

  it('fires a single close event on the initiator once acknowledged', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const events: Array<[string, unknown]> = []
    channel.on((event, data) => {
      events.push([event, data])
    })
    const processId = startPoliteClose(channel, mockWindow)

    handleCloseAcknowledged(routingContext, acknowledgement(processId, mockWindow))

    expect(events.filter(([event]) => event === 'closing')).toEqual([['closing', { initiatedLocally: true }]])
    expect(events.filter(([event]) => event === 'close')).toEqual([['close', { notify: true }]])
  })

  it('ignore if channel not found', () => {
    expect(() => {
      handleCloseAcknowledged(routingContext, acknowledgement('non-existent-process', mockWindow))
    }).not.toThrow()
  })

  it('ignores an acknowledgement whose channel never proposed a close', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    channel.activate('https://example.com', validContract)
    const processId = processManager.create(channel)

    handleCloseAcknowledged(routingContext, acknowledgement(processId, mockWindow))

    expect(channel.isActive()).toBe(true)
    expect(processManager.get(processId)).toBe(channel)
  })

  it('handles multiple close acknowledgements for different channels', () => {
    const channel1 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-1', mockWindow)
    const processId1 = startPoliteClose(channel1, mockWindow)

    const window2 = {
      postMessage: jest.fn(),
      _uniqueId: 'window-2',
    } as unknown as Window
    const channel2 = addChannel(mockBrokerState, registry, processManager, actions, 'channel-2', window2)
    const processId2 = startPoliteClose(channel2, window2)

    handleCloseAcknowledged(routingContext, acknowledgement(processId1, mockWindow, 'remote-1'))
    handleCloseAcknowledged(routingContext, acknowledgement(processId2, window2, 'remote-2'))

    expect(processManager.get(processId1)).toBeUndefined()
    expect(processManager.get(processId2)).toBeUndefined()
    expect(channel1.isActive()).toBe(false)
    expect(channel2.isActive()).toBe(false)
  })
})
