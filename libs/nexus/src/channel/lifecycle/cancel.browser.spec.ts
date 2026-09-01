import type { ChannelState } from '../../types'
import type { IAction } from '../../types/action'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { cancel } from './cancel'

type MutableChannelState = { -readonly [K in keyof ChannelState]: ChannelState[K] }

describe('channel/lifecycle/cancel', () => {
  let mockChannel: ChannelInternals
  let state: MutableChannelState
  let sentActions: IAction[]

  beforeEach(() => {
    sentActions = []

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
      eventSubscriptions: [],
      messageSubscriptions: [],
      scheduledActivation: null,
      queueMessages: true,

      brokerManaged: false,
      readyToConnect: false,
      negotiatedProtocol: null,
      securityReady: false,
      securityTransport: null,
      pendingSecurityRequest: null,
      closingProcessId: null,
      closeTimer: null,
      closeTimeoutMs: 2000,
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
        cancelConnection: jest.fn((processId) => ({
          type: '[nexus] connection-request-cancelled',
          senderId: 'broker-id',
          processId,
        })),
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

  it('sends CANCEL_CONNECTION when channel is closed and notify is true (default)', () => {
    cancel(mockChannel)

    expect(mockChannel.createProcess).toHaveBeenCalled()
    expect(mockChannel.actions.cancelConnection).toHaveBeenCalledWith('process-456')
    expect(sentActions).toHaveLength(1)
    expect(sentActions[0].type).toBe('[nexus] connection-request-cancelled')
  })

  it('sends CANCEL_CONNECTION when notify is explicitly true', () => {
    cancel(mockChannel, true)

    expect(sentActions).toHaveLength(1)
    expect(sentActions[0].type).toBe('[nexus] connection-request-cancelled')
  })

  it('does not send action when notify is false', () => {
    cancel(mockChannel, false)

    expect(mockChannel.createProcess).not.toHaveBeenCalled()
    expect(mockChannel.actions.cancelConnection).not.toHaveBeenCalled()
    expect(sentActions).toHaveLength(0)
  })

  it('notifys event subscribers', () => {
    cancel(mockChannel)

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('cancel')
  })

  it('notifys event subscribers even when notify is false', () => {
    cancel(mockChannel, false)

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('cancel')
  })

  it('calls disconnect when channel is active', () => {
    state.active = true

    cancel(mockChannel)

    // note: A polite close stays active until the counterpart acknowledges (or the deadline expires).
    expect(state.active).toBe(true)
    expect(state.closingProcessId).toBe('process-456')
    expect(mockChannel.actions.closeConnection).toHaveBeenCalled()
    expect(mockChannel.actions.cancelConnection).not.toHaveBeenCalled()
    expect(sentActions).toHaveLength(1)
    expect(sentActions[0].type).toBe('[nexus] connection-closed')
  })

  it('passs notify parameter to disconnect when channel is active', () => {
    state.active = true

    cancel(mockChannel, false)

    expect(state.active).toBe(false)
    expect(mockChannel.actions.closeConnection).not.toHaveBeenCalled()
    expect(sentActions).toHaveLength(0)
  })
})
