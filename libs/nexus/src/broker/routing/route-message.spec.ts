import type { Logger } from '@hyperfrontend/logging'
import type { ActionCreators } from '../../core/actions/factory'
import type { IAction } from '../../types/action'
import type { BrokerState } from '../types'
import type { RouteHandler } from './create-router'
import type { RoutingContext } from './types'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { createRouter } from './create-router'
import { routeMessage } from './route-message'

describe('routeMessage', () => {
  const mockBrokerState: BrokerState = {
    id: 'broker-1',
    name: 'test-broker',
    window: <Window>global.window,
    contract: {
      accepted: [{ type: 'test', description: 'Test action' }],
      emitted: [],
    },
    settings: {
      contract: {
        accepted: [{ type: 'test', description: 'Test action' }],
        emitted: [],
      },
    },
  }

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let mockActions: ActionCreators
  let mockHandler: RouteHandler
  let mockLogger: Logger
  let routingContext: RoutingContext

  beforeEach(() => {
    registry = createRegistry()
    processManager = createProcessManager()
    mockActions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => mockBrokerState.contract,
    })
    mockHandler = jest.fn()
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'debug'),
    }
    routingContext = {
      state: mockBrokerState,
      registry,
      processManager,
      actions: mockActions,
      logger: mockLogger,
      getSupportedProtocols: () => ['none'],
      getProtocol: () => undefined,
      routeAction: () => undefined,
    }
  })

  it('routes message to correct handler', () => {
    const router = createRouter({
      'test-action': mockHandler,
    })

    const message = <MessageEvent<IAction>>{
      data: <IAction>(<unknown>{
        type: 'test-action',
        senderId: 'sender-1',
        data: {},
      }),
      source: <Window>{},
    }

    routeMessage(router, routingContext, message)

    expect(mockHandler).toHaveBeenCalledTimes(1)
    expect(mockHandler).toHaveBeenCalledWith(routingContext, message)
  })

  it('handles message without action type gracefully', () => {
    const router = createRouter({
      'test-action': mockHandler,
    })

    const message = <MessageEvent<IAction>>{
      data: <IAction>{},
      source: <Window>{},
    }

    routeMessage(router, routingContext, message)

    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('logs warning when action type is missing', () => {
    const router = createRouter({})

    const message = <MessageEvent<IAction>>{
      data: <IAction>{},
      source: <Window>{},
    }

    routeMessage(router, routingContext, message)

    expect(mockLogger.warn).toHaveBeenCalledWith('Received message without action type')
  })

  it('handles unregistered action type gracefully', () => {
    const router = createRouter({
      'registered-action': mockHandler,
    })

    const message = <MessageEvent<IAction>>{
      data: <IAction>(<unknown>{
        type: 'unregistered-action',
        senderId: 'sender-1',
        data: {},
      }),
      source: <Window>{},
    }

    routeMessage(router, routingContext, message)

    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('logs warning for unregistered action type', () => {
    const router = createRouter({})

    const message = <MessageEvent<IAction>>{
      data: <IAction>(<unknown>{
        type: 'unknown-action',
        senderId: 'sender-1',
        data: {},
      }),
      source: <Window>{},
    }

    routeMessage(router, routingContext, message)

    expect(mockLogger.warn).toHaveBeenCalledWith('No handler for action type: unknown-action')
  })

  it('catchs and handle errors from handlers', () => {
    const errorHandler: RouteHandler = jest.fn(() => {
      throw new Error('Handler error')
    })

    const router = createRouter({
      'error-action': errorHandler,
    })

    const message = <MessageEvent<IAction>>{
      data: <IAction>(<unknown>{
        type: 'error-action',
        senderId: 'sender-1',
        data: {},
      }),
      source: <Window>{},
    }

    expect(() => {
      routeMessage(router, routingContext, message)
    }).not.toThrow()

    expect(errorHandler).toHaveBeenCalled()
  })

  it('logs error when handler throws', () => {
    const errorHandler: RouteHandler = jest.fn(() => {
      throw new Error('Handler error')
    })

    const router = createRouter({
      'error-action': errorHandler,
    })

    const message = <MessageEvent<IAction>>{
      data: <IAction>(<unknown>{
        type: 'error-action',
        senderId: 'sender-1',
        data: {},
      }),
      source: <Window>{},
    }

    routeMessage(router, routingContext, message)

    expect(mockLogger.error).toHaveBeenCalledWith('Error routing message:', expect.any(Error))
  })

  it('handles null/undefined message data', () => {
    const router = createRouter({
      'test-action': mockHandler,
    })

    const message = <MessageEvent<IAction>>(<unknown>{
      data: null,
      source: <Window>{},
    })

    expect(() => {
      routeMessage(router, routingContext, message)
    }).not.toThrow()

    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('routes different action types to different handlers', () => {
    const handler1: RouteHandler = jest.fn()
    const handler2: RouteHandler = jest.fn()

    const router = createRouter({
      'action-1': handler1,
      'action-2': handler2,
    })

    const message1 = <MessageEvent<IAction>>{
      data: <IAction>(<unknown>{ type: 'action-1', senderId: 'sender-1', data: {} }),
      source: <Window>{},
    }

    const message2 = <MessageEvent<IAction>>{
      data: <IAction>(<unknown>{ type: 'action-2', senderId: 'sender-1', data: {} }),
      source: <Window>{},
    }

    routeMessage(router, routingContext, message1)
    routeMessage(router, routingContext, message2)

    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it('logs debug message for received actions via logAction', () => {
    const router = createRouter({
      'test-action': mockHandler,
    })

    const message = <MessageEvent<IAction>>{
      data: <IAction>(<unknown>{
        type: 'test-action',
        senderId: 'sender-1',
        data: {},
      }),
      source: <Window>{},
    }

    routeMessage(router, routingContext, message)

    expect(mockLogger.debug).toHaveBeenCalledWith('Action received:', 'test-action', expect.any(Object))
  })
})
