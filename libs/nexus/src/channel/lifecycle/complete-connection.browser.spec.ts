import type { ChannelState } from '../../types'
import type { IAction } from '../../types/action'
import type { ChannelInternals } from '../types'
import { createInitialState } from '../state/initial'
import { completeConnection } from './complete-connection'
import { startHandshakeTimers } from './handshake-timers'

describe('channel/lifecycle/complete-connection', () => {
  let state: ChannelState
  let sentActions: IAction[]
  let mockChannel: ChannelInternals

  const ownContract = { accepted: [{ type: 'PONG' }], emitted: [{ type: 'PING' }] }
  const peerContract = { accepted: [{ type: 'PING' }], emitted: [{ type: 'PONG' }] }
  const openAction: IAction = { type: '[nexus] connection-opened', senderId: 'broker-id', processId: 'process-1' }

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

  it('activates the channel with the peer details, keeping the own contract', () => {
    completeConnection(mockChannel, 'https://example.com', peerContract, 'peer-1', openAction)

    expect(state).toEqual(
      expect.objectContaining({
        active: true,
        origin: 'https://example.com',
        contract: ownContract,
        peerContract,
        peerId: 'peer-1',
        pendingProcessId: null,
      })
    )
  })

  it('sends the reply action', () => {
    completeConnection(mockChannel, 'https://example.com', peerContract, 'peer-1', openAction)

    expect(sentActions).toEqual([openAction])
  })

  it('clears running handshake timers', () => {
    const onDeadline = jest.fn()
    startHandshakeTimers(mockChannel, openAction, onDeadline)

    completeConnection(mockChannel, 'https://example.com', peerContract, 'peer-1', openAction)
    jest.advanceTimersByTime(20_000)

    expect(onDeadline).not.toHaveBeenCalled()
  })

  it('flushes queued messages after activation', () => {
    state = { ...state, queuedMessages: [{ type: 'PING', data: { seq: 1 } }] }

    completeConnection(mockChannel, 'https://example.com', peerContract, 'peer-1', openAction)

    expect(targetWindow.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: '[nexus] new-message' }), 'https://example.com')
    expect(state.queuedMessages).toHaveLength(0)
  })
})
