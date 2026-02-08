/**
 * Tests for send messaging operation
 */

import { send } from './send'
import * as queueModule from './queue'
import * as sendActionModule from './send-action'
import type { ChannelInternals } from '../types'
import type { ChannelState } from '../../types'
import type { IMessage } from '../../types/message'

jest.mock('./queue')
jest.mock('./send-action')

describe('channel/messaging/send', () => {
  let mockChannel: ChannelInternals
  let state: ChannelState
  let mockWindow: { postMessage: jest.Mock }
  let mockGetState: jest.Mock<ChannelState, []>

  beforeEach(() => {
    jest.clearAllMocks()

    mockWindow = {
      postMessage: jest.fn(),
    }

    state = {
      id: 'channel-123',
      name: 'test-channel',
      target: <Window>(<unknown>mockWindow),
      origin: 'https://example.com',
      active: true,
      connectTimestamp: Date.now(),
      contract: { accepted: [{ type: 'SYSTEM_MESSAGE' }], emitted: [{ type: 'USER_ACTION' }] },
      acceptedActions: ['SYSTEM_MESSAGE'],
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
      actions: {
        requestConnection: jest.fn(),
        acceptConnection: jest.fn(),
        denyConnection: jest.fn(),
        cancelConnection: jest.fn(),
        openConnection: jest.fn(),
        closeConnection: jest.fn(),
        destroyConnection: jest.fn(),
        newMessage: jest.fn((data) => ({
          type: '[nexus] new-message',
          senderId: 'broker-id',
          data,
        })),
        invalidRequest: jest.fn(),
      },
    }
  })

  describe('when channel is active', () => {
    it('sends message if type is accepted', () => {
      const message: IMessage = {
        type: 'USER_ACTION',
        data: { userId: 123 },
      }

      send(mockChannel, message)

      expect(mockChannel.actions.newMessage).toHaveBeenCalledWith(message.data)
      expect(sendActionModule.sendAction).toHaveBeenCalledWith(
        mockChannel,
        expect.objectContaining({
          type: '[nexus] new-message',
          senderId: 'broker-id',
        })
      )
      expect(mockChannel.notifyMessage).toHaveBeenCalledWith(message)
    })

    it('throws error if message type not accepted', () => {
      const message: IMessage = {
        type: 'UNAUTHORIZED_ACTION',
        data: {},
      }

      expect(() => send(mockChannel, message)).toThrow(
        "Cannot send message to test-channel channel. Message type 'UNAUTHORIZED_ACTION' is not in the emitted actions of channel contract."
      )
    })
  })

  describe('when channel is closed', () => {
    beforeEach(() => {
      state = { ...state, active: false }
      mockGetState.mockReturnValue(state)
    })

    it('queue message if queueMessages is enabled', () => {
      const message: IMessage = {
        type: 'USER_ACTION',
        data: { userId: 123 },
      }

      send(mockChannel, message)

      expect(queueModule.queue).toHaveBeenCalledWith(mockChannel, message)
      expect(sendActionModule.sendAction).not.toHaveBeenCalled()
    })

    it('throws error if queueMessages is disabled', () => {
      state = { ...state, queueMessages: false }
      mockGetState.mockReturnValue(state)

      const message: IMessage = {
        type: 'USER_ACTION',
        data: {},
      }

      expect(() => send(mockChannel, message)).toThrow('Cannot send message. Channel test-channel is not open.')
    })
  })
})
