import type { ChannelState } from '../../types'
import type { ChannelInternals } from '../types'
import { after as afterAll, afterEach, before as beforeAll, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { abandonRequest } from './abandon-request'
import { startHandshakeTimers } from './handshake-timers'

describe('channel/lifecycle/abandon-request', () => {
  let state: ChannelState
  let mockChannel: ChannelInternals

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
    state = createInitialState('test-channel', window, {})
    mockChannel = {
      getState: () => state,
      updateState: (partial) => {
        state = { ...state, ...partial }
      },
      sendAction: jest.fn(),
      createProcess: jest.fn(),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: {} as unknown as ChannelInternals['actions'],
    }
  })

  it('removes the pending process and clears the pending process id', () => {
    state = { ...state, pendingProcessId: 'process-1' }

    abandonRequest(mockChannel)

    expect(mockChannel.removeProcess).toHaveBeenCalledWith('process-1')
    expect(state.pendingProcessId).toBeNull()
  })

  it('stops the handshake timers', () => {
    state = { ...state, pendingProcessId: 'process-1' }
    const onDeadline = jest.fn()
    startHandshakeTimers(mockChannel, { type: '[nexus] connection-request', senderId: 'b', processId: 'process-1' }, onDeadline)

    abandonRequest(mockChannel)
    jest.advanceTimersByTime(20_000)

    expect(onDeadline).not.toHaveBeenCalled()
    expect(mockChannel.sendAction).not.toHaveBeenCalled()
  })

  it('does nothing when no request is pending', () => {
    abandonRequest(mockChannel)

    expect(mockChannel.removeProcess).not.toHaveBeenCalled()
  })
})
