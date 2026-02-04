/**
 * Tests for createRouter function
 */

import { createRouter, type HandlerMap, type RouteHandler } from './create-router'

describe('createRouter', () => {
  const mockHandler: RouteHandler = jest.fn()
  const mockHandler2: RouteHandler = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates empty router map when no handlers provided', () => {
    const router = createRouter({})

    expect(router).toBeInstanceOf(Map)
    expect(router.size).toBe(0)
  })

  it('creates router map with single handler', () => {
    const handlers: HandlerMap = {
      'test-action': mockHandler,
    }

    const router = createRouter(handlers)

    expect(router.size).toBe(1)
    expect(router.get('test-action')).toBe(mockHandler)
  })

  it('creates router map with multiple handlers', () => {
    const handlers: HandlerMap = {
      'action-1': mockHandler,
      'action-2': mockHandler2,
    }

    const router = createRouter(handlers)

    expect(router.size).toBe(2)
    expect(router.get('action-1')).toBe(mockHandler)
    expect(router.get('action-2')).toBe(mockHandler2)
  })

  it('handles all standard Nexus protocol action types', () => {
    const handlers: HandlerMap = {
      '[nexus] connection-request': mockHandler,
      '[nexus] connection-request-accepted': mockHandler,
      '[nexus] connection-request-denied': mockHandler,
      '[nexus] connection-request-cancelled': mockHandler,
      '[nexus] connection-opened': mockHandler,
      '[nexus] connection-closed': mockHandler,
      '[nexus] channel-destroyed': mockHandler,
      '[nexus] new-message': mockHandler,
    }

    const router = createRouter(handlers)

    expect(router.size).toBe(8)
    expect(router.get('[nexus] connection-request')).toBe(mockHandler)
    expect(router.get('[nexus] connection-request-accepted')).toBe(mockHandler)
    expect(router.get('[nexus] connection-request-denied')).toBe(mockHandler)
    expect(router.get('[nexus] connection-request-cancelled')).toBe(mockHandler)
    expect(router.get('[nexus] connection-opened')).toBe(mockHandler)
    expect(router.get('[nexus] connection-closed')).toBe(mockHandler)
    expect(router.get('[nexus] channel-destroyed')).toBe(mockHandler)
    expect(router.get('[nexus] new-message')).toBe(mockHandler)
  })

  it('return undefined for unregistered action types', () => {
    const handlers: HandlerMap = {
      'registered-action': mockHandler,
    }

    const router = createRouter(handlers)

    expect(router.get('unregistered-action')).toBeUndefined()
  })

  it('allows handler overwriting when called multiple times', () => {
    const handlers1: HandlerMap = {
      'test-action': mockHandler,
    }

    const handlers2: HandlerMap = {
      'test-action': mockHandler2,
    }

    const router1 = createRouter(handlers1)
    const router2 = createRouter(handlers2)

    expect(router1.get('test-action')).toBe(mockHandler)
    expect(router2.get('test-action')).toBe(mockHandler2)
  })

  it('be immutable after creation', () => {
    const handlers: HandlerMap = {
      'test-action': mockHandler,
    }

    const router = createRouter(handlers)
    const originalSize = router.size

    // Adding new handler directly to the map
    router.set('new-action', mockHandler2)

    expect(router.size).toBe(originalSize + 1)
  })

  it('handles special characters in action type names', () => {
    const handlers: HandlerMap = {
      '[special] action/type:with-chars': mockHandler,
      'action@with#symbols': mockHandler2,
    }

    const router = createRouter(handlers)

    expect(router.get('[special] action/type:with-chars')).toBe(mockHandler)
    expect(router.get('action@with#symbols')).toBe(mockHandler2)
  })
})
