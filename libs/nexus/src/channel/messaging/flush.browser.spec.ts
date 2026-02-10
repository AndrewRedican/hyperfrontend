import type { ChannelInternals } from '../types'
import type { ActionCreators } from '../../core/actions/factory'
import type { ChannelState } from '../../types'
import type { IMessage } from '../../types/message'
import { flush } from './flush'
import * as sendModule from './send'
import * as clearQueueModule from '../state/clear-queue'

jest.mock('./send')
jest.mock('../state/clear-queue')

describe('channel/messaging/flush', () => {
  let mockChannel: ChannelInternals
  let state: ChannelState
  let mockGetState: jest.Mock<ChannelState, []>
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    state = {
      id: 'channel-123',
      name: 'test-channel',
      target: window,
      origin: 'https://example.com',
      active: true,
      connectTimestamp: Date.now(),
      contract: { accepted: [], emitted: [] },
      acceptedActions: [],
      queuedMessages: [],
      queueMessages: true,
      eventSubscriptions: [],
      messageSubscriptions: [],
      scheduledActivation: null,
      debug: false,
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
      actions: <ActionCreators>{},
    }
    ;(<jest.Mock>clearQueueModule.clearQueue).mockReturnValue({
      ...state,
      queuedMessages: [],
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('sends all queued messages', () => {
    const messages: IMessage[] = [
      { type: 'MESSAGE_1', data: { id: 1 } },
      { type: 'MESSAGE_2', data: { id: 2 } },
      { type: 'MESSAGE_3', data: { id: 3 } },
    ]
    state = { ...state, queuedMessages: messages }
    mockGetState.mockReturnValue(state)

    flush(mockChannel)

    expect(sendModule.send).toHaveBeenCalledTimes(3)
    expect(sendModule.send).toHaveBeenCalledWith(mockChannel, messages[0])
    expect(sendModule.send).toHaveBeenCalledWith(mockChannel, messages[1])
    expect(sendModule.send).toHaveBeenCalledWith(mockChannel, messages[2])
  })

  it('clears queue after sending', () => {
    const messages: IMessage[] = [{ type: 'MESSAGE_1', data: { id: 1 } }]
    state = { ...state, queuedMessages: messages }
    mockGetState.mockReturnValue(state)

    flush(mockChannel)

    expect(clearQueueModule.clearQueue).toHaveBeenCalledWith(state)
    expect(mockChannel.updateState).toHaveBeenCalledWith({
      ...state,
      queuedMessages: [],
    })
  })

  it('does nothing if queue is empty', () => {
    state = { ...state, queuedMessages: [] }
    mockGetState.mockReturnValue(state)

    flush(mockChannel)

    expect(sendModule.send).not.toHaveBeenCalled()
    expect(clearQueueModule.clearQueue).toHaveBeenCalled()
  })

  it('continue flushing even if one message fails', () => {
    const messages: IMessage[] = [
      { type: 'MESSAGE_1', data: { id: 1 } },
      { type: 'MESSAGE_2', data: { id: 2 } },
      { type: 'MESSAGE_3', data: { id: 3 } },
    ]
    state = { ...state, queuedMessages: messages }
    mockGetState.mockReturnValue(state)
    ;(<jest.Mock>sendModule.send).mockImplementation((channel, message) => {
      if (message.type === 'MESSAGE_2') {
        throw new Error('Send failed')
      }
    })

    flush(mockChannel)

    expect(sendModule.send).toHaveBeenCalledTimes(3)
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send queued message:', expect.any(Error))
    expect(clearQueueModule.clearQueue).toHaveBeenCalled()
  })
})
