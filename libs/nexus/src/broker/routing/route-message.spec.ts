import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { BrokerState } from '../types'
import type { RouteHandler, RoutingContext } from './types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createActionCreators } from '../../core/actions/factory'
import { createProcessManager } from '../../core/processes/factory'
import { createRegistry } from '../../core/registry/factory'
import { createRouter } from './create-router'
import { routeMessage } from './route-message'

describe('routeMessage', () => {
  const contract: IChannelContract = {
    accepted: [{ type: 'test', description: 'Test action' }],
    emitted: [],
  }

  let mockHandler: RouteHandler
  let mockLogger: Logger
  let routingContext: RoutingContext

  beforeEach(() => {
    mockHandler = jest.fn()
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'debug'),
    } as unknown as Logger
    const state: BrokerState = {
      id: 'broker-1',
      name: 'test-broker',
      window: global.window as Window,
      contract,
      settings: { contract },
      logger: mockLogger,
    }
    routingContext = {
      state,
      registry: createRegistry(),
      processManager: createProcessManager(),
      actions: createActionCreators({ getBrokerId: () => 'broker-1', getContract: () => contract }),
      logger: mockLogger,
      getSupportedProtocols: () => ['none'],
      security: { localId: 'broker-1', getProvider: () => undefined, dispatch: () => undefined },
    }
  })

  function messageEvent(data: unknown): MessageEvent<IAction> {
    return { data, source: {} as Window } as unknown as MessageEvent<IAction>
  }

  function actionOfType(type: string): IAction {
    return { type, senderId: 'sender-1', data: {} } as unknown as IAction
  }

  it('routes the message to the handler registered for its action type', () => {
    const router = createRouter({ 'test-action': mockHandler })
    const message = messageEvent(actionOfType('test-action'))

    routeMessage(router, routingContext, message)

    expect(mockHandler).toHaveBeenCalledWith(routingContext, message)
  })

  it('calls the handler once per message', () => {
    const router = createRouter({ 'test-action': mockHandler })

    routeMessage(router, routingContext, messageEvent(actionOfType('test-action')))

    expect(mockHandler).toHaveBeenCalledTimes(1)
  })

  it('skips the handlers when the action has no type', () => {
    const router = createRouter({ 'test-action': mockHandler })

    routeMessage(router, routingContext, messageEvent({}))

    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('warns when the action has no type', () => {
    routeMessage(createRouter({}), routingContext, messageEvent({}))

    expect(mockLogger.warn).toHaveBeenCalledWith('Received message without action type')
  })

  it('skips the handlers for an unregistered action type', () => {
    const router = createRouter({ 'registered-action': mockHandler })

    routeMessage(router, routingContext, messageEvent(actionOfType('unregistered-action')))

    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('warns for an unregistered action type', () => {
    routeMessage(createRouter({}), routingContext, messageEvent(actionOfType('unknown-action')))

    expect(mockLogger.warn).toHaveBeenCalledWith('No handler for action type: unknown-action')
  })

  it('swallows errors thrown by a handler', () => {
    const router = createRouter({
      'error-action': () => {
        throw new Error('Handler error')
      },
    })

    expect(() => routeMessage(router, routingContext, messageEvent(actionOfType('error-action')))).not.toThrow()
  })

  it('logs errors thrown by a handler', () => {
    const error = new Error('Handler error')
    const router = createRouter({
      'error-action': () => {
        throw error
      },
    })

    routeMessage(router, routingContext, messageEvent(actionOfType('error-action')))

    expect(mockLogger.error).toHaveBeenCalledWith('Error routing message:', error)
  })

  it('tolerates a message without a payload', () => {
    const router = createRouter({ 'test-action': mockHandler })

    routeMessage(router, routingContext, messageEvent(null))

    expect(mockHandler).not.toHaveBeenCalled()
  })

  it('routes different action types to their own handlers', () => {
    const handler1: RouteHandler = jest.fn()
    const handler2: RouteHandler = jest.fn()
    const router = createRouter({ 'action-1': handler1, 'action-2': handler2 })

    routeMessage(router, routingContext, messageEvent(actionOfType('action-1')))
    routeMessage(router, routingContext, messageEvent(actionOfType('action-2')))

    expect([(handler1 as Mock).mock.calls.length, (handler2 as Mock).mock.calls.length]).toEqual([1, 1])
  })

  it('logs each received action at debug level', () => {
    const router = createRouter({ 'test-action': mockHandler })
    const action = actionOfType('test-action')

    routeMessage(router, routingContext, messageEvent(action))

    expect(mockLogger.debug).toHaveBeenCalledWith('Action received:', 'test-action', action)
  })
})
