import type { Mock } from '@hyperfrontend/testing'
import type { ChannelState } from '../../types/channel'
import type { IMessage } from '../../types/message'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as queueModule from './queue'
import { send } from './send'
import * as sendActionModule from './send-action'

jest.mock('./queue')
jest.mock('./send-action')

describe('channel/messaging/send', () => {
  let mockChannel: ChannelInternals
  let state: ChannelState
  let mockWindow: { postMessage: Mock }
  let mockGetState: Mock<ChannelState, []>

  beforeEach(() => {
    jest.clearAllMocks()

    mockWindow = {
      postMessage: jest.fn(),
    }

    state = {
      id: 'channel-123',
      name: 'test-channel',
      target: mockWindow as unknown as Window,
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

      brokerManaged: false,
      readyToConnect: true,
      negotiatedProtocol: null,
      securityReady: false,
      securityTransport: null,
      pendingSecurityRequest: null,
      logger: {
        log: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        setLogLevel: jest.fn(),
        getLogLevel: jest.fn(),
      },
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

      expect(mockChannel.actions.newMessage).toHaveBeenCalledWith(message)
      expect(sendActionModule.sendAction).toHaveBeenCalledWith(
        mockChannel,
        expect.objectContaining({
          type: '[nexus] new-message',
          senderId: 'broker-id',
          data: message,
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

  describe('when security transport is not ready', () => {
    beforeEach(() => {
      state = {
        ...state,
        active: true,
        negotiatedProtocol: 'v2',
        securityTransport: {
          isReady: jest.fn(() => false),
          send: jest.fn(),
          receive: jest.fn(),
          stop: jest.fn(),
          resume: jest.fn(),
          getProtocol: jest.fn(() => 'v2'),
        },
      }
      mockGetState.mockReturnValue(state)
    })

    it('queues message if queueMessages is enabled', () => {
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

      expect(() => send(mockChannel, message)).toThrow('Cannot send message. Security transport for channel test-channel is not ready.')
    })
  })
})
