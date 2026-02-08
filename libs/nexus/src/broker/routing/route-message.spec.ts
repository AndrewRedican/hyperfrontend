/**
 * Tests for routeMessage function
 */

import { routeMessage } from './route-message'
import { createRouter, type RouteHandler } from './create-router'
import type { BrokerState } from '../types'
import { createRegistry } from '../../core/registry/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createActionCreators, type ActionCreators } from '../../core/actions/factory'
import type { IAction } from '../../types/action'

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
      debug: false,
    },
  }

  let registry: ReturnType<typeof createRegistry>
  let processManager: ReturnType<typeof createProcessManager>
  let mockActions: ActionCreators
  let mockHandler: RouteHandler
  let consoleWarnSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    registry = createRegistry()
    processManager = createProcessManager()
    mockActions = createActionCreators({
      getBrokerId: () => 'broker-1',
      getContract: () => mockBrokerState.contract,
    })
    mockHandler = jest.fn()
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
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

    routeMessage(router, mockBrokerState, registry, processManager, mockActions, message)

    expect(mockHandler).toHaveBeenCalledTimes(1)
    expect(mockHandler).toHaveBeenCalledWith(mockBrokerState, registry, processManager, mockActions, message)
  })

  it('handles message without action type gracefully', () => {
    const router = createRouter({
      'test-action': mockHandler,
    })

    const message = <MessageEvent<IAction>>{
      data: <IAction>{},
      source: <Window>{},
    }

    routeMessage(router, mockBrokerState, registry, processManager, mockActions, message)

    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('logs warning when action type is missing and debug is enabled', () => {
    const debugState = { ...mockBrokerState, settings: { ...mockBrokerState.settings, debug: true } }
    const router = createRouter({})

    const message = <MessageEvent<IAction>>{
      data: <IAction>{},
      source: <Window>{},
    }

    routeMessage(router, debugState, registry, processManager, mockActions, message)

    expect(consoleWarnSpy).toHaveBeenCalledWith('[nexus] Received message without action type')
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

    routeMessage(router, mockBrokerState, registry, processManager, mockActions, message)

    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('logs warning for unregistered action type when debug is enabled', () => {
    const debugState = { ...mockBrokerState, settings: { ...mockBrokerState.settings, debug: true } }
    const router = createRouter({})

    const message = <MessageEvent<IAction>>{
      data: <IAction>(<unknown>{
        type: 'unknown-action',
        senderId: 'sender-1',
        data: {},
      }),
      source: <Window>{},
    }

    routeMessage(router, debugState, registry, processManager, mockActions, message)

    expect(consoleWarnSpy).toHaveBeenCalledWith('[nexus] No handler for action type: unknown-action')
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
      routeMessage(router, mockBrokerState, registry, processManager, mockActions, message)
    }).not.toThrow()

    expect(errorHandler).toHaveBeenCalled()
  })

  it('logs error when handler throws and debug is enabled', () => {
    const debugState = { ...mockBrokerState, settings: { ...mockBrokerState.settings, debug: true } }
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

    routeMessage(router, debugState, registry, processManager, mockActions, message)

    expect(consoleErrorSpy).toHaveBeenCalledWith('[nexus] Error routing message:', expect.any(Error))
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
      routeMessage(router, mockBrokerState, registry, processManager, mockActions, message)
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

    routeMessage(router, mockBrokerState, registry, processManager, mockActions, message1)
    routeMessage(router, mockBrokerState, registry, processManager, mockActions, message2)

    expect(handler1).toHaveBeenCalledTimes(1)
    expect(handler2).toHaveBeenCalledTimes(1)
  })

  it('does not log when debug is disabled', () => {
    const router = createRouter({})

    const message = <MessageEvent<IAction>>{
      data: <IAction>(<unknown>{
        type: 'unknown-action',
        senderId: 'sender-1',
        data: {},
      }),
      source: <Window>{},
    }

    routeMessage(router, mockBrokerState, registry, processManager, mockActions, message)

    expect(consoleWarnSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
  })
})
