import type { ChannelState } from '../../types/channel'
import type { SecurityTransport } from '../../types/security'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { dropSecurityTransport } from './drop'

describe('channel/security/drop', () => {
  let state: ChannelState
  let internals: ChannelInternals
  let transport: SecurityTransport

  beforeEach(() => {
    transport = {
      send: jest.fn(),
      receive: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      resume: jest.fn(),
      dispose: jest.fn(),
      getProtocol: jest.fn(() => 'v4'),
    }
    state = createInitialState('test-channel', { postMessage: jest.fn() } as unknown as Window, {})
    internals = {
      getState: () => state,
      updateState: jest.fn((partial) => {
        state = { ...state, ...partial }
      }),
      sendAction: jest.fn(),
      createProcess: jest.fn(),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: {} as unknown as ChannelInternals['actions'],
    }
  })

  it('leaves the state untouched when the channel has no transport', () => {
    dropSecurityTransport(internals)

    expect(internals.updateState).not.toHaveBeenCalled()
  })

  it('disposes the transport', () => {
    state = { ...state, securityTransport: transport }

    dropSecurityTransport(internals)

    expect(transport.dispose).toHaveBeenCalledTimes(1)
  })

  it('forgets the transport', () => {
    state = { ...state, securityTransport: transport }

    dropSecurityTransport(internals)

    expect(state.securityTransport).toBeNull()
  })

  it('disposes a transport only once across repeated drops', () => {
    state = { ...state, securityTransport: transport }

    dropSecurityTransport(internals)
    dropSecurityTransport(internals)

    expect(transport.dispose).toHaveBeenCalledTimes(1)
  })
})
