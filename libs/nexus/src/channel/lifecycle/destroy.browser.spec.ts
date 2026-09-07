import type { IAction } from '../../types/action'
import type { ChannelState } from '../../types/channel'
import type { SecurityTransport } from '../../types/security'
import type { ChannelInternals } from '../types'
import { after as afterAll, afterEach, before as beforeAll, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { destroy } from './destroy'
import { disconnect } from './disconnect'
import { startHandshakeTimers } from './handshake-timers'

describe('channel/lifecycle/destroy', () => {
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
      ...createInitialState('test-channel', window, { contract }),
      origin: 'https://example.com',
      active: true,
      readyToConnect: true,
      securityTransport: transport,
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
        destroyConnection: jest.fn(() => ({
          type: '[nexus] connection-destroyed',
          senderId: 'broker-id',
        })),
        newMessage: jest.fn(),
        invalidRequest: jest.fn(),
      },
      cleanup: jest.fn(),
    }
  })

  it('sets channel to inactive immediately', () => {
    destroy(mockChannel)

    expect(state.active).toBe(false)
  })

  it('sends DESTROY_CONNECTION when notify is true (default)', () => {
    destroy(mockChannel)

    expect(sentActions).toEqual([{ type: '[nexus] connection-destroyed', senderId: 'broker-id' }])
  })

  it('sends DESTROY_CONNECTION when notify is explicitly true', () => {
    destroy(mockChannel, true)

    expect(sentActions).toEqual([expect.objectContaining({ type: '[nexus] connection-destroyed' })])
  })

  it('does not send an action when notify is false', () => {
    destroy(mockChannel, false)

    expect(sentActions).toEqual([])
  })

  it('calls the cleanup callback', () => {
    destroy(mockChannel)

    expect(mockChannel.cleanup).toHaveBeenCalledTimes(1)
  })

  it('does not throw if cleanup callback is not provided', () => {
    delete mockChannel.cleanup

    expect(() => destroy(mockChannel)).not.toThrow()
  })

  it('works even when channel is already inactive', () => {
    state = { ...state, active: false }

    destroy(mockChannel)

    expect({ active: state.active, cleanups: (mockChannel.cleanup as ReturnType<typeof jest.fn>).mock.calls.length }).toEqual({
      active: false,
      cleanups: 1,
    })
  })

  it('fires no channel event', () => {
    destroy(mockChannel)

    expect(mockChannel.notifyEvent).not.toHaveBeenCalled()
  })

  it('disposes the security transport', () => {
    destroy(mockChannel)

    expect(transport.dispose).toHaveBeenCalledTimes(1)
  })

  it('forgets the security transport', () => {
    destroy(mockChannel)

    expect(state.securityTransport).toBeNull()
  })

  it('tolerates a channel without a transport', () => {
    state = { ...state, securityTransport: null }

    expect(() => destroy(mockChannel)).not.toThrow()
  })

  it('resets the handshake and close state', () => {
    state = {
      ...state,
      pendingProcessId: 'process-1',
      pendingAccept: ['sender-1', 'https://example.com', contract, 'process-1'],
      scheduledActivation: ['sender-2', 'https://example.com', contract, 'process-2'],
      closingProcessId: 'process-3',
    }

    destroy(mockChannel)

    expect(state).toEqual(
      expect.objectContaining({ pendingProcessId: null, pendingAccept: null, scheduledActivation: null, closingProcessId: null })
    )
  })

  it('cancels the deadline of a polite close in flight', () => {
    disconnect(mockChannel)
    ;(mockChannel.notifyEvent as ReturnType<typeof jest.fn>).mockClear()

    destroy(mockChannel, false)
    jest.advanceTimersByTime(state.closeTimeoutMs)

    expect({ closeTimer: state.closeTimer, events: (mockChannel.notifyEvent as ReturnType<typeof jest.fn>).mock.calls }).toEqual({
      closeTimer: null,
      events: [],
    })
  })

  it('clears running handshake timers', () => {
    const onDeadline = jest.fn()
    startHandshakeTimers(mockChannel, { type: '[nexus] connection-request', senderId: 'broker-id' }, onDeadline)

    destroy(mockChannel, false)
    jest.advanceTimersByTime(20_000)

    expect({ retried: sentActions, deadline: onDeadline.mock.calls.length }).toEqual({ retried: [], deadline: 0 })
  })

  it('executes operations in correct order', () => {
    const operations: string[] = []
    state = { ...state, securityTransport: null }

    mockChannel.updateState = (partial) => {
      state = { ...state, ...partial }
      operations.push('updateState')
    }

    mockChannel.sendAction = (action) => {
      sentActions.push(action)
      operations.push('sendAction')
    }

    mockChannel.cleanup = () => {
      operations.push('cleanup')
    }

    destroy(mockChannel)

    expect(operations).toEqual(['updateState', 'sendAction', 'cleanup'])
  })

  it('releases the transport after handing it the destroy frame', () => {
    const operations: string[] = []
    ;(transport.dispose as ReturnType<typeof jest.fn>).mockImplementation(() => {
      operations.push('dispose')
    })
    mockChannel.sendAction = (action) => {
      sentActions.push(action)
      operations.push('sendAction')
    }

    destroy(mockChannel)

    expect(operations).toEqual(['sendAction', 'dispose'])
  })
})
