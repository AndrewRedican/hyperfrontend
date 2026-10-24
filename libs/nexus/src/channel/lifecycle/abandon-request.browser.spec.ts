import type { Mock } from '@hyperfrontend/testing'
import type { ChannelState } from '../../types/channel'
import type { ChannelInternals } from '../types'
import { after as afterAll, afterEach, before as beforeAll, beforeEach } from 'node:test'
import { createMock, describe, expect, it, jest } from '@hyperfrontend/testing'
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
      actions: createMock<ChannelInternals['actions']>(),
    }
  })

  it('removes the pending process', () => {
    state = { ...state, pendingProcessId: 'process-1' }

    abandonRequest(mockChannel)

    expect(mockChannel.removeProcess).toHaveBeenCalledWith('process-1')
  })

  it('clears the pending process id', () => {
    state = { ...state, pendingProcessId: 'process-1' }

    abandonRequest(mockChannel)

    expect(state.pendingProcessId).toBeNull()
  })

  it('stops the handshake timers', () => {
    state = { ...state, pendingProcessId: 'process-1' }
    const onDeadline = jest.fn()
    startHandshakeTimers(mockChannel, { type: '[nexus] connection-request', senderId: 'b', processId: 'process-1' }, onDeadline)

    abandonRequest(mockChannel)
    jest.advanceTimersByTime(20_000)

    expect({ deadlines: onDeadline.mock.calls, resends: (mockChannel.sendAction as Mock).mock.calls }).toEqual({
      deadlines: [],
      resends: [],
    })
  })

  it('does nothing when no request is pending', () => {
    abandonRequest(mockChannel)

    expect(mockChannel.removeProcess).not.toHaveBeenCalled()
  })
})
