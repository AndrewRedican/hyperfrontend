import type { IAction } from '../../types/action'
import type { ChannelState, ScheduledActivation } from '../../types/channel'
import type { ChannelInternals } from '../types'
import { createInitialState } from '../state/initial'
import { completeScheduledOpen } from './complete-open'
import { startHandshakeTimers } from './handshake-timers'

describe('channel/lifecycle/complete-open', () => {
  let state: ChannelState
  let sentActions: IAction[]
  let mockChannel: ChannelInternals

  const ownContract = { accepted: [{ type: 'PING' }], emitted: [{ type: 'PONG' }] }
  const peerContract = { accepted: [{ type: 'PONG' }], emitted: [{ type: 'PING' }] }
  const activation: ScheduledActivation = ['peer-1', 'https://example.com', peerContract, 'process-1']

  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  let targetWindow: { postMessage: jest.Mock }

  beforeEach(() => {
    sentActions = []
    targetWindow = { postMessage: jest.fn() }
    state = createInitialState('test-channel', targetWindow as unknown as Window, { contract: ownContract })
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
      actions: {
        requestConnection: jest.fn(),
        acceptConnection: jest.fn(),
        denyConnection: jest.fn(),
        cancelConnection: jest.fn(),
        openConnection: jest.fn(),
        closeConnection: jest.fn(),
        destroyConnection: jest.fn(),
        newMessage: jest.fn((message) => ({ type: '[nexus] new-message', senderId: 'broker-id', data: message })),
        invalidRequest: jest.fn(),
      },
    }
  })

  it('returns false and changes nothing when no accept is pending', () => {
    expect(completeScheduledOpen(mockChannel)).toBe(false)
    expect(state.active).toBe(false)
  })

  it('activates from the pending accept, keeping the own contract', () => {
    state = { ...state, pendingAccept: activation, peerContract, peerId: 'peer-1', origin: 'https://example.com' }

    const opened = completeScheduledOpen(mockChannel)

    expect({ opened, state }).toEqual({
      opened: true,
      state: expect.objectContaining({
        active: true,
        origin: 'https://example.com',
        contract: ownContract,
        peerContract,
        peerId: 'peer-1',
        pendingAccept: null,
      }),
    })
  })

  it('clears running handshake timers', () => {
    state = { ...state, pendingAccept: activation }
    const onDeadline = jest.fn()
    startHandshakeTimers(mockChannel, { type: '[nexus] connection-request-accepted', senderId: 'b', processId: 'process-1' }, onDeadline)

    completeScheduledOpen(mockChannel)
    jest.advanceTimersByTime(20_000)

    expect(onDeadline).not.toHaveBeenCalled()
  })

  it('flushes queued messages on activation', () => {
    state = { ...state, pendingAccept: activation, queuedMessages: [{ type: 'PONG', data: { seq: 1 } }] }

    completeScheduledOpen(mockChannel)

    expect(targetWindow.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: '[nexus] new-message' }), 'https://example.com')
    expect(state.queuedMessages).toHaveLength(0)
  })
})
