import type { ChannelState } from '../../types'
import type { IAction } from '../../types/action'
import type { ChannelInternals } from '../types'
import { sendAction } from './send-action'

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

  describe('with security transport', () => {
    let mockSecurityTransport: {
      isReady: jest.Mock
      send: jest.Mock
      onReceive: jest.Mock
      stop: jest.Mock
      resume: jest.Mock
      getProtocol: jest.Mock
    }

    beforeEach(() => {
      mockSecurityTransport = {
        isReady: jest.fn(() => true),
        send: jest.fn(),
        onReceive: jest.fn(),
        stop: jest.fn(),
        resume: jest.fn(),
        getProtocol: jest.fn(() => 'v2'),
      }
      state = {
        ...state,
        securityTransport: mockSecurityTransport,
      }
      mockGetState.mockReturnValue(state)
    })

    it('sends non-handshake action through security transport when ready', () => {
      const action: IAction = {
        type: '[nexus] new-message',
        senderId: 'broker-id',
        data: { test: 'data' },
      }

      sendAction(mockChannel, action)

      expect(mockSecurityTransport.send).toHaveBeenCalledWith(action)
      expect(mockWindow.postMessage).not.toHaveBeenCalled()
    })

    it('sends handshake actions via plaintext postMessage', () => {
      const action: IAction = {
        type: '[nexus] connection-request',
        senderId: 'broker-id',
        processId: 'process-123',
        contract: { accepted: [], emitted: [] },
      }

      sendAction(mockChannel, action)

      expect(mockWindow.postMessage).toHaveBeenCalledWith(action, '*')
      expect(mockSecurityTransport.send).not.toHaveBeenCalled()
    })

    it('sends via postMessage when security transport is not ready', () => {
      mockSecurityTransport.isReady.mockReturnValue(false)

      const action: IAction = {
        type: '[nexus] new-message',
        senderId: 'broker-id',
        data: { test: 'data' },
      }

      sendAction(mockChannel, action)

      expect(mockWindow.postMessage).toHaveBeenCalledWith(action, '*')
      expect(mockSecurityTransport.send).not.toHaveBeenCalled()
    })
  })
})
