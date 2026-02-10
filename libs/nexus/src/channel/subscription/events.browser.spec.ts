import type { ChannelInternals } from '../types'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelState } from '../../types'
import type { EventHandler } from '../../types/channel'
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
      debug: false,
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
})
