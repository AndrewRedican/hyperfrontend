import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelState } from '../../types'
import type { IMessage } from '../../types/message'
import type { ChannelInternals } from '../types'
import * as queueMessageModule from '../state/queue-message'
import { queue } from './queue'

jest.mock('../state/queue-message')

describe('channel/messaging/queue', () => {
  let mockChannel: ChannelInternals
  let state: ChannelState

  beforeEach(() => {
    jest.clearAllMocks()

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
      updateState: jest.fn(),
      sendAction: jest.fn(),
      createProcess: jest.fn(),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: <ActionCreators>{},
    }
    ;(<jest.Mock>queueMessageModule.queueMessage).mockReturnValue({
      ...state,
      queuedMessages: [{ type: 'TEST', data: {} }],
    })
  })

  it('queue message using state module', () => {
    const message: IMessage = {
      type: 'USER_ACTION',
      data: { userId: 123 },
    }

    queue(mockChannel, message)

    expect(queueMessageModule.queueMessage).toHaveBeenCalledWith(state, message)
  })

  it('updates channel state with queued message', () => {
    const message: IMessage = {
      type: 'USER_ACTION',
      data: { userId: 123 },
    }

    queue(mockChannel, message)

    expect(mockChannel.updateState).toHaveBeenCalledWith({
      ...state,
      queuedMessages: [{ type: 'TEST', data: {} }],
    })
  })
})
