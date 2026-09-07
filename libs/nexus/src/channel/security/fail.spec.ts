import type { Mock } from '@hyperfrontend/testing'
import type { IAction } from '../../types/action'
import type { ChannelState } from '../../types/channel'
import type { SecurityTransport, SecurityTransportError } from '../../types/security'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { failSecurity } from './fail'

describe('channel/security/fail', () => {
  const contract = { accepted: [{ type: 'msg1' }], emitted: [] }
  const error: SecurityTransportError = { message: 'no confirmation within 4000ms', code: 'security-unconfirmed' }

  let state: ChannelState
  let internals: ChannelInternals
  let transport: SecurityTransport
  let sentActions: IAction[]

  const eventsFired = (): unknown[] => (internals.notifyEvent as Mock).mock.calls.map(([event]) => event)

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
      ...createInitialState('test-channel', { postMessage: jest.fn() } as unknown as Window, {}),
      origin: 'https://peer.example.com',
      negotiatedProtocol: 'v4',
      securityTransport: transport,
    }
    internals = {
      getState: () => state,
      updateState: (partial) => {
        state = { ...state, ...partial }
      },
      sendAction: (action) => {
        sentActions.push(action)
      },
      createProcess: jest.fn(() => 'process-new'),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: {
        requestConnection: jest.fn(),
        acceptConnection: jest.fn(),
        denyConnection: jest.fn(),
        cancelConnection: jest.fn((processId) => ({ type: '[nexus] connection-request-cancelled', senderId: 'broker-id', processId })),
        openConnection: jest.fn(),
        closeConnection: jest.fn(),
        destroyConnection: jest.fn(),
        newMessage: jest.fn(),
        invalidRequest: jest.fn(),
      },
    }
  })

  describe('on an active channel', () => {
    beforeEach(() => {
      state = { ...state, active: true, peerId: 'peer-1', peerContract: contract }
    })

    it('closes the connection silently with reason security-unconfirmed', () => {
      failSecurity(internals, error)

      expect(internals.notifyEvent).toHaveBeenCalledWith('close', { notify: false, reason: 'security-unconfirmed' })
    })

    it('deactivates the channel', () => {
      failSecurity(internals, error)

      expect(state.active).toBe(false)
    })

    it('disposes the transport', () => {
      failSecurity(internals, error)

      expect(transport.dispose).toHaveBeenCalledTimes(1)
    })

    it('sends nothing to the counterpart', () => {
      failSecurity(internals, error)

      expect(sentActions).toEqual([])
    })

    it('fires no deny event', () => {
      failSecurity(internals, error)

      expect(eventsFired()).toEqual(['close'])
    })

    it('completes a polite close already in flight', () => {
      state = { ...state, closingProcessId: 'process-close' }

      failSecurity(internals, error)

      expect(internals.notifyEvent).toHaveBeenCalledWith('close', { notify: true, reason: 'security-unconfirmed' })
    })
  })

  describe('while awaiting the counterpart OPEN', () => {
    beforeEach(() => {
      state = { ...state, pendingAccept: ['sender-1', 'https://peer.example.com', contract, 'process-1'], peerId: 'sender-1' }
    })

    it('disposes the transport', () => {
      failSecurity(internals, error)

      expect(transport.dispose).toHaveBeenCalledTimes(1)
    })

    it('fires the cancel event', () => {
      failSecurity(internals, error)

      expect(internals.notifyEvent).toHaveBeenCalledWith('cancel')
    })

    it('tells the counterpart the pending process is cancelled', () => {
      failSecurity(internals, error)

      expect(sentActions).toEqual([{ type: '[nexus] connection-request-cancelled', senderId: 'broker-id', processId: 'process-1' }])
    })

    it('reuses the pending process id instead of creating one', () => {
      failSecurity(internals, error)

      expect(internals.createProcess).not.toHaveBeenCalled()
    })

    it('resets the pending handshake and security state', () => {
      failSecurity(internals, error)

      expect(state).toEqual(
        expect.objectContaining({ active: false, pendingAccept: null, negotiatedProtocol: null, securityTransport: null })
      )
    })

    it('fires deny with reason security-unavailable and the pinned origin', () => {
      failSecurity(internals, error)

      expect(internals.notifyEvent).toHaveBeenCalledWith('deny', {
        error: 'no confirmation within 4000ms',
        reason: 'security-unavailable',
        origin: 'https://peer.example.com',
      })
    })

    it('fires deny without an origin when none is pinned', () => {
      state = { ...state, origin: null }

      failSecurity(internals, error)

      expect((internals.notifyEvent as Mock).mock.calls.filter(([event]) => event === 'deny')).toStrictEqual([
        ['deny', { error: 'no confirmation within 4000ms', reason: 'security-unavailable' }],
      ])
    })

    it('fires cancel before deny', () => {
      failSecurity(internals, error)

      expect(eventsFired()).toEqual(['cancel', 'deny'])
    })
  })

  describe('on an idle channel', () => {
    it('disposes the transport', () => {
      failSecurity(internals, error)

      expect(transport.dispose).toHaveBeenCalledTimes(1)
    })

    it('forgets the transport', () => {
      failSecurity(internals, error)

      expect(state.securityTransport).toBeNull()
    })

    it('fires no event', () => {
      failSecurity(internals, error)

      expect(internals.notifyEvent).not.toHaveBeenCalled()
    })

    it('sends nothing to the counterpart', () => {
      failSecurity(internals, error)

      expect(sentActions).toEqual([])
    })

    it('tolerates a channel without a transport', () => {
      state = { ...state, securityTransport: null }

      expect(() => failSecurity(internals, error)).not.toThrow()
    })
  })
})
