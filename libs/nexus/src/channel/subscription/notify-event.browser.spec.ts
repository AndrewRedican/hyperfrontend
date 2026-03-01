import type { Logger } from '@hyperfrontend/logging'
import type { ChannelInternals } from '../../channel/types'
import type { ActionCreators } from '../../core/actions/factory'
import type { EventHandler, ChannelState } from '../../types/channel'
import { notifyEvent } from './notify-event'

describe('channel/subscription/notify-event', () => {
  let mockChannel: ChannelInternals
  let state: ChannelState
  let mockGetState: jest.Mock<ChannelState, []>
  let mockLogger: Logger

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
      logger: mockLogger,
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

  it('calls all event handlers with event and data', () => {
    const handler1: EventHandler = jest.fn()
    const handler2: EventHandler = jest.fn()
    const handler3: EventHandler = jest.fn()

    state = { ...state, eventSubscriptions: [handler1, handler2, handler3] }
    mockGetState.mockReturnValue(state)

    notifyEvent(mockChannel, 'open', { timestamp: 123 })

    expect(handler1).toHaveBeenCalledWith('open', { timestamp: 123 }, expect.any(Object))
    expect(handler2).toHaveBeenCalledWith('open', { timestamp: 123 }, expect.any(Object))
    expect(handler3).toHaveBeenCalledWith('open', { timestamp: 123 }, expect.any(Object))
  })

  it('works without data parameter', () => {
    const handler: EventHandler = jest.fn()
    state = { ...state, eventSubscriptions: [handler] }
    mockGetState.mockReturnValue(state)

    notifyEvent(mockChannel, 'close')

    expect(handler).toHaveBeenCalledWith('close', undefined, expect.any(Object))
  })

  it('does nothing if no subscribers', () => {
    state = { ...state, eventSubscriptions: [] }
    mockGetState.mockReturnValue(state)

    // Should not throw
    expect(() => notifyEvent(mockChannel, 'open')).not.toThrow()
  })

  it('continue notifying even if a handler throws', () => {
    const handler1: EventHandler = jest.fn()
    const handler2: EventHandler = jest.fn(() => {
      throw new Error('Handler 2 failed')
    })
    const handler3: EventHandler = jest.fn()

    state = { ...state, eventSubscriptions: [handler1, handler2, handler3] }
    mockGetState.mockReturnValue(state)

    notifyEvent(mockChannel, 'open')

    expect(handler1).toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
    expect(handler3).toHaveBeenCalled()
    expect(mockLogger.error).toHaveBeenCalledWith("Error in event handler for 'open' event:", expect.any(Error))
  })

  it('handles all event types', () => {
    const handler: EventHandler = jest.fn()
    state = { ...state, eventSubscriptions: [handler] }
    mockGetState.mockReturnValue(state)

    notifyEvent(mockChannel, 'open')
    notifyEvent(mockChannel, 'close')
    notifyEvent(mockChannel, 'cancel')
    notifyEvent(mockChannel, 'deny')
    notifyEvent(mockChannel, 'invalid')

    expect(handler).toHaveBeenCalledTimes(5)
  })
})
