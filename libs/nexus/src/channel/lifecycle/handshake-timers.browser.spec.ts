import type { ChannelState } from '../../types'
import type { IAction } from '../../types/action'
import type { ChannelInternals } from '../types'
import { after as afterAll, afterEach, before as beforeAll, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { clearHandshakeTimers, expireHandshake, startHandshakeTimers } from './handshake-timers'

describe('channel/lifecycle/handshake-timers', () => {
  let state: ChannelState
  let sentActions: IAction[]
  let mockChannel: ChannelInternals

  const replayAction: IAction = { type: '[nexus] connection-request', senderId: 'broker-id', processId: 'process-1' }

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
    state = createInitialState('test-channel', window, {})
    mockChannel = {
      getState: () => state,
      updateState: (partial) => {
        state = { ...state, ...partial }
      },
      sendAction: (action) => {
        sentActions.push(action)
      },
      createProcess: jest.fn(),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: {} as unknown as ChannelInternals['actions'],
    }
  })

  describe('startHandshakeTimers', () => {
    it('re-sends the replay action at the retry cadence', () => {
      startHandshakeTimers(mockChannel, replayAction, jest.fn())

      jest.advanceTimersByTime(1500)

      expect(sentActions).toEqual([replayAction, replayAction, replayAction])
    })

    it('invokes the deadline callback once after connectTimeoutMs', () => {
      const onDeadline = jest.fn(() => clearHandshakeTimers(mockChannel))

      startHandshakeTimers(mockChannel, replayAction, onDeadline)

      jest.advanceTimersByTime(20_000)

      expect(onDeadline).toHaveBeenCalledTimes(1)
    })

    it('replaces previously running timers', () => {
      const firstDeadline = jest.fn()
      startHandshakeTimers(mockChannel, replayAction, firstDeadline)
      startHandshakeTimers(mockChannel, replayAction, jest.fn())

      jest.advanceTimersByTime(500)

      expect(sentActions).toHaveLength(1)
      expect(firstDeadline).not.toHaveBeenCalled()
    })
  })

  describe('clearHandshakeTimers', () => {
    it('stops the retry and deadline timers', () => {
      const onDeadline = jest.fn()
      startHandshakeTimers(mockChannel, replayAction, onDeadline)

      clearHandshakeTimers(mockChannel)
      jest.advanceTimersByTime(20_000)

      expect(sentActions).toHaveLength(0)
      expect(onDeadline).not.toHaveBeenCalled()
    })

    it('nulls the timer handles in state', () => {
      startHandshakeTimers(mockChannel, replayAction, jest.fn())

      clearHandshakeTimers(mockChannel)

      expect(state).toEqual(expect.objectContaining({ retryTimer: null, deadlineTimer: null }))
    })

    it('does nothing when no timers are running', () => {
      const updateState = jest.spyOn(mockChannel, 'updateState')

      clearHandshakeTimers(mockChannel)

      expect(updateState).not.toHaveBeenCalled()
    })

    it('clears a lone deadline timer when the retry timer is already gone', () => {
      startHandshakeTimers(mockChannel, replayAction, jest.fn())
      state = { ...state, retryTimer: null }

      clearHandshakeTimers(mockChannel)

      expect(state.deadlineTimer).toBeNull()
    })
  })

  describe('expireHandshake', () => {
    it('removes the process and fires timeout with the elapsed deadline', () => {
      startHandshakeTimers(mockChannel, replayAction, jest.fn())

      expireHandshake(mockChannel, 'process-1')

      expect(mockChannel.removeProcess).toHaveBeenCalledWith('process-1')
      expect(mockChannel.notifyEvent).toHaveBeenCalledWith('connect-timeout', { elapsedMs: state.connectTimeoutMs })
    })

    it('clears all pending handshake state', () => {
      state = { ...state, pendingProcessId: 'process-1', pendingAccept: ['s', 'o', { accepted: [], emitted: [] }, 'p'] }
      startHandshakeTimers(mockChannel, replayAction, jest.fn())

      expireHandshake(mockChannel, 'process-1')

      expect(state).toEqual(expect.objectContaining({ pendingProcessId: null, pendingAccept: null, retryTimer: null, deadlineTimer: null }))
    })
  })
})
