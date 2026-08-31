import type { IAction } from '../../types/action'
import type { ChannelState, ScheduledActivation } from '../../types/channel'
import type { ChannelInternals } from '../types'
import { createInitialState } from '../state/initial'
import { beginResponse } from './begin-response'

describe('channel/lifecycle/begin-response', () => {
  let state: ChannelState
  let sentActions: IAction[]
  let mockChannel: ChannelInternals

  const contract = { accepted: [{ type: 'msg1' }], emitted: [] }
  const activation: ScheduledActivation = ['sender-1', 'https://example.com', contract, 'process-1']
  const acceptAction: IAction = { type: '[nexus] connection-request-accepted', senderId: 'broker-id', processId: 'process-1' }

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

  it('pins the origin and records the peer details and pending accept', () => {
    beginResponse(mockChannel, activation, acceptAction)

    expect(state).toEqual(
      expect.objectContaining({
        origin: 'https://example.com',
        peerId: 'sender-1',
        peerContract: contract,
        pendingAccept: activation,
        scheduledActivation: null,
        active: false,
      })
    )
  })

  it('sends the accept action immediately', () => {
    beginResponse(mockChannel, activation, acceptAction)

    expect(sentActions).toEqual([acceptAction])
  })

  it('re-sends the accept action until the deadline expires', () => {
    beginResponse(mockChannel, activation, acceptAction)

    jest.advanceTimersByTime(1000)

    expect(sentActions).toEqual([acceptAction, acceptAction, acceptAction])
  })

  it('fires timeout and removes the process when the deadline expires', () => {
    beginResponse(mockChannel, activation, acceptAction)

    jest.advanceTimersByTime(state.connectTimeoutMs)

    expect(mockChannel.removeProcess).toHaveBeenCalledWith('process-1')
    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('connect-timeout', { elapsedMs: state.connectTimeoutMs })
  })
})
