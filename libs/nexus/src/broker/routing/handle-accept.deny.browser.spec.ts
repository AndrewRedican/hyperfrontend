import type { Logger } from '@hyperfrontend/logging'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { BrokerState } from '../types'
import type { RoutingContext } from './types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { addChannel } from '../channels/add'
import { handleAccept } from './handle-accept'

describe('handleAccept deny gates', () => {
  const ownContract: IChannelContract = {
    accepted: [{ type: 'test-message', description: 'Test message', required: true }],
    emitted: [{ type: 'response-message', description: 'Response message' }],
  }

  const peerContract: IChannelContract = {
    accepted: [{ type: 'response-message' }],
    emitted: [{ type: 'test-message' }],
  }

  const brokenContract = <IChannelContract>(<unknown>{ accepted: null })
  const silentContract: IChannelContract = { accepted: [{ type: 'response-message' }], emitted: [{ type: 'unrelated-type' }] }

  let mockLogger: Logger
  let mockBrokerState: BrokerState

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let actions: ReturnType<typeof createActionCreators>
  let mockWindow: Window
  let routingContext: RoutingContext

  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

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
      contract: ownContract,
      settings: {
        contract: ownContract,
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

  function acceptEvent(processId: string, overrides: Partial<{ senderId: string; contract: IChannelContract; origin: string }> = {}) {
    return <MessageEvent<IAction>>{
      data: <IAction>{
        type: '[nexus] connection-request-accepted',
        processId,
        senderId: overrides.senderId ?? 'remote-broker-1',
        contract: overrides.contract ?? peerContract,
      },
      origin: overrides.origin ?? 'http://remote.example',
      source: mockWindow,
    }
  }

  function addRequestingChannel(context: RoutingContext = routingContext) {
    const channel = addChannel(context.state, registry, processManager, actions, 'test-channel', mockWindow)
    channel.connect()
    const processId = channel.getPendingProcessId()
    if (processId === null) throw new Error('connect() did not record a pending process')
    ;(<jest.Mock>mockWindow.postMessage).mockClear()
    return { channel, processId }
  }

  function contextWithPolicy(allowed: boolean): RoutingContext {
    return {
      ...routingContext,
      state: {
        ...mockBrokerState,
        settings: { ...mockBrokerState.settings, securityPolicy: jest.fn(() => allowed) },
      },
    }
  }

  function cancelFrames() {
    return (<jest.Mock>mockWindow.postMessage).mock.calls.filter(
      (call) => (<IAction>call[0]).type === '[nexus] connection-request-cancelled'
    )
  }

  describe('invalid contract gate', () => {
    it('cancels the connection and stays inactive', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, { contract: brokenContract }))

      expect({ active: channel.isActive(), cancel: (<jest.Mock>mockWindow.postMessage).mock.calls[0][0] }).toEqual({
        active: false,
        cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
      })
    })

    it('fires deny with reason invalid-contract and the validator detail', () => {
      const { channel, processId } = addRequestingChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent(processId, { contract: brokenContract }))

      expect(denyHandler.mock.calls[0][0]).toEqual({
        error: 'Invalid contract: Contract must contain at least one accepted or emitted action.',
        reason: 'invalid-contract',
        origin: 'http://remote.example',
      })
    })

    it('logs a warning naming the channel when the abort happens', () => {
      const { processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, { contract: brokenContract }))

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('aborted the test-channel connection'))
    })

    it('stops retrying after cancelling on an invalid contract', () => {
      const { processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, { contract: brokenContract }))
      ;(<jest.Mock>mockWindow.postMessage).mockClear()
      jest.advanceTimersByTime(20_000)

      expect(mockWindow.postMessage).not.toHaveBeenCalled()
    })

    it('fires deny once when a replayed ACCEPT races the cancellation', () => {
      const { channel, processId } = addRequestingChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent(processId, { contract: brokenContract }))
      handleAccept(routingContext, acceptEvent(processId, { contract: brokenContract }))

      expect({ denies: denyHandler.mock.calls.length, cancels: cancelFrames().length }).toEqual({ denies: 1, cancels: 2 })
    })
  })

  describe('required actions gate', () => {
    it('cancels the connection when the responder does not emit a required action', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(routingContext, acceptEvent(processId, { contract: silentContract }))

      expect({ active: channel.isActive(), cancel: (<jest.Mock>mockWindow.postMessage).mock.calls[0][0] }).toEqual({
        active: false,
        cancel: expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
      })
    })

    it('fires deny with reason missing-required-actions naming the missing actions', () => {
      const { channel, processId } = addRequestingChannel()
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(routingContext, acceptEvent(processId, { contract: silentContract }))

      expect(denyHandler.mock.calls[0][0]).toEqual({
        error: 'Incompatible contract: missing required actions test-message.',
        reason: 'missing-required-actions',
        origin: 'http://remote.example',
      })
    })

    it('completes the handshake when the responder emits additional unknown types', () => {
      const { channel, processId } = addRequestingChannel()

      handleAccept(
        routingContext,
        acceptEvent(processId, {
          contract: { accepted: [{ type: 'response-message' }], emitted: [{ type: 'test-message' }, { type: 'newer-optional-type' }] },
        })
      )

      expect(channel.isActive()).toBe(true)
    })
  })

  describe('security policy gate', () => {
    it('cancels the connection when the policy rejects the acceptance', () => {
      const context = contextWithPolicy(false)
      const { processId } = addRequestingChannel(context)

      handleAccept(context, acceptEvent(processId))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-request-cancelled', processId }),
        expect.any(String)
      )
    })

    it('hands the policy the acceptance event', () => {
      const context = contextWithPolicy(false)
      const { processId } = addRequestingChannel(context)
      const message = acceptEvent(processId)

      handleAccept(context, message)

      expect(context.state.settings.securityPolicy).toHaveBeenCalledWith(message)
    })

    it('fires deny with reason policy-rejected and the rejected origin', () => {
      const context = contextWithPolicy(false)
      const { channel, processId } = addRequestingChannel(context)
      const denyHandler = jest.fn()
      channel.on('deny', denyHandler)

      handleAccept(context, acceptEvent(processId))

      expect(denyHandler.mock.calls[0][0]).toEqual({
        error: "Connection acceptance from 'http://remote.example' was rejected by the channel security policy.",
        reason: 'policy-rejected',
        origin: 'http://remote.example',
      })
    })

    it('proceeds when the policy allows the acceptance', () => {
      const context = contextWithPolicy(true)
      const { processId } = addRequestingChannel(context)

      handleAccept(context, acceptEvent(processId))

      expect(mockWindow.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: '[nexus] connection-opened', processId }),
        expect.any(String)
      )
    })
  })
})
