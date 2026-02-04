/**
 * Tests for message notification
 */

import { notifyMessage } from './notify-message'
import type { ChannelInternals } from '../types'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelState } from '../../types'
import type { MessageHandler } from '../../types/channel'
import type { IMessage } from '../../types/message'

describe('channel/subscription/notify-message', () => {
  let mockChannel: ChannelInternals
  let state: ChannelState
  let mockGetState: jest.Mock<ChannelState, []>
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

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
    }

    mockGetState = jest.fn(() => state)
    mockChannel = {
      getState: mockGetState,
      updateState: jest.fn(),
      sendAction: jest.fn(),
      createProcess: jest.fn(),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: <ActionCreators>{},
    }
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('calls all message handlers with message', () => {
    const handler1: MessageHandler = jest.fn()
    const handler2: MessageHandler = jest.fn()
    const handler3: MessageHandler = jest.fn()

    state = { ...state, messageSubscriptions: [handler1, handler2, handler3] }
    mockGetState.mockReturnValue(state)

    const message: IMessage = {
      type: 'USER_ACTION',
      data: { userId: 123 },
    }

    notifyMessage(mockChannel, message)

    expect(handler1).toHaveBeenCalledWith(message)
    expect(handler2).toHaveBeenCalledWith(message)
    expect(handler3).toHaveBeenCalledWith(message)
  })

  it('does nothing if no subscribers', () => {
    state = { ...state, messageSubscriptions: [] }
    mockGetState.mockReturnValue(state)

    const message: IMessage = {
      type: 'USER_ACTION',
      data: {},
    }

    // Should not throw
    expect(() => notifyMessage(mockChannel, message)).not.toThrow()
  })

  it('continue notifying even if a handler throws', () => {
    const handler1: MessageHandler = jest.fn()
    const handler2: MessageHandler = jest.fn(() => {
      throw new Error('Handler 2 failed')
    })
    const handler3: MessageHandler = jest.fn()

    state = { ...state, messageSubscriptions: [handler1, handler2, handler3] }
    mockGetState.mockReturnValue(state)

    const message: IMessage = {
      type: 'USER_ACTION',
      data: {},
    }

    notifyMessage(mockChannel, message)

    expect(handler1).toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
    expect(handler3).toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith("Error in message handler for 'USER_ACTION' message:", expect.any(Error))
  })

  it('handles messages with different data types', () => {
    const handler: MessageHandler = jest.fn()
    state = { ...state, messageSubscriptions: [handler] }
    mockGetState.mockReturnValue(state)

    const message1: IMessage = {
      type: 'STRING_DATA',
      data: 'hello',
    }
    const message2: IMessage = {
      type: 'NUMBER_DATA',
      data: 42,
    }
    const message3: IMessage = {
      type: 'OBJECT_DATA',
      data: { key: 'value' },
    }
    const message4: IMessage = {
      type: 'ARRAY_DATA',
      data: [1, 2, 3],
    }

    notifyMessage(mockChannel, message1)
    notifyMessage(mockChannel, message2)
    notifyMessage(mockChannel, message3)
    notifyMessage(mockChannel, message4)

    expect(handler).toHaveBeenCalledTimes(4)
  })
})
