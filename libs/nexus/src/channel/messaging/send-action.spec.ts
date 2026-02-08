/**
 * Tests for send-action messaging operation
 */

import { sendAction } from './send-action'
import type { ChannelInternals } from '../types'
import type { ChannelState } from '../../types'
import type { IAction } from '../../types/action'

describe('channel/messaging/send-action', () => {
  let mockChannel: ChannelInternals
  let state: ChannelState
  let mockWindow: { postMessage: jest.Mock }
  let mockGetState: jest.Mock<ChannelState, []>

  beforeEach(() => {
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
      contract: { accepted: [], emitted: [] },
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
      actions: {
        requestConnection: jest.fn(),
        acceptConnection: jest.fn(),
        denyConnection: jest.fn(),
        cancelConnection: jest.fn(),
        openConnection: jest.fn(),
        closeConnection: jest.fn(),
        destroyConnection: jest.fn(),
        newMessage: jest.fn(),
        invalidRequest: jest.fn(),
      },
    }
  })

  it('sends action via postMessage', () => {
    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'broker-id',
      processId: 'process-123',
      contract: { accepted: [], emitted: [] },
    }

    sendAction(mockChannel, action)

    expect(mockWindow.postMessage).toHaveBeenCalledWith(action, '*')
  })

  it('throws error if action is null', () => {
    expect(() => sendAction(mockChannel, <IAction>(<unknown>null))).toThrow(
      "Action must contain a 'type' property that is a non-empty string."
    )
  })

  it('throws error if action is undefined', () => {
    expect(() => sendAction(mockChannel, <IAction>(<unknown>undefined))).toThrow(
      "Action must contain a 'type' property that is a non-empty string."
    )
  })

  it('throws error if action has no type', () => {
    const action = <IAction>{}

    expect(() => sendAction(mockChannel, action)).toThrow("Action must contain a 'type' property that is a non-empty string.")
  })

  it('throws error if action type is not a string', () => {
    const action = <IAction>(<unknown>{ type: 123 })

    expect(() => sendAction(mockChannel, action)).toThrow("Action must contain a 'type' property that is a non-empty string.")
  })

  it('sends action even if channel is closed', () => {
    state = { ...state, active: false }
    mockGetState.mockReturnValue(state)

    const action: IAction = {
      type: '[nexus] connection-request',
      senderId: 'broker-id',
      processId: 'process-123',
      contract: { accepted: [], emitted: [] },
    }

    sendAction(mockChannel, action)

    expect(mockWindow.postMessage).toHaveBeenCalledWith(action, '*')
  })
})
