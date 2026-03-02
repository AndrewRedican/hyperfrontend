import type { ChannelState } from '../../types'
import type { IMessage } from '../../types/message'
import type { ChannelInternals } from '../types'
import { receive } from './receive'

describe('channel/messaging/receive', () => {
  let mockChannel: ChannelInternals
  let state: ChannelState
  let mockGetState: jest.Mock<ChannelState, []>

  beforeEach(() => {
    state = {
      id: 'channel-123',
      name: 'test-channel',
      target: window,
      origin: 'https://example.com',
      active: true,
      connectTimestamp: Date.now(),
      contract: {
        accepted: [{ type: 'USER_ACTION' }],
        emitted: [{ type: 'SYSTEM_MESSAGE' }, { type: 'NOTIFICATION' }],
      },
      acceptedActions: ['USER_ACTION'],
      queuedMessages: [],
      queueMessages: true,
      eventSubscriptions: [],
      messageSubscriptions: [],
      scheduledActivation: null,

      brokerManaged: false,
      readyToConnect: true,
      negotiatedProtocol: null,
      securityReady: false,
      securityTransport: null,
      pendingSecurityRequest: null,
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
      actions: <ChannelInternals['actions']>(<unknown>{}),
    }
  })

  it('notifys message subscribers for valid message type', () => {
    const message: IMessage = {
      type: 'SYSTEM_MESSAGE',
      data: { text: 'Hello' },
    }

    receive(mockChannel, message)

    expect(mockChannel.notifyMessage).toHaveBeenCalledWith(message)
  })

  it('acceptss all emitted message types', () => {
    const message1: IMessage = {
      type: 'SYSTEM_MESSAGE',
      data: {},
    }
    const message2: IMessage = {
      type: 'NOTIFICATION',
      data: {},
    }

    receive(mockChannel, message1)
    receive(mockChannel, message2)

    expect(mockChannel.notifyMessage).toHaveBeenCalledTimes(2)
  })

  it('throws error if message type not in contract', () => {
    const message: IMessage = {
      type: 'UNKNOWN_TYPE',
      data: {},
    }

    expect(() => receive(mockChannel, message)).toThrow(
      "Received message type 'UNKNOWN_TYPE' not emitted in test-channel channel contract."
    )
  })

  it('works when contract is null', () => {
    state = { ...state, contract: null }
    mockGetState.mockReturnValue(state)

    const message: IMessage = {
      type: 'ANY_TYPE',
      data: {},
    }

    // Should not throw
    receive(mockChannel, message)
    expect(mockChannel.notifyMessage).toHaveBeenCalledWith(message)
  })
})
