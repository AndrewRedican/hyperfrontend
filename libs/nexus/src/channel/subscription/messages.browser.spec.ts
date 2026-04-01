import type { ChannelInternals } from '../../channel/types'
import type { ActionCreators } from '../../core/actions/factory'
import type { MessageHandler, ChannelState } from '../../types/channel'
import { subscribeToMessages } from './messages'

describe('channel/subscription/messages', () => {
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

  it('adds handler to messageSubscriptions', () => {
    const handler: MessageHandler = jest.fn()

    subscribeToMessages(mockChannel, handler)

    expect(state.messageSubscriptions).toContain(handler)
    expect(state.messageSubscriptions).toHaveLength(1)
  })

  it('allows multiple handlers', () => {
    const handler1: MessageHandler = jest.fn()
    const handler2: MessageHandler = jest.fn()
    const handler3: MessageHandler = jest.fn()

    subscribeToMessages(mockChannel, handler1)
    subscribeToMessages(mockChannel, handler2)
    subscribeToMessages(mockChannel, handler3)

    expect(state.messageSubscriptions).toHaveLength(3)
    expect(state.messageSubscriptions).toContain(handler1)
    expect(state.messageSubscriptions).toContain(handler2)
    expect(state.messageSubscriptions).toContain(handler3)
  })

  it('return unsubscribe function', () => {
    const handler: MessageHandler = jest.fn()

    const unsubscribe = subscribeToMessages(mockChannel, handler)

    expect(typeof unsubscribe).toBe('function')
  })

  it('removes handler when unsubscribe is called', () => {
    const handler: MessageHandler = jest.fn()

    const unsubscribe = subscribeToMessages(mockChannel, handler)
    expect(state.messageSubscriptions).toContain(handler)

    unsubscribe()
    expect(state.messageSubscriptions).not.toContain(handler)
    expect(state.messageSubscriptions).toHaveLength(0)
  })

  it('only remove the specific handler', () => {
    const handler1: MessageHandler = jest.fn()
    const handler2: MessageHandler = jest.fn()
    const handler3: MessageHandler = jest.fn()

    subscribeToMessages(mockChannel, handler1)
    const unsubscribe2 = subscribeToMessages(mockChannel, handler2)
    subscribeToMessages(mockChannel, handler3)

    expect(state.messageSubscriptions).toHaveLength(3)

    unsubscribe2()

    expect(state.messageSubscriptions).toHaveLength(2)
    expect(state.messageSubscriptions).toContain(handler1)
    expect(state.messageSubscriptions).not.toContain(handler2)
    expect(state.messageSubscriptions).toContain(handler3)
  })

  it('throws error if handler is not a function', () => {
    expect(() => subscribeToMessages(mockChannel, <MessageHandler>(<unknown>null))).toThrow('Expected callback function.')
    expect(() => subscribeToMessages(mockChannel, <MessageHandler>(<unknown>undefined))).toThrow('Expected callback function.')
    expect(() => subscribeToMessages(mockChannel, <MessageHandler>(<unknown>'not a function'))).toThrow('Expected callback function.')
  })

  it('handles multiple unsubscribe calls gracefully', () => {
    const handler: MessageHandler = jest.fn()

    const unsubscribe = subscribeToMessages(mockChannel, handler)

    unsubscribe()
    expect(state.messageSubscriptions).toHaveLength(0)

    unsubscribe()
    expect(state.messageSubscriptions).toHaveLength(0)
  })
})
