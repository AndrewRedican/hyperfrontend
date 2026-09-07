import type { Mock } from '@hyperfrontend/testing'
import type { IAction } from '../../types/action'
import type { ChannelState } from '../../types/channel'
import type { SecurityTransport } from '../../types/security'
import type { ChannelInternals } from '../types'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { disconnect, finalizeClose } from './disconnect'

describe('channel/lifecycle/disconnect', () => {
  let mockChannel: ChannelInternals
  let state: ChannelState
  let sentActions: IAction[]
  let transport: SecurityTransport

  const closeEvents = (): unknown[][] => (mockChannel.notifyEvent as Mock).mock.calls.filter(([event]) => event === 'close')

  beforeEach(() => {
    jest.useFakeTimers()
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
      ...createInitialState('test-channel', window, { contract: { accepted: [], emitted: [] } }),
      origin: 'https://example.com',
      active: true,
      readyToConnect: true,
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
    state = { ...state, active: false }

    disconnect(mockChannel)

    expect({ sent: sentActions, events: (mockChannel.notifyEvent as Mock).mock.calls }).toEqual({ sent: [], events: [] })
  })

  it('keeps the channel active while the polite close awaits acknowledgement', () => {
    disconnect(mockChannel)

    expect(state).toEqual(expect.objectContaining({ active: true, closingProcessId: 'process-456', closeTimer: expect.anything() }))
  })

  it('sends CLOSE_CONNECTION through a new process when notify is true (default)', () => {
    disconnect(mockChannel)

    expect(sentActions).toEqual([{ type: '[nexus] connection-closed', senderId: 'broker-id', processId: 'process-456' }])
  })

  it('fires closing (not close) when the polite close is proposed', () => {
    disconnect(mockChannel)

    expect((mockChannel.notifyEvent as Mock).mock.calls).toEqual([['closing', { initiatedLocally: true }]])
  })

  it('does not send a second CLOSE_CONNECTION while one is in flight', () => {
    disconnect(mockChannel)
    disconnect(mockChannel)

    expect({ sent: sentActions.length, events: (mockChannel.notifyEvent as Mock).mock.calls.length }).toEqual({ sent: 1, events: 1 })
  })

  it('completes the close once acknowledged', () => {
    disconnect(mockChannel)

    disconnect(mockChannel, false)

    expect(state).toEqual(expect.objectContaining({ active: false, closingProcessId: null, closeTimer: null }))
  })

  it('removes the close process once acknowledged', () => {
    disconnect(mockChannel)

    disconnect(mockChannel, false)

    expect(mockChannel.removeProcess).toHaveBeenCalledWith('process-456')
  })

  it('fires a single close event reporting the counterpart was told', () => {
    disconnect(mockChannel)

    disconnect(mockChannel, false)

    expect(closeEvents()).toEqual([['close', { notify: true }]])
  })

  it('completes the close when the acknowledgement deadline expires', () => {
    disconnect(mockChannel)

    jest.advanceTimersByTime(2000)

    expect({ active: state.active, closingProcessId: state.closingProcessId, closes: closeEvents() }).toEqual({
      active: false,
      closingProcessId: null,
      closes: [['close', { notify: true }]],
    })
  })

  it('does not send an action when notify is false', () => {
    disconnect(mockChannel, false)

    expect({ created: (mockChannel.createProcess as Mock).mock.calls.length, sent: sentActions }).toEqual({ created: 0, sent: [] })
  })

  it('closes immediately with a close event when notify is false', () => {
    disconnect(mockChannel, false)

    expect({ active: state.active, events: (mockChannel.notifyEvent as Mock).mock.calls }).toEqual({
      active: false,
      events: [['close', { notify: false }]],
    })
  })

  it('clears the security state so a later handshake renegotiates from scratch', () => {
    state = {
      ...state,
      negotiatedProtocol: 'v4',
      securityTransport: transport,
      pendingSecurityRequest: { supported: ['v4', 'none'], preferred: 'v4' },
    }

    disconnect(mockChannel, false)

    expect(state).toEqual(expect.objectContaining({ negotiatedProtocol: null, securityTransport: null, pendingSecurityRequest: null }))
  })

  it('disposes the transport when a silent close completes', () => {
    state = { ...state, securityTransport: transport }

    disconnect(mockChannel, false)

    expect(transport.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps the transport while the polite close awaits acknowledgement', () => {
    state = { ...state, securityTransport: transport }

    disconnect(mockChannel)

    expect(transport.dispose).not.toHaveBeenCalled()
  })

  it('disposes the transport once the polite close completes', () => {
    state = { ...state, securityTransport: transport }
    disconnect(mockChannel)

    jest.advanceTimersByTime(2000)

    expect(transport.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps the negotiated security state until the polite close completes', () => {
    state = { ...state, negotiatedProtocol: 'v4' }

    disconnect(mockChannel)
    const duringClose = state.negotiatedProtocol
    jest.advanceTimersByTime(2000)

    expect([duringClose, state.negotiatedProtocol]).toEqual(['v4', null])
  })

  it('carries the reason on the close event when neither side asked for it', () => {
    disconnect(mockChannel, false, 'peer-reload')

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close', { notify: false, reason: 'peer-reload' })
  })

  it('carries the security-unconfirmed reason on a silent close', () => {
    disconnect(mockChannel, false, 'security-unconfirmed')

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close', { notify: false, reason: 'security-unconfirmed' })
  })

  it('carries the reason when a silent close completes a polite one already in flight', () => {
    state = { ...state, closingProcessId: 'process-456' }

    disconnect(mockChannel, false, 'peer-reload')

    expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close', { notify: true, reason: 'peer-reload' })
  })

  describe('finalizeClose', () => {
    it('does nothing when the channel is already inactive', () => {
      state = { ...state, active: false }

      finalizeClose(mockChannel)

      expect(mockChannel.notifyEvent).not.toHaveBeenCalled()
    })

    it('reports notify false when this side never sent CLOSE', () => {
      finalizeClose(mockChannel)

      expect({ active: state.active, removed: (mockChannel.removeProcess as Mock).mock.calls, closes: closeEvents() }).toEqual({
        active: false,
        removed: [],
        closes: [['close', { notify: false }]],
      })
    })

    it('carries the reason it was given', () => {
      finalizeClose(mockChannel, 'security-unconfirmed')

      expect(mockChannel.notifyEvent).toHaveBeenCalledWith('close', { notify: false, reason: 'security-unconfirmed' })
    })

    it('disposes the transport', () => {
      state = { ...state, securityTransport: transport }

      finalizeClose(mockChannel)

      expect(transport.dispose).toHaveBeenCalledTimes(1)
    })
  })
})
