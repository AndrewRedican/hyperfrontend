import type { IAction } from '../../types/action'
import type { ChannelState } from '../../types/channel'
import type { SecurityTransport } from '../../types/security'
import type { ChannelInternals } from '../types'
import { after as afterAll, afterEach, before as beforeAll, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { cancel } from './cancel'
import { startHandshakeTimers } from './handshake-timers'

describe('channel/lifecycle/cancel', () => {
  const contract = { accepted: [], emitted: [] }

  let mockChannel: ChannelInternals
  let state: ChannelState
  let sentActions: IAction[]
  let transport: SecurityTransport

  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  beforeEach(() => {
    sentActions = []
    transport = {
      send: jest.fn(),
      receive: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
      dispose: jest.fn(),
      getProtocol: jest.fn(() => 'v4'),
    }

    state = {
      ...createInitialStateWithTransport(),
      id: 'channel-123',
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

  function createInitialStateWithTransport(): ChannelState {
    return {
      ...createInitialState('test-channel', window, {}),
      negotiatedProtocol: 'v4',
      securityTransport: transport,
    }
  }

  it('sends CANCEL_CONNECTION through a new process when channel is closed and notify is true (default)', () => {
    cancel(mockChannel)

    expect(sentActions).toEqual([{ type: '[nexus] connection-request-cancelled', senderId: 'broker-id', processId: 'process-456' }])
  })

  it('sends CANCEL_CONNECTION when notify is explicitly true', () => {
    cancel(mockChannel, true)

    expect(sentActions).toEqual([expect.objectContaining({ type: '[nexus] connection-request-cancelled' })])
  })

  it('does not send an action when notify is false', () => {
    cancel(mockChannel, false)

    expect(sentActions).toEqual([])
  })

  it('creates no process when notify is false', () => {
    cancel(mockChannel, false)

    expect(mockChannel.createProcess).not.toHaveBeenCalled()
  })

  it('notifies event subscribers', () => {
    cancel(mockChannel)

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('cancel')
  })

  it('notifies event subscribers even when notify is false', () => {
    cancel(mockChannel, false)

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('cancel')
  })

  it('disposes the security transport of a pending request', () => {
    cancel(mockChannel)

    expect(transport.dispose).toHaveBeenCalledTimes(1)
  })

  it('forgets the transport and the negotiated protocol', () => {
    cancel(mockChannel)

    expect(state).toEqual(expect.objectContaining({ securityTransport: null, negotiatedProtocol: null }))
  })

  it('resets the pending handshake state', () => {
    state = {
      ...state,
      pendingProcessId: 'process-1',
      pendingAccept: ['sender-1', 'https://example.com', contract, 'process-1'],
      scheduledActivation: ['sender-2', 'https://example.com', contract, 'process-2'],
    }

    cancel(mockChannel)

    expect(state).toEqual(expect.objectContaining({ pendingProcessId: null, pendingAccept: null, scheduledActivation: null }))
  })

  it('clears running handshake timers', () => {
    const onDeadline = jest.fn()
    startHandshakeTimers(mockChannel, { type: '[nexus] connection-request', senderId: 'broker-id' }, onDeadline)

    cancel(mockChannel, false)
    jest.advanceTimersByTime(20_000)

    expect({ retried: sentActions, deadline: onDeadline.mock.calls.length }).toEqual({ retried: [], deadline: 0 })
  })

  it('tolerates a pending request without a transport', () => {
    state = { ...state, securityTransport: null }

    expect(() => cancel(mockChannel)).not.toThrow()
  })

  describe('on an active channel', () => {
    beforeEach(() => {
      state = { ...state, active: true, origin: 'https://example.com' }
    })

    it('proposes a polite close instead of cancelling', () => {
      cancel(mockChannel)

      expect(sentActions).toEqual([{ type: '[nexus] connection-closed', senderId: 'broker-id', processId: 'process-456' }])
    })

    it('stays active while the polite close awaits acknowledgement', () => {
      cancel(mockChannel)

      expect(state).toEqual(expect.objectContaining({ active: true, closingProcessId: 'process-456' }))
    })

    it('sends no CANCEL_CONNECTION', () => {
      cancel(mockChannel)

      expect(mockChannel.actions.cancelConnection).not.toHaveBeenCalled()
    })

    it('keeps the transport while the polite close awaits acknowledgement', () => {
      cancel(mockChannel)

      expect(transport.dispose).not.toHaveBeenCalled()
    })

    it('passes notify through to disconnect', () => {
      cancel(mockChannel, false)

      expect({ active: state.active, sent: sentActions }).toEqual({ active: false, sent: [] })
    })

    it('disposes the transport when cancelled silently', () => {
      cancel(mockChannel, false)

      expect(transport.dispose).toHaveBeenCalledTimes(1)
    })
  })
})
