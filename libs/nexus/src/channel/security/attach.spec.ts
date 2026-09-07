import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { SecureTransportConfig } from '../../security/transport/types'
import type { IAction } from '../../types/action'
import type { ChannelState } from '../../types/channel'
import type { SecurityProvider, SecurityTransport, SecurityTransportError } from '../../types/security'
import type { ChannelInternals, ChannelSecurityDependencies } from '../types'
import { beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as secureTransportModule from '../../security/transport/secure-transport'
import { createInitialState } from '../state/initial'
import { attachSecurityTransport } from './attach'
import * as failModule from './fail'

jest.mock('../../security/transport/secure-transport')
jest.mock('./fail')

describe('channel/security/attach', () => {
  const createSecureTransport = secureTransportModule.createSecureTransport as Mock
  const failSecurity = failModule.failSecurity as Mock

  let state: ChannelState
  let internals: ChannelInternals
  let logger: Logger
  let target: Window
  let provider: SecurityProvider
  let security: ChannelSecurityDependencies
  let transport: SecurityTransport

  const createMockTransport = (): SecurityTransport => ({
    send: jest.fn(),
    receive: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    resume: jest.fn(),
    dispose: jest.fn(),
    getProtocol: jest.fn(() => 'v4'),
  })

  const builtConfig = (): SecureTransportConfig => createSecureTransport.mock.calls[0][0] as SecureTransportConfig

  beforeEach(() => {
    jest.clearAllMocks()

    logger = { warn: jest.fn(), error: jest.fn() } as unknown as Logger
    target = { postMessage: jest.fn() } as unknown as Window
    provider = { createChannel: jest.fn(), protocolProvider: jest.fn() }
    security = { localId: 'local-1', getProvider: jest.fn(() => provider), dispatch: jest.fn() }
    transport = createMockTransport()
    createSecureTransport.mockImplementation(() => transport)

    state = createInitialState('test-channel', target, { logger, requestRetryMs: 250, connectTimeoutMs: 4000 })
    internals = {
      getState: () => state,
      updateState: (partial) => {
        state = { ...state, ...partial }
      },
      sendAction: jest.fn(),
      createProcess: jest.fn(),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: {} as unknown as ChannelInternals['actions'],
      security,
    }
  })

  describe('without a usable provider', () => {
    it('returns false when the channel has no security dependencies', () => {
      expect(attachSecurityTransport({ ...internals, security: undefined }, 'v4', 'peer-1', 'initiator')).toBe(false)
    })

    it('builds no transport when the channel has no security dependencies', () => {
      attachSecurityTransport({ ...internals, security: undefined }, 'v4', 'peer-1', 'initiator')

      expect(createSecureTransport).not.toHaveBeenCalled()
    })

    it('looks the provider up by the negotiated protocol', () => {
      attachSecurityTransport(internals, 'v3', 'peer-1', 'initiator')

      expect(security.getProvider).toHaveBeenCalledWith('v3')
    })

    it('returns false when no provider is registered for the protocol', () => {
      ;(security.getProvider as Mock).mockReturnValue(undefined)

      expect(attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')).toBe(false)
    })

    it('keeps an earlier transport when no provider is registered', () => {
      const previous = createMockTransport()
      state = { ...state, securityTransport: previous }
      ;(security.getProvider as Mock).mockReturnValue(undefined)

      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      expect(state.securityTransport).toBe(previous)
    })

    it('returns false when the provider refuses the session', () => {
      createSecureTransport.mockImplementation(() => {
        throw createError('session refused')
      })

      expect(attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')).toBe(false)
    })

    it('warns about a refused session when the channel has a logger', () => {
      createSecureTransport.mockImplementation(() => {
        throw createError('session refused')
      })

      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      expect(logger.warn).toHaveBeenCalledWith("Cannot attach the 'v4' security transport to channel test-channel: session refused")
    })

    it('leaves the channel without a transport when the provider refuses the session', () => {
      state = { ...state, securityTransport: createMockTransport() }
      createSecureTransport.mockImplementation(() => {
        throw createError('session refused')
      })

      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      expect(state.securityTransport).toBeNull()
    })

    it('stays silent about a refused session when the channel has no logger', () => {
      state = createInitialState('test-channel', target, {})
      createSecureTransport.mockImplementation(() => {
        throw createError('session refused')
      })

      expect(attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')).toBe(false)
    })
  })

  describe('attaching', () => {
    it('returns true when the provider serves the session', () => {
      expect(attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')).toBe(true)
    })

    it('stores the transport on the channel', () => {
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      expect(state.securityTransport).toBe(transport)
    })

    it('disposes the previous transport before building the new one', () => {
      const previous = createMockTransport()
      state = { ...state, securityTransport: previous }

      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      expect((previous.dispose as Mock).mock.invocationCallOrder[0]).toBeLessThan(createSecureTransport.mock.invocationCallOrder[0])
    })

    it('does not start the transport', () => {
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      expect(transport.start).not.toHaveBeenCalled()
    })

    it('builds the transport between the broker id and the counterpart id', () => {
      attachSecurityTransport(internals, 'v4', 'peer-1', 'responder')

      expect(createSecureTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          protocol: 'v4',
          provider,
          label: 'test-channel',
          target,
          originId: 'local-1',
          targetId: 'peer-1',
          role: 'responder',
        })
      )
    })

    it('paces the hello exchange by the channel handshake timers', () => {
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      expect(createSecureTransport).toHaveBeenCalledWith(expect.objectContaining({ helloRetryMs: 250, confirmTimeoutMs: 4000 }))
    })

    it('reports no origin before the channel pins one', () => {
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      expect(builtConfig().getOrigin()).toBeNull()
    })

    it('reads the origin pinned after attaching', () => {
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')
      internals.updateState({ origin: 'https://peer.example.com' })

      expect(builtConfig().getOrigin()).toBe('https://peer.example.com')
    })
  })

  describe('transport callbacks', () => {
    const action: IAction = { type: '[nexus] new-message', senderId: 'peer-1' }
    const error: SecurityTransportError = { message: 'seal failed', code: 'transport-error' }

    it('dispatches an opened action as if the counterpart window had posted it', () => {
      state = { ...state, origin: 'https://peer.example.com' }
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      builtConfig().onAction(action)

      expect(security.dispatch).toHaveBeenCalledWith({ data: action, origin: 'https://peer.example.com', source: target })
    })

    it('dispatches with an empty origin before the channel pins one', () => {
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      builtConfig().onAction(action)

      expect(security.dispatch).toHaveBeenCalledWith({ data: action, origin: '', source: target })
    })

    it('dispatches with the origin pinned after attaching', () => {
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')
      internals.updateState({ origin: 'https://late.example.com' })

      builtConfig().onAction(action)

      expect(security.dispatch).toHaveBeenCalledWith({ data: action, origin: 'https://late.example.com', source: target })
    })

    it('fires security-error for a transport error', () => {
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      builtConfig().onError?.(error)

      expect(internals.notifyEvent).toHaveBeenCalledWith('security-error', error)
    })

    it('logs a coded transport error as a warning', () => {
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      builtConfig().onError?.(error)

      expect(logger.warn).toHaveBeenCalledWith('test-channel security error:', '[transport-error]', 'seal failed')
    })

    it('logs an uncoded transport error as an error', () => {
      const cause = createError('boom')
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      builtConfig().onError?.({ message: 'boom', code: 'unknown', cause })

      expect(logger.error).toHaveBeenCalledWith('test-channel security error:', 'boom', cause)
    })

    it('reports a transport error without logging when the channel has no logger', () => {
      state = createInitialState('test-channel', target, {})
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      builtConfig().onError?.(error)

      expect(internals.notifyEvent).toHaveBeenCalledWith('security-error', error)
    })

    it('fires security-ready with the protocol once the counterpart confirms', () => {
      attachSecurityTransport(internals, 'v3', 'peer-1', 'initiator')

      builtConfig().onConfirmed?.()

      expect(internals.notifyEvent).toHaveBeenCalledWith('security-ready', { protocol: 'v3' })
    })

    it('terminates the session when the transport reports failure', () => {
      const failure: SecurityTransportError = { message: 'no confirmation', code: 'security-unconfirmed' }
      attachSecurityTransport(internals, 'v4', 'peer-1', 'initiator')

      builtConfig().onFailed?.(failure)

      expect(failSecurity).toHaveBeenCalledWith(internals, failure)
    })
  })
})
