import type { Mock } from '@hyperfrontend/testing'
import type { IAction } from '../../types/action'
import type { ChannelState } from '../../types/channel'
import type { SecurityTransport } from '../../types/security'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { HANDSHAKE_ACTION_TYPES } from '../../constants/handshake-actions'
import { ACTION_TYPES } from '../../types/action'
import { createInitialState } from '../state/initial'
import { sendAction } from './send-action'

describe('channel/messaging/send-action', () => {
  const handshakeTypes = [
    ACTION_TYPES.REQUEST_CONNECTION,
    ACTION_TYPES.ACCEPT_CONNECTION,
    ACTION_TYPES.DENY_CONNECTION,
    ACTION_TYPES.CANCEL_CONNECTION,
    ACTION_TYPES.CANCEL_CONNECTION_ACKNOWLEDGED,
    ACTION_TYPES.OPEN_CONNECTION,
  ]
  const sealedTypes = [
    ACTION_TYPES.NEW_MESSAGE,
    ACTION_TYPES.CLOSE_CONNECTION,
    ACTION_TYPES.CLOSE_CONNECTION_ACKNOWLEDGED,
    ACTION_TYPES.DESTROY_CONNECTION,
    ACTION_TYPES.INVALID_REQUEST,
    ACTION_TYPES.SECURITY_CONFIRMED,
  ]
  const actionOf = (type: string): IAction => ({ type, senderId: 'broker-id', processId: 'process-123' }) as IAction
  const request = actionOf(ACTION_TYPES.REQUEST_CONNECTION)
  const invalidActions: readonly [string, unknown][] = [
    ['null', null],
    ['undefined', undefined],
    ['an action without a type', {}],
    ['an action whose type is not a string', { type: 123 }],
  ]

  let postMessage: Mock
  let state: ChannelState
  let channel: ChannelInternals
  let transport: SecurityTransport

  beforeEach(() => {
    postMessage = jest.fn()
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
      ...createInitialState('test-channel', { postMessage } as unknown as Window, { origin: 'https://example.com' }),
      active: true,
    }

    channel = {
      getState: () => state,
      updateState: jest.fn(),
      sendAction: jest.fn(),
      createProcess: jest.fn(),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: {} as unknown as ChannelInternals['actions'],
    }
  })

  it('lists exactly the six handshake actions as plaintext-only', () => {
    expect([...HANDSHAKE_ACTION_TYPES]).toEqual(handshakeTypes)
  })

  describe('validation', () => {
    it.each(invalidActions)('throws for %s', (_label: string, action: unknown) => {
      expect(() => sendAction(channel, action as IAction)).toThrow("Action must contain a 'type' property that is a non-empty string.")
    })

    it('posts nothing for an invalid action', () => {
      expect(() => sendAction(channel, {} as IAction)).toThrow()
      expect(postMessage).not.toHaveBeenCalled()
    })
  })

  describe('without a security transport', () => {
    it('posts the action to the pinned origin', () => {
      sendAction(channel, request)

      expect(postMessage).toHaveBeenCalledWith(request, 'https://example.com')
    })

    it('posts to any origin before one is pinned', () => {
      state = { ...state, origin: null }

      sendAction(channel, request)

      expect(postMessage).toHaveBeenCalledWith(request, '*')
    })

    it('posts to any origin when the pinned origin is opaque', () => {
      state = { ...state, origin: 'null' }

      sendAction(channel, request)

      expect(postMessage).toHaveBeenCalledWith(request, '*')
    })

    it('posts even while the channel is closed', () => {
      state = { ...state, active: false }

      sendAction(channel, request)

      expect(postMessage).toHaveBeenCalledWith(request, 'https://example.com')
    })

    it.each(sealedTypes)('posts %s in plaintext', (type: string) => {
      const action = actionOf(type)

      sendAction(channel, action)

      expect(postMessage).toHaveBeenCalledWith(action, 'https://example.com')
    })
  })

  describe('with a security transport', () => {
    beforeEach(() => {
      state = { ...state, securityTransport: transport }
    })

    it.each(handshakeTypes)('posts %s in plaintext', (type: string) => {
      const action = actionOf(type)

      sendAction(channel, action)

      expect(postMessage).toHaveBeenCalledWith(action, 'https://example.com')
    })

    it.each(handshakeTypes)('keeps %s away from the transport', (type: string) => {
      sendAction(channel, actionOf(type))

      expect(transport.send).not.toHaveBeenCalled()
    })

    it.each(sealedTypes)('routes %s through the transport', (type: string) => {
      const action = actionOf(type)

      sendAction(channel, action)

      expect(transport.send).toHaveBeenCalledWith(action)
    })

    it.each(sealedTypes)('never posts %s in plaintext', (type: string) => {
      sendAction(channel, actionOf(type))

      expect(postMessage).not.toHaveBeenCalled()
    })

    it('routes through the transport while the channel is still closed', () => {
      state = { ...state, active: false }
      const action = actionOf(ACTION_TYPES.NEW_MESSAGE)

      sendAction(channel, action)

      expect(transport.send).toHaveBeenCalledWith(action)
    })

    it('routes through the transport before an origin is pinned', () => {
      state = { ...state, origin: null }
      const action = actionOf(ACTION_TYPES.NEW_MESSAGE)

      sendAction(channel, action)

      expect(transport.send).toHaveBeenCalledWith(action)
    })

    it('posts handshake actions to any origin before one is pinned', () => {
      state = { ...state, origin: null }

      sendAction(channel, request)

      expect(postMessage).toHaveBeenCalledWith(request, '*')
    })

    it('validates the action before consulting the transport', () => {
      expect(() => sendAction(channel, { type: 123 } as unknown as IAction)).toThrow()
      expect(transport.send).not.toHaveBeenCalled()
    })
  })
})
