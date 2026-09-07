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
import { handleInvalid } from './handle-invalid'

describe('handleInvalid', () => {
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

  function invalidEvent(action: Record<string, unknown>, source: Window = mockWindow): MessageEvent<IAction> {
    return {
      data: { type: '[nexus] invalid-request', senderId: 'remote-broker-1', ...action } as IAction,
      origin: 'http://remote.example',
      source,
    } as MessageEvent<IAction>
  }

  function addTrackedChannel(name: string, target: Window) {
    const channel = addChannel(mockBrokerState, registry, processManager, actions, name, target)
    const processId = processManager.create(channel)
    const invalidHandler = jest.fn()
    channel.on('invalid', invalidHandler)
    return { channel, processId, invalidHandler }
  }

  it('fires the invalid event with the reason and the origin', () => {
    const { processId, invalidHandler } = addTrackedChannel('test-channel', mockWindow)

    handleInvalid(routingContext, invalidEvent({ processId, error: 'Invalid action format' }))

    expect(invalidHandler).toHaveBeenCalledWith({ reason: 'Invalid action format', origin: 'http://remote.example' }, expect.anything())
  })

  it('fires the invalid event without a reason when the action carries no error', () => {
    const { processId, invalidHandler } = addTrackedChannel('test-channel', mockWindow)

    handleInvalid(routingContext, invalidEvent({ processId }))

    expect(invalidHandler.mock.calls[0]?.[0]).toEqual({ reason: undefined, origin: 'http://remote.example' })
  })

  it('keeps the process tracked', () => {
    const { channel, processId } = addTrackedChannel('test-channel', mockWindow)

    handleInvalid(routingContext, invalidEvent({ processId, error: 'Invalid action format' }))

    expect(processManager.get(processId)).toBe(channel)
  })

  it('ignores an action whose process is unknown', () => {
    const { invalidHandler } = addTrackedChannel('test-channel', mockWindow)

    handleInvalid(routingContext, invalidEvent({ processId: 'non-existent-process', error: 'Invalid action format' }))

    expect(invalidHandler).not.toHaveBeenCalled()
  })

  it('ignores an action without a process id', () => {
    const { invalidHandler } = addTrackedChannel('test-channel', mockWindow)

    handleInvalid(routingContext, invalidEvent({ error: 'Test error' }))

    expect(invalidHandler).not.toHaveBeenCalled()
  })

  it('sends nothing back to the counterpart', () => {
    const { processId } = addTrackedChannel('test-channel', mockWindow)

    handleInvalid(routingContext, invalidEvent({ processId, error: 'Test error' }))

    expect(mockWindow.postMessage).not.toHaveBeenCalled()
  })

  it('resolves the channel by process id rather than by source window', () => {
    const { processId, invalidHandler } = addTrackedChannel('test-channel', mockWindow)
    const otherWindow = { postMessage: jest.fn() } as unknown as Window

    handleInvalid(routingContext, invalidEvent({ processId, error: 'Stale frame' }, otherWindow))

    expect(invalidHandler).toHaveBeenCalledWith({ reason: 'Stale frame', origin: 'http://remote.example' }, expect.anything())
  })

  it('routes each report to the channel that owns the process', () => {
    const first = addTrackedChannel('channel-1', mockWindow)
    const second = addTrackedChannel('channel-2', { postMessage: jest.fn() } as unknown as Window)

    handleInvalid(routingContext, invalidEvent({ processId: first.processId, error: 'Error 1' }))
    handleInvalid(routingContext, invalidEvent({ processId: second.processId, error: 'Error 2' }))

    expect([first.invalidHandler.mock.calls, second.invalidHandler.mock.calls]).toEqual([
      [[{ reason: 'Error 1', origin: 'http://remote.example' }, expect.anything()]],
      [[{ reason: 'Error 2', origin: 'http://remote.example' }, expect.anything()]],
    ])
  })

  it('fires one event per report on the same channel', () => {
    const { processId, invalidHandler } = addTrackedChannel('test-channel', mockWindow)
    const reasons = ['Invalid action format', 'Contract mismatch', 'Security violation', 'Timeout', 'Unknown error']

    for (const error of reasons) {
      handleInvalid(routingContext, invalidEvent({ processId, error }))
    }

    expect(invalidHandler.mock.calls.map(([data]) => (data as { reason: string }).reason)).toEqual(reasons)
  })
})
