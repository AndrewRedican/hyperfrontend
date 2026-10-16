import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { IChannelContract } from '../../types/contract'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
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
    } as unknown as Logger

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
      security: { localId: 'broker-1', getProvider: () => undefined, dispatch: () => undefined },
    }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const startPoliteClose = (channel: ChannelHandle, target: Window): string => {
    channel.activate('https://example.com', validContract)
    channel.disconnect()
    const posted = (target.postMessage as Mock).mock.calls.map(([action]) => action as IAction)
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
    const before = { active: channel.isActive(), closing: channel.isClosing() }

    handleCloseAcknowledged(routingContext, acknowledgement(processId, mockWindow))

    const after = { active: channel.isActive(), closing: channel.isClosing(), process: processManager.get(processId) }
    expect({ before, after }).toEqual({
      before: { active: true, closing: true },
      after: { active: false, closing: false, process: undefined },
    })
  })

  it('fires a single close event on the initiator once acknowledged', () => {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, 'test-channel', mockWindow)
    const events: Array<[string, unknown]> = []
    channel.on((event, data) => {
      events.push([event, data])
    })
    const processId = startPoliteClose(channel, mockWindow)

    handleCloseAcknowledged(routingContext, acknowledgement(processId, mockWindow))

    expect(events.filter(([event]) => event === 'closing' || event === 'close')).toEqual([
      ['closing', { initiatedLocally: true }],
      ['close', { notify: true }],
    ])
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

    expect({ active: channel.isActive(), process: processManager.get(processId) }).toEqual({ active: true, process: channel })
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

    expect({
      first: { process: processManager.get(processId1), active: channel1.isActive() },
      second: { process: processManager.get(processId2), active: channel2.isActive() },
    }).toEqual({
      first: { process: undefined, active: false },
      second: { process: undefined, active: false },
    })
  })
})
