/**
 * Tests for connect lifecycle operation
 */

import { connect } from './connect'
import type { ChannelInternals } from '../types'
import type { ChannelState } from '../../types'
import type { IAction } from '../../types/action'

// Mutable version of ChannelState for testing
type MutableChannelState = { -readonly [K in keyof ChannelState]: ChannelState[K] }

describe('channel/lifecycle/connect', () => {
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
      debug: false,
      brokerManaged: false,
      readyToConnect: false,
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
        requestConnection: jest.fn((processId) => ({
          type: '[nexus] connection-request',
          senderId: 'broker-id',
          processId,
          contract: { accepted: [], emitted: [] },
        })),
        acceptConnection: jest.fn((processId) => ({
          type: '[nexus] connection-request-accepted',
          senderId: 'broker-id',
          processId,
          contract: { accepted: [], emitted: [] },
        })),
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

  it('does nothing if channel is already active', () => {
    state.active = true

    connect(mockChannel)

    expect(sentActions).toHaveLength(0)
    expect(mockChannel.createProcess).not.toHaveBeenCalled()
  })

  it('sets connectTimestamp if not already set', () => {
    const beforeTimestamp = Date.now()

    connect(mockChannel)

    const afterTimestamp = Date.now()
    expect(state.connectTimestamp).toBeGreaterThanOrEqual(beforeTimestamp)
    expect(state.connectTimestamp).toBeLessThanOrEqual(afterTimestamp)
  })

  it('does not overwrite existing connectTimestamp', () => {
    const existingTimestamp = 1234567890
    state.connectTimestamp = existingTimestamp

    connect(mockChannel)

    expect(state.connectTimestamp).toBe(existingTimestamp)
  })

  it('sends REQUEST_CONNECTION when no scheduled activation', () => {
    connect(mockChannel)

    expect(mockChannel.createProcess).toHaveBeenCalled()
    expect(mockChannel.actions.requestConnection).toHaveBeenCalledWith('process-456')
    expect(sentActions).toHaveLength(1)
    expect(sentActions[0].type).toBe('[nexus] connection-request')
  })

  it('acceptss scheduled activation when present', () => {
    const contract = {
      accepted: [{ type: 'msg1' }, { type: 'msg2' }],
      emitted: [],
    }

    state.scheduledActivation = ['sender-789', 'https://example.com', contract, 'process-999']

    connect(mockChannel)

    // Should activate channel
    expect(state.id).toBe('sender-789')
    expect(state.origin).toBe('https://example.com')
    expect(state.contract).toBe(contract)
    expect(state.acceptedActions).toEqual(['msg1', 'msg2'])
    expect(state.active).toBe(true)
    expect(state.scheduledActivation).toBe(null)

    // Should send ACCEPT_CONNECTION
    expect(mockChannel.actions.acceptConnection).toHaveBeenCalledWith('process-999')
    expect(sentActions).toHaveLength(1)
    expect(sentActions[0].type).toBe('[nexus] connection-request-accepted')

    // Should notify event subscribers
    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('open', {
      id: 'sender-789',
      origin: 'https://example.com',
    })
  })

  it('clears scheduled activation after accepting', () => {
    const contract = {
      accepted: [{ type: 'msg1' }],
      emitted: [],
    }

    state.scheduledActivation = ['sender-789', 'https://example.com', contract, 'process-999']

    connect(mockChannel)

    expect(state.scheduledActivation).toBe(null)
  })

  it('does not create new process when accepting scheduled activation', () => {
    const contract = {
      accepted: [],
      emitted: [],
    }

    state.scheduledActivation = ['sender-789', 'https://example.com', contract, 'process-999']

    connect(mockChannel)

    expect(mockChannel.createProcess).not.toHaveBeenCalled()
  })

  it('sets readyToConnect to true when not already set', () => {
    expect(state.readyToConnect).toBe(false)

    connect(mockChannel)

    expect(state.readyToConnect).toBe(true)
  })

  it('does not reset readyToConnect if already true', () => {
    state.readyToConnect = true

    connect(mockChannel)

    expect(state.readyToConnect).toBe(true)
  })
})
