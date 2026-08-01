import type { ChannelState } from '../../types'
import type { IAction } from '../../types/action'
import type { SecurityTransport } from '../../types/security'
import type { ChannelInternals } from '../types'
import { disconnect, finalizeClose } from './disconnect'

type MutableChannelState = { -readonly [K in keyof ChannelState]: ChannelState[K] }

describe('channel/lifecycle/disconnect', () => {
  let mockChannel: ChannelInternals
  let state: MutableChannelState
  let sentActions: IAction[]

  beforeEach(() => {
    jest.useFakeTimers()
    sentActions = []

    state = {
      id: 'channel-123',
      name: 'test-channel',
      target: window,
      origin: 'https://example.com',
      active: true,
      connectTimestamp: Date.now(),
      contract: { accepted: [], emitted: [] },
      acceptedActions: [],
      queuedMessages: [],
      eventSubscriptions: [],
      messageSubscriptions: [],
      scheduledActivation: null,
      queueMessages: true,

      brokerManaged: false,
      readyToConnect: true,
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
        cancelConnection: jest.fn(),
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

  afterEach(() => {
    jest.useRealTimers()
  })

  it('does nothing if channel is not active', () => {
    state.active = false

    disconnect(mockChannel)

    expect(sentActions).toHaveLength(0)
    expect(mockChannel.notifyEvent).not.toHaveBeenCalled()
  })

  it('keeps the channel active while the polite close awaits acknowledgement', () => {
    disconnect(mockChannel)

    expect(state.active).toBe(true)
    expect(state.closingProcessId).toBe('process-456')
    expect(state.closeTimer).not.toBeNull()
  })

  it('sends CLOSE_CONNECTION when notify is true (default)', () => {
    disconnect(mockChannel)

    expect(mockChannel.createProcess).toHaveBeenCalled()
    expect(mockChannel.actions.closeConnection).toHaveBeenCalledWith('process-456')
    expect(sentActions).toHaveLength(1)
    expect(sentActions[0].type).toBe('[nexus] connection-closed')
  })

  it('fires closing (not close) when the polite close is proposed', () => {
    disconnect(mockChannel)

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('closing', { initiatedLocally: true })
    expect(mockChannel.notifyEvent).not.toHaveBeenCalledWith('close', expect.anything())
  })

  it('does not send a second CLOSE_CONNECTION while one is in flight', () => {
    disconnect(mockChannel)
    disconnect(mockChannel)

    expect(sentActions).toHaveLength(1)
    expect(mockChannel.notifyEvent).toHaveBeenCalledTimes(1)
  })

  it('completes the close once acknowledged, firing a single close event', () => {
    disconnect(mockChannel)

    disconnect(mockChannel, false)

    expect(state.active).toBe(false)
    expect(state.closingProcessId).toBeNull()
    expect(state.closeTimer).toBeNull()
    expect(mockChannel.removeProcess).toHaveBeenCalledWith('process-456')
    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close', { notify: true })
    const closeCalls = (<jest.Mock>mockChannel.notifyEvent).mock.calls.filter(([event]) => event === 'close')
    expect(closeCalls).toHaveLength(1)
  })

  it('completes the close when the acknowledgement deadline expires', () => {
    disconnect(mockChannel)

    jest.advanceTimersByTime(2000)

    expect(state.active).toBe(false)
    expect(state.closingProcessId).toBeNull()
    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close', { notify: true })
  })

  it('does not send action when notify is false', () => {
    disconnect(mockChannel, false)

    expect(mockChannel.createProcess).not.toHaveBeenCalled()
    expect(mockChannel.actions.closeConnection).not.toHaveBeenCalled()
    expect(sentActions).toHaveLength(0)
  })

  it('closes immediately with a close event when notify is false', () => {
    disconnect(mockChannel, false)

    expect(state.active).toBe(false)
    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close', { notify: false })
    expect(mockChannel.notifyEvent).not.toHaveBeenCalledWith('closing', expect.anything())
  })

  it('clears the security state so a later handshake renegotiates from scratch', () => {
    state.negotiatedProtocol = 'v2'
    state.securityReady = true
    state.securityTransport = <SecurityTransport>(<unknown>{ send: jest.fn(), isReady: () => true })
    state.pendingSecurityRequest = { supported: ['v2', 'none'], preferred: 'v2' }

    disconnect(mockChannel, false)

    expect(state).toEqual(
      expect.objectContaining({
        negotiatedProtocol: null,
        securityReady: false,
        securityTransport: null,
        pendingSecurityRequest: null,
      })
    )
  })

  it('keeps the negotiated security state until the polite close completes', () => {
    state.negotiatedProtocol = 'v2'

    disconnect(mockChannel)

    expect(state.negotiatedProtocol).toBe('v2')

    jest.advanceTimersByTime(2000)

    expect(state.negotiatedProtocol).toBeNull()
  })

  it('carries the reason on the close event when neither side asked for it', () => {
    disconnect(mockChannel, false, 'peer-reload')

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close', { notify: false, reason: 'peer-reload' })
  })

  it('carries the reason when a silent close completes a polite one already in flight', () => {
    state.closingProcessId = 'process-456'

    disconnect(mockChannel, false, 'peer-reload')

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close', { notify: true, reason: 'peer-reload' })
  })

  describe('finalizeClose', () => {
    it('does nothing when the channel is already inactive', () => {
      state.active = false

      finalizeClose(mockChannel)

      expect(mockChannel.notifyEvent).not.toHaveBeenCalled()
    })

    it('reports notify false when this side never sent CLOSE', () => {
      finalizeClose(mockChannel)

      expect(state.active).toBe(false)
      expect(mockChannel.removeProcess).not.toHaveBeenCalled()
      expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close', { notify: false })
    })
  })
})
