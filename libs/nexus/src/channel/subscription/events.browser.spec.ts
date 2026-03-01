import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelState } from '../../types'
import type { EventHandler } from '../../types/channel'
import type { OpenCallback, CloseCallback, CancelCallback } from '../../types/events'
import type { ChannelInternals } from '../types'
import { subscribeToEvents } from './events'

describe('channel/subscription/events', () => {
  let mockChannel: ChannelInternals
  let state: ChannelState

  beforeEach(() => {
    state = {
      id: 'channel-123',
      name: 'test-channel',
      target: window,
      origin: null,
      active: false,
      connectTimestamp: null,
      contract: null,
      acceptedActions: [],
      queuedMessages: [],
      queueMessages: true,
      eventSubscriptions: [],
      messageSubscriptions: [],
      scheduledActivation: null,

      brokerManaged: false,
      readyToConnect: false,
      negotiatedProtocol: null,
      securityReady: false,
      securityTransport: null,
      pendingSecurityRequest: null,
    }

    mockChannel = {
      getState: () => state,
      updateState: (partial) => {
        state = { ...state, ...partial }
      },
      sendAction: jest.fn(),
      createProcess: jest.fn(),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: <ActionCreators>{},
    }
  })

  it('adds handler to eventSubscriptions', () => {
    const handler: EventHandler = jest.fn()

    subscribeToEvents(mockChannel, handler)

    expect(state.eventSubscriptions).toContain(handler)
    expect(state.eventSubscriptions).toHaveLength(1)
  })

  it('allows multiple handlers', () => {
    const handler1: EventHandler = jest.fn()
    const handler2: EventHandler = jest.fn()
    const handler3: EventHandler = jest.fn()

    subscribeToEvents(mockChannel, handler1)
    subscribeToEvents(mockChannel, handler2)
    subscribeToEvents(mockChannel, handler3)

    expect(state.eventSubscriptions).toHaveLength(3)
    expect(state.eventSubscriptions).toContain(handler1)
    expect(state.eventSubscriptions).toContain(handler2)
    expect(state.eventSubscriptions).toContain(handler3)
  })

  it('return unsubscribe function', () => {
    const handler: EventHandler = jest.fn()

    const unsubscribe = subscribeToEvents(mockChannel, handler)

    expect(typeof unsubscribe).toBe('function')
  })

  it('removes handler when unsubscribe is called', () => {
    const handler: EventHandler = jest.fn()

    const unsubscribe = subscribeToEvents(mockChannel, handler)
    expect(state.eventSubscriptions).toContain(handler)

    unsubscribe()
    expect(state.eventSubscriptions).not.toContain(handler)
    expect(state.eventSubscriptions).toHaveLength(0)
  })

  it('only remove the specific handler', () => {
    const handler1: EventHandler = jest.fn()
    const handler2: EventHandler = jest.fn()
    const handler3: EventHandler = jest.fn()

    subscribeToEvents(mockChannel, handler1)
    const unsubscribe2 = subscribeToEvents(mockChannel, handler2)
    subscribeToEvents(mockChannel, handler3)

    expect(state.eventSubscriptions).toHaveLength(3)

    unsubscribe2()

    expect(state.eventSubscriptions).toHaveLength(2)
    expect(state.eventSubscriptions).toContain(handler1)
    expect(state.eventSubscriptions).not.toContain(handler2)
    expect(state.eventSubscriptions).toContain(handler3)
  })

  it('throws error if handler is not a function', () => {
    expect(() => subscribeToEvents(mockChannel, <EventHandler>(<unknown>null))).toThrow('Expected callback function.')
    expect(() => subscribeToEvents(mockChannel, <EventHandler>(<unknown>undefined))).toThrow('Expected callback function.')
    expect(() => subscribeToEvents(mockChannel, <EventHandler>(<unknown>'not a function'))).toThrow('Expected callback function.')
  })

  it('handles multiple unsubscribe calls gracefully', () => {
    const handler: EventHandler = jest.fn()

    const unsubscribe = subscribeToEvents(mockChannel, handler)

    unsubscribe()
    expect(state.eventSubscriptions).toHaveLength(0)

    // Second call should not throw
    unsubscribe()
    expect(state.eventSubscriptions).toHaveLength(0)
  })

  describe('event-specific subscriptions', () => {
    it('subscribes to a specific event type', () => {
      const handler: OpenCallback = jest.fn()

      subscribeToEvents(mockChannel, 'open', handler)

      expect(state.eventSubscriptions).toHaveLength(1)
    })

    it('only calls handler for matching event type', () => {
      const openHandler: OpenCallback = jest.fn()
      const closeHandler: CloseCallback = jest.fn()

      subscribeToEvents(mockChannel, 'open', openHandler)
      subscribeToEvents(mockChannel, 'close', closeHandler)

      const mockChannelJSON = {
        id: 'channel-123',
        name: 'test-channel',
        active: false,
        origin: null,
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }

      // Simulate 'open' event
      const wrappedOpenHandler = state.eventSubscriptions[0]
      wrappedOpenHandler('open', { origin: 'http://test.com', contract: { emitted: [], accepted: [] } }, mockChannelJSON)

      expect(openHandler).toHaveBeenCalledWith({ origin: 'http://test.com', contract: { emitted: [], accepted: [] } }, mockChannelJSON)
      expect(closeHandler).not.toHaveBeenCalled()

      // Simulate 'close' event
      const wrappedCloseHandler = state.eventSubscriptions[1]
      wrappedCloseHandler('close', { notify: true }, mockChannelJSON)

      expect(closeHandler).toHaveBeenCalledWith({ notify: true }, mockChannelJSON)
      expect(openHandler).toHaveBeenCalledTimes(1) // Still only called once
    })

    it('does not call handler for non-matching event type', () => {
      const openHandler: OpenCallback = jest.fn()

      subscribeToEvents(mockChannel, 'open', openHandler)

      const mockChannelJSON = {
        id: 'channel-123',
        name: 'test-channel',
        active: false,
        origin: null,
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }

      // Simulate 'close' event on open handler
      const wrappedHandler = state.eventSubscriptions[0]
      wrappedHandler('close', { notify: true }, mockChannelJSON)

      expect(openHandler).not.toHaveBeenCalled()
    })

    it('returns unsubscribe function for event-specific subscription', () => {
      const handler: OpenCallback = jest.fn()

      const unsubscribe = subscribeToEvents(mockChannel, 'open', handler)

      expect(typeof unsubscribe).toBe('function')
      expect(state.eventSubscriptions).toHaveLength(1)

      unsubscribe()

      expect(state.eventSubscriptions).toHaveLength(0)
    })

    it('works with cancel events', () => {
      const cancelHandler: CancelCallback = jest.fn()

      subscribeToEvents(mockChannel, 'cancel', cancelHandler)

      const mockChannelJSON = {
        id: 'channel-123',
        name: 'test-channel',
        active: false,
        origin: null,
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }

      const wrappedHandler = state.eventSubscriptions[0]
      wrappedHandler('cancel', { notify: false }, mockChannelJSON)

      expect(cancelHandler).toHaveBeenCalledWith({ notify: false }, mockChannelJSON)
    })

    it('supports multiple event-specific subscriptions for same event', () => {
      const handler1: OpenCallback = jest.fn()
      const handler2: OpenCallback = jest.fn()

      subscribeToEvents(mockChannel, 'open', handler1)
      subscribeToEvents(mockChannel, 'open', handler2)

      expect(state.eventSubscriptions).toHaveLength(2)

      const mockChannelJSON = {
        id: 'channel-123',
        name: 'test-channel',
        active: false,
        origin: null,
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }

      // Both handlers should be called for 'open' event
      const openData = { origin: 'http://test.com', contract: { emitted: [], accepted: [] } }
      state.eventSubscriptions[0]('open', openData, mockChannelJSON)
      state.eventSubscriptions[1]('open', openData, mockChannelJSON)

      expect(handler1).toHaveBeenCalledWith(openData, mockChannelJSON)
      expect(handler2).toHaveBeenCalledWith(openData, mockChannelJSON)
    })

    it('can mix generic and event-specific subscriptions', () => {
      const genericHandler: EventHandler = jest.fn()
      const openHandler: OpenCallback = jest.fn()

      subscribeToEvents(mockChannel, genericHandler)
      subscribeToEvents(mockChannel, 'open', openHandler)

      expect(state.eventSubscriptions).toHaveLength(2)

      const mockChannelJSON = {
        id: 'channel-123',
        name: 'test-channel',
        active: false,
        origin: null,
        connectTimestamp: null,
        contract: null,
        queuedMessagesCount: 0,
      }

      const openData = { origin: 'http://test.com', contract: { emitted: [], accepted: [] } }

      // Call all handlers with 'open' event
      state.eventSubscriptions[0]('open', openData, mockChannelJSON)
      state.eventSubscriptions[1]('open', openData, mockChannelJSON)

      // Generic handler receives full signature
      expect(genericHandler).toHaveBeenCalledWith('open', openData, mockChannelJSON)
      // Event-specific handler receives data and channel only
      expect(openHandler).toHaveBeenCalledWith(openData, mockChannelJSON)
    })
  })
})
