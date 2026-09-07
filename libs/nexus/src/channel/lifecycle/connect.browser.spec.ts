import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { IAction } from '../../types/action'
import type { ChannelState } from '../../types/channel'
import type { SecurityProvider, SecurityTransport, SecurityWireChannel } from '../../types/security'
import type { ChannelInternals, ChannelSecurityDependencies } from '../types'
import { after as afterAll, afterEach, before as beforeAll, beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { connect } from './connect'

describe('channel/lifecycle/connect', () => {
  const contract = { accepted: [{ type: 'msg1' }, { type: 'msg2' }], emitted: [] }
  const missingProviderWarning = "No working provider for the 'v4' protocol negotiated on channel test-channel."

  let mockChannel: ChannelInternals
  let state: ChannelState
  let sentActions: IAction[]
  let logger: Logger
  let target: Window
  let wire: SecurityWireChannel
  let provider: SecurityProvider
  let security: ChannelSecurityDependencies

  const createMockTransport = (): SecurityTransport => ({
    send: jest.fn(),
    receive: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    resume: jest.fn(),
    dispose: jest.fn(),
    getProtocol: jest.fn(() => 'v4'),
  })

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
    logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn() } as unknown as Logger
    target = { postMessage: jest.fn() } as unknown as Window
    wire = {
      label: 'test-channel',
      send: jest.fn(),
      receive: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
      hello: jest.fn(async () => new Uint8Array([1])),
      isHello: jest.fn(() => false),
      acceptHello: jest.fn(() => 'accepted'),
    }
    provider = { createChannel: jest.fn(() => wire), protocolProvider: jest.fn() }
    security = { localId: 'local-1', getProvider: jest.fn(() => provider), dispatch: jest.fn() }

    state = { ...createInitialState('test-channel', target, { logger }), id: 'channel-123' }

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
        denyConnection: jest.fn((processId, error) => ({
          type: '[nexus] connection-request-denied',
          senderId: 'broker-id',
          processId,
          error,
        })),
        cancelConnection: jest.fn(),
        openConnection: jest.fn(),
        closeConnection: jest.fn(),
        destroyConnection: jest.fn(),
        newMessage: jest.fn(),
        invalidRequest: jest.fn(),
      },
      security,
    }
  })

  it('does nothing if channel is already active', () => {
    state = { ...state, active: true }

    connect(mockChannel)

    expect({ sent: sentActions, created: (mockChannel.createProcess as Mock).mock.calls.length }).toEqual({ sent: [], created: 0 })
  })

  it('does nothing if a connection request is already outstanding', () => {
    state = { ...state, pendingProcessId: 'process-outstanding' }

    connect(mockChannel)

    expect({ sent: sentActions, created: (mockChannel.createProcess as Mock).mock.calls.length }).toEqual({ sent: [], created: 0 })
  })

  it('does nothing if an accept is already pending', () => {
    state = { ...state, pendingAccept: ['sender-789', 'https://example.com', contract, 'process-999'] }

    connect(mockChannel)

    expect({ sent: sentActions, created: (mockChannel.createProcess as Mock).mock.calls.length }).toEqual({ sent: [], created: 0 })
  })

  it('sets connectTimestamp if not already set', () => {
    connect(mockChannel)

    expect(state.connectTimestamp).toBeGreaterThan(0)
  })

  it('does not overwrite existing connectTimestamp', () => {
    state = { ...state, connectTimestamp: 1234567890 }

    connect(mockChannel)

    expect(state.connectTimestamp).toBe(1234567890)
  })

  it('sets readyToConnect to true when not already set', () => {
    connect(mockChannel)

    expect(state.readyToConnect).toBe(true)
  })

  it('keeps readyToConnect when already true', () => {
    state = { ...state, readyToConnect: true }

    connect(mockChannel)

    expect(state.readyToConnect).toBe(true)
  })

  describe('initiator path', () => {
    it('sends REQUEST_CONNECTION through a new process', () => {
      connect(mockChannel)

      expect(sentActions).toEqual([expect.objectContaining({ type: '[nexus] connection-request', processId: 'process-456' })])
    })

    it('records the pending process', () => {
      connect(mockChannel)

      expect(state.pendingProcessId).toBe('process-456')
    })

    it('advertises no security when the channel has no security settings', () => {
      connect(mockChannel)

      expect(mockChannel.actions.requestConnection).toHaveBeenCalledWith('process-456', undefined)
    })

    it('advertises the configured protocol with plaintext fallback in the security request', () => {
      state = { ...state, security: { protocol: 'v4' } }

      connect(mockChannel)

      expect(mockChannel.actions.requestConnection).toHaveBeenCalledWith('process-456', {
        supported: ['v4', 'none'],
        preferred: 'v4',
      })
    })

    it('sends no security request when security is disabled', () => {
      state = { ...state, security: { protocol: 'v4', disabled: true } }

      connect(mockChannel)

      expect(mockChannel.actions.requestConnection).toHaveBeenCalledWith('process-456', undefined)
    })

    it('sends no security request when the configured protocol is none', () => {
      state = { ...state, security: { protocol: 'none' } }

      connect(mockChannel)

      expect(mockChannel.actions.requestConnection).toHaveBeenCalledWith('process-456', undefined)
    })

    it('re-sends REQUEST_CONNECTION at the retry cadence', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(1500)

      expect(sentActions.map((action) => action.type)).toEqual([
        '[nexus] connection-request',
        '[nexus] connection-request',
        '[nexus] connection-request',
        '[nexus] connection-request',
      ])
    })

    it('removes the process when the deadline expires', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(10_000)

      expect(mockChannel.removeProcess).toHaveBeenCalledWith('process-456')
    })

    it('fires connect-timeout when the deadline expires', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(10_000)

      expect(mockChannel.notifyEvent).toHaveBeenCalledWith('connect-timeout', { elapsedMs: 10_000 })
    })

    it('stays inactive and reconnectable after the deadline expires', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(10_000)

      expect(state).toEqual(
        expect.objectContaining({ active: false, pendingProcessId: null, retryTimer: null, deadlineTimer: null, negotiatedProtocol: null })
      )
    })

    it('disposes a lingering transport when the deadline expires', () => {
      const transport = createMockTransport()
      state = { ...state, securityTransport: transport }
      connect(mockChannel)

      jest.advanceTimersByTime(10_000)

      expect(transport.dispose).toHaveBeenCalledTimes(1)
    })

    it('stops retrying after the deadline expires', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(10_000)
      const sentAtDeadline = sentActions.length
      jest.advanceTimersByTime(5000)

      expect(sentActions).toHaveLength(sentAtDeadline)
    })

    it('honors custom retry and deadline settings', () => {
      state = { ...state, requestRetryMs: 100, connectTimeoutMs: 250 }

      connect(mockChannel)

      jest.advanceTimersByTime(250)

      expect({ sent: sentActions.length, timeout: (mockChannel.notifyEvent as Mock).mock.calls }).toEqual({
        sent: 3,
        timeout: [['connect-timeout', { elapsedMs: 250 }]],
      })
    })
  })

  describe('responder path (scheduled activation)', () => {
    beforeEach(() => {
      state = { ...state, scheduledActivation: ['sender-789', 'https://example.com', contract, 'process-999'] }
    })

    it('answers with ACCEPT and waits for OPEN instead of activating', () => {
      connect(mockChannel)

      expect({ sent: sentActions, active: state.active }).toEqual({
        sent: [expect.objectContaining({ type: '[nexus] connection-request-accepted' })],
        active: false,
      })
    })

    it('answers a request without a security slot with a plain ACCEPT', () => {
      connect(mockChannel)

      expect(mockChannel.actions.acceptConnection).toHaveBeenCalledWith('process-999', undefined)
    })

    it('attaches no transport when the request carried no security slot', () => {
      connect(mockChannel)

      expect(security.getProvider).not.toHaveBeenCalled()
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

      expect(sentActions.map((action) => action.type)).toEqual([
        '[nexus] connection-request-accepted',
        '[nexus] connection-request-accepted',
        '[nexus] connection-request-accepted',
      ])
    })

    it('fires timeout when OPEN never arrives within the deadline', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(10_000)

      expect({ timeout: (mockChannel.notifyEvent as Mock).mock.calls, pendingAccept: state.pendingAccept }).toEqual({
        timeout: [['connect-timeout', { elapsedMs: 10_000 }]],
        pendingAccept: null,
      })
    })

    it('does not create a new process when answering a scheduled activation', () => {
      connect(mockChannel)

      expect(mockChannel.createProcess).not.toHaveBeenCalled()
    })
  })

  describe('responder path with a negotiated protocol', () => {
    beforeEach(() => {
      state = { ...state, scheduledActivation: ['sender-789', 'https://example.com', contract, 'process-999', { negotiated: 'v4' }] }
    })

    it('attaches the negotiated transport as the responder toward the requesting broker', () => {
      connect(mockChannel)

      expect(provider.createChannel).toHaveBeenCalledWith(
        'test-channel',
        expect.objectContaining({ session: { protocol: 'v4', role: 'responder', localId: 'local-1', peerId: 'sender-789' } })
      )
    })

    it('answers with the negotiated security response', () => {
      connect(mockChannel)

      expect(mockChannel.actions.acceptConnection).toHaveBeenCalledWith('process-999', { negotiated: 'v4' })
    })

    it('stores the transport on the channel', () => {
      connect(mockChannel)

      expect(state.securityTransport?.getProtocol()).toBe('v4')
    })

    it('starts the hello exchange after ACCEPT leaves', () => {
      const operations: string[] = []
      mockChannel.sendAction = (action) => {
        operations.push(action.type)
      }
      ;(wire.hello as Mock).mockImplementation(async () => {
        operations.push('hello')
        return new Uint8Array([1])
      })

      connect(mockChannel)

      expect(operations).toEqual(['[nexus] connection-request-accepted', 'hello'])
    })

    it('releases the transport when OPEN never arrives within the deadline', () => {
      connect(mockChannel)

      jest.advanceTimersByTime(10_000)

      expect(state.securityTransport).toBeNull()
    })

    it('skips the transport when the request negotiated plaintext', () => {
      state = { ...state, scheduledActivation: ['sender-789', 'https://example.com', contract, 'process-999', { negotiated: 'none' }] }

      connect(mockChannel)

      expect({
        lookups: (security.getProvider as Mock).mock.calls,
        accept: (mockChannel.actions.acceptConnection as Mock).mock.calls,
      }).toEqual({
        lookups: [],
        accept: [['process-999', { negotiated: 'none' }]],
      })
    })
  })

  describe('responder path when the negotiated provider is unavailable', () => {
    beforeEach(() => {
      state = {
        ...state,
        scheduledActivation: ['sender-789', 'https://example.com', contract, 'process-999', { negotiated: 'v4' }],
        negotiatedProtocol: 'v4',
        pendingSecurityRequest: { supported: ['v4', 'none'], preferred: 'v4' },
      }
      ;(security.getProvider as Mock).mockReturnValue(undefined)
    })

    describe('on a fail-closed channel', () => {
      beforeEach(() => {
        state = { ...state, security: { protocol: 'v4', mode: 'fail-closed' } }
      })

      it('sends DENY to the counterpart', () => {
        connect(mockChannel)

        expect(sentActions).toEqual([
          {
            type: '[nexus] connection-request-denied',
            senderId: 'broker-id',
            processId: 'process-999',
            error: 'Security is required for this channel but no provider can serve the negotiated protocol.',
            reason: 'security-unavailable',
          },
        ])
      })

      it('removes the tracked process', () => {
        connect(mockChannel)

        expect(mockChannel.removeProcess).toHaveBeenCalledWith('process-999')
      })

      it('forgets the scheduled request and its security state', () => {
        connect(mockChannel)

        expect(state).toEqual(
          expect.objectContaining({
            scheduledActivation: null,
            negotiatedProtocol: null,
            pendingSecurityRequest: null,
            pendingAccept: null,
            securityTransport: null,
            active: false,
          })
        )
      })

      it('fires deny with reason security-unavailable and the request origin', () => {
        connect(mockChannel)

        expect(mockChannel.notifyEvent).toHaveBeenCalledWith('deny', {
          error: 'Security is required for this channel but no provider can serve the negotiated protocol.',
          reason: 'security-unavailable',
          origin: 'https://example.com',
        })
      })

      it('warns that the negotiated provider is missing', () => {
        connect(mockChannel)

        expect((logger.warn as Mock).mock.calls).toEqual([[missingProviderWarning]])
      })

      it('starts no handshake timers', () => {
        connect(mockChannel)

        jest.advanceTimersByTime(10_000)

        expect({ sent: sentActions.length, events: (mockChannel.notifyEvent as Mock).mock.calls.map(([event]) => event) }).toEqual({
          sent: 1,
          events: ['deny'],
        })
      })
    })

    describe('on a fail-open channel that requested security', () => {
      beforeEach(() => {
        state = { ...state, security: { protocol: 'v4' } }
      })

      it('answers with plaintext', () => {
        connect(mockChannel)

        expect(mockChannel.actions.acceptConnection).toHaveBeenCalledWith('process-999', { negotiated: 'none' })
      })

      it('records plaintext as the negotiated protocol', () => {
        connect(mockChannel)

        expect(state.negotiatedProtocol).toBe('none')
      })

      it('warns that encryption was requested but is unavailable', () => {
        connect(mockChannel)

        expect((logger.warn as Mock).mock.calls).toEqual([
          [missingProviderWarning],
          ['Channel test-channel requested security but the negotiated provider is unavailable; continuing without encryption.'],
        ])
      })

      it('still waits for OPEN', () => {
        connect(mockChannel)

        expect(state.pendingAccept).toEqual(['sender-789', 'https://example.com', contract, 'process-999', { negotiated: 'v4' }])
      })

      it('fires no deny event', () => {
        connect(mockChannel)

        expect(mockChannel.notifyEvent).not.toHaveBeenCalled()
      })
    })

    describe('on a channel without security settings', () => {
      it('warns only about the missing provider', () => {
        connect(mockChannel)

        expect((logger.warn as Mock).mock.calls).toEqual([[missingProviderWarning]])
      })

      it('answers with plaintext', () => {
        connect(mockChannel)

        expect(mockChannel.actions.acceptConnection).toHaveBeenCalledWith('process-999', { negotiated: 'none' })
      })

      it('answers with plaintext without a logger', () => {
        state = { ...state, logger: null }

        connect(mockChannel)

        expect(mockChannel.actions.acceptConnection).toHaveBeenCalledWith('process-999', { negotiated: 'none' })
      })

      it('falls back to plaintext when the provider refuses the session', () => {
        ;(security.getProvider as Mock).mockReturnValue(provider)
        ;(provider.createChannel as Mock).mockImplementation(() => {
          throw createError('session refused')
        })

        connect(mockChannel)

        expect(mockChannel.actions.acceptConnection).toHaveBeenCalledWith('process-999', { negotiated: 'none' })
      })
    })
  })
})
