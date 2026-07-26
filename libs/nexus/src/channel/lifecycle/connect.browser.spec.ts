import type { ChannelState } from '../../types'
import type { IAction } from '../../types/action'
import type { ChannelInternals } from '../types'
import { connect } from './connect'

type MutableChannelState = { -readonly [K in keyof ChannelState]: ChannelState[K] }

describe('channel/lifecycle/connect', () => {
  let mockChannel: ChannelInternals
  let state: MutableChannelState
  let sentActions: IAction[]

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
      peerContract: null,
      peerId: null,
      pendingProcessId: null,
      pendingAccept: null,
      retryTimer: null,
      deadlineTimer: null,
      connectTimeoutMs: 10_000,
      requestRetryMs: 500,
      queueMessages: true,

      brokerManaged: false,
      readyToConnect: false,
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

  it('does nothing if a connection request is already outstanding', () => {
    state.pendingProcessId = 'process-outstanding'

    connect(mockChannel)

    expect(sentActions).toHaveLength(0)
    expect(mockChannel.createProcess).not.toHaveBeenCalled()
  })

  it('does nothing if an accept is already pending', () => {
    state.pendingAccept = ['sender-789', 'https://example.com', { accepted: [], emitted: [] }, 'process-999']

    connect(mockChannel)

    expect(sentActions).toHaveLength(0)
    expect(mockChannel.createProcess).not.toHaveBeenCalled()
  })

  it('sets connectTimestamp if not already set', () => {
    connect(mockChannel)

    expect(state.connectTimestamp).toBeGreaterThan(0)
  })

  it('does not overwrite existing connectTimestamp', () => {
    const existingTimestamp = 1234567890
    state.connectTimestamp = existingTimestamp

    connect(mockChannel)

    expect(state.connectTimestamp).toBe(existingTimestamp)
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

  describe('initiator path', () => {
    it('sends REQUEST_CONNECTION and records the pending process', () => {
      connect(mockChannel)

      expect(mockChannel.createProcess).toHaveBeenCalled()
      expect(mockChannel.actions.requestConnection).toHaveBeenCalledWith('process-456')
      expect(sentActions).toEqual([expect.objectContaining({ type: '[nexus] connection-request' })])
      expect(state.pendingProcessId).toBe('process-456')
    })

    it('re-sends REQUEST_CONNECTION at the retry cadence', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(1500)

      expect(sentActions.map((a) => a.type)).toEqual([
        '[nexus] connection-request',
        '[nexus] connection-request',
        '[nexus] connection-request',
        '[nexus] connection-request',
      ])
    })

    it('fires timeout and removes the process when the deadline expires', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(10_000)

      expect(mockChannel.removeProcess).toHaveBeenCalledWith('process-456')
      expect(mockChannel.notifyEvent).toHaveBeenCalledWith('connect-timeout', { elapsedMs: 10_000 })
    })

    it('stays inactive and reconnectable after the deadline expires', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(10_000)

      expect(state).toEqual(
        expect.objectContaining({
          active: false,
          pendingProcessId: null,
          retryTimer: null,
          deadlineTimer: null,
        })
      )
    })

    it('stops retrying after the deadline expires', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(10_000)
      const sentAtDeadline = sentActions.length
      jest.advanceTimersByTime(5000)

      expect(sentActions).toHaveLength(sentAtDeadline)
    })

    it('honors custom retry and deadline settings', () => {
      state.requestRetryMs = 100
      state.connectTimeoutMs = 250

      connect(mockChannel)

      jest.advanceTimersByTime(250)

      expect(sentActions).toHaveLength(3)
      expect(mockChannel.notifyEvent).toHaveBeenCalledWith('connect-timeout', { elapsedMs: 250 })
    })
  })

  describe('responder path (scheduled activation)', () => {
    const contract = {
      accepted: [{ type: 'msg1' }, { type: 'msg2' }],
      emitted: [],
    }

    beforeEach(() => {
      state.scheduledActivation = ['sender-789', 'https://example.com', contract, 'process-999']
    })

    it('answers with ACCEPT and waits for OPEN instead of activating', () => {
      connect(mockChannel)

      expect(mockChannel.actions.acceptConnection).toHaveBeenCalledWith('process-999')
      expect(sentActions).toEqual([expect.objectContaining({ type: '[nexus] connection-request-accepted' })])
      expect(state.active).toBe(false)
    })

    it('records the pending accept and the peer details', () => {
      connect(mockChannel)

      expect(state).toEqual(
        expect.objectContaining({
          origin: 'https://example.com',
          peerId: 'sender-789',
          peerContract: contract,
          pendingAccept: ['sender-789', 'https://example.com', contract, 'process-999'],
          scheduledActivation: null,
        })
      )
    })

    it('keeps the local channel id instead of adopting the remote id', () => {
      connect(mockChannel)

      expect(state.id).toBe('channel-123')
    })

    it('re-sends ACCEPT at the retry cadence until OPEN arrives', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(1000)

      expect(sentActions.map((a) => a.type)).toEqual([
        '[nexus] connection-request-accepted',
        '[nexus] connection-request-accepted',
        '[nexus] connection-request-accepted',
      ])
    })

    it('fires timeout when OPEN never arrives within the deadline', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(10_000)

      expect(mockChannel.notifyEvent).toHaveBeenCalledWith('connect-timeout', { elapsedMs: 10_000 })
      expect(state.pendingAccept).toBeNull()
    })

    it('does not create a new process when answering a scheduled activation', () => {
      connect(mockChannel)

      expect(mockChannel.createProcess).not.toHaveBeenCalled()
    })
  })
})
