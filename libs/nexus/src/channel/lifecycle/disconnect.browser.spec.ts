import type { ChannelState } from '../../types'
import type { IAction } from '../../types/action'
import type { SecurityTransport } from '../../types/security'
import type { ChannelInternals } from '../types'
import { disconnect } from './disconnect'

type MutableChannelState = { -readonly [K in keyof ChannelState]: ChannelState[K] }

describe('channel/lifecycle/disconnect', () => {
  let mockChannel: ChannelInternals
  let state: MutableChannelState
  let sentActions: IAction[]

  beforeEach(() => {
    sentActions = []

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
      eventSubscriptions: [],
      messageSubscriptions: [],
      scheduledActivation: null,
      queueMessages: true,

      brokerManaged: false,
      readyToConnect: true,
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
      sendAction: (action) => {
        sentActions.push(action)
      },
      createProcess: jest.fn(() => 'process-456'),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: {
        requestConnection: jest.fn(),
        acceptConnection: jest.fn(),
        denyConnection: jest.fn(),
        cancelConnection: jest.fn(),
        openConnection: jest.fn(),
        closeConnection: jest.fn((processId) => ({
          type: '[nexus] connection-closed',
          senderId: 'broker-id',
          processId,
        })),
        destroyConnection: jest.fn(),
        newMessage: jest.fn(),
        invalidRequest: jest.fn(),
      },
    }
  })

  it('does nothing if channel is not active', () => {
    state.active = false

    disconnect(mockChannel)

    expect(sentActions).toHaveLength(0)
    expect(mockChannel.notifyEvent).not.toHaveBeenCalled()
  })

  it('sets channel to inactive', () => {
    disconnect(mockChannel)

    expect(state.active).toBe(false)
  })

  it('sends CLOSE_CONNECTION when notify is true (default)', () => {
    disconnect(mockChannel)

    expect(mockChannel.createProcess).toHaveBeenCalled()
    expect(mockChannel.actions.closeConnection).toHaveBeenCalledWith('process-456')
    expect(sentActions).toHaveLength(1)
    expect(sentActions[0].type).toBe('[nexus] connection-closed')
  })

  it('sends CLOSE_CONNECTION when notify is explicitly true', () => {
    disconnect(mockChannel, true)

    expect(sentActions).toHaveLength(1)
    expect(sentActions[0].type).toBe('[nexus] connection-closed')
  })

  it('does not send action when notify is false', () => {
    disconnect(mockChannel, false)

    expect(mockChannel.createProcess).not.toHaveBeenCalled()
    expect(mockChannel.actions.closeConnection).not.toHaveBeenCalled()
    expect(sentActions).toHaveLength(0)
  })

  it('notifys event subscribers', () => {
    disconnect(mockChannel)

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close')
  })

  it('notifys event subscribers even when notify is false', () => {
    disconnect(mockChannel, false)

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close')
  })

  it('clears the security state so a later handshake renegotiates from scratch', () => {
    state.negotiatedProtocol = 'v2'
    state.securityReady = true
    state.securityTransport = <SecurityTransport>(<unknown>{ send: jest.fn(), isReady: () => true })
    state.pendingSecurityRequest = { supported: ['v2', 'none'], preferred: 'v2' }

    disconnect(mockChannel)

    expect(state).toEqual(
      expect.objectContaining({
        negotiatedProtocol: null,
        securityReady: false,
        securityTransport: null,
        pendingSecurityRequest: null,
      })
    )
  })
})
