import type { ChannelState } from '../../types/channel'
import type { IMessage } from '../../types/message'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import * as queueModule from './queue'
import { send } from './send'
import * as sendActionModule from './send-action'

jest.mock('./queue')
jest.mock('./send-action')

describe('channel/messaging/send', () => {
  const message: IMessage = { type: 'USER_ACTION', data: { userId: 123 } }
  const foreign: IMessage = { type: 'UNAUTHORIZED_ACTION', data: {} }
  const notEmitted = (type: string): string =>
    `Cannot send message to test-channel channel. Message type '${type}' is not in the emitted actions of channel contract.`

  let state: ChannelState
  let channel: ChannelInternals

  beforeEach(() => {
    jest.clearAllMocks()

    state = {
      ...createInitialState('test-channel', { postMessage: jest.fn() } as unknown as Window, {
        contract: { accepted: [{ type: 'SYSTEM_MESSAGE' }], emitted: [{ type: 'USER_ACTION' }] },
      }),
      active: true,
      origin: 'https://example.com',
    }

    channel = {
      getState: () => state,
      updateState: jest.fn(),
      sendAction: jest.fn(),
      createProcess: jest.fn(),
      removeProcess: jest.fn(),
      notifyEvent: jest.fn(),
      notifyMessage: jest.fn(),
      actions: {
        newMessage: jest.fn((data: IMessage) => ({ type: '[nexus] new-message', senderId: 'broker-id', data })),
      } as unknown as ChannelInternals['actions'],
    }
  })

  describe('on an active channel', () => {
    it('wraps the message in a new-message action', () => {
      send(channel, message)

      expect(channel.actions.newMessage).toHaveBeenCalledWith(message)
    })

    it('sends the wrapped action', () => {
      send(channel, message)

      expect(sendActionModule.sendAction).toHaveBeenCalledWith(
        channel,
        expect.objectContaining({ type: '[nexus] new-message', senderId: 'broker-id', data: message })
      )
    })

    it('notifies the local message subscribers', () => {
      send(channel, message)

      expect(channel.notifyMessage).toHaveBeenCalledWith(message)
    })

    it('queues nothing', () => {
      send(channel, message)

      expect(queueModule.queue).not.toHaveBeenCalled()
    })

    it('throws when the message type is outside the emitted actions', () => {
      expect(() => send(channel, foreign)).toThrow(notEmitted('UNAUTHORIZED_ACTION'))
    })

    it('throws when the channel has no contract', () => {
      state = { ...state, contract: null }

      expect(() => send(channel, message)).toThrow(notEmitted('USER_ACTION'))
    })
  })

  describe('on a closed channel', () => {
    beforeEach(() => {
      state = { ...state, active: false }
    })

    it('queues the message when queueing is enabled', () => {
      send(channel, message)

      expect(queueModule.queue).toHaveBeenCalledWith(channel, message)
    })

    it('sends nothing when queueing is enabled', () => {
      send(channel, message)

      expect(sendActionModule.sendAction).not.toHaveBeenCalled()
    })

    it('throws when queueing is disabled', () => {
      state = { ...state, queueMessages: false }

      expect(() => send(channel, message)).toThrow('Cannot send message. Channel test-channel is not open.')
    })

    it('validates the message type before queueing', () => {
      expect(() => send(channel, foreign)).toThrow(notEmitted('UNAUTHORIZED_ACTION'))
    })

    it('queues nothing for a message type outside the emitted actions', () => {
      expect(() => send(channel, foreign)).toThrow()
      expect(queueModule.queue).not.toHaveBeenCalled()
    })
  })

  describe('while a polite close is in flight', () => {
    beforeEach(() => {
      state = { ...state, closingProcessId: 'close-1' }
    })

    it('queues the message when queueing is enabled', () => {
      send(channel, message)

      expect(queueModule.queue).toHaveBeenCalledWith(channel, message)
    })

    it('sends nothing until the close settles', () => {
      send(channel, message)

      expect(sendActionModule.sendAction).not.toHaveBeenCalled()
    })

    it('throws when queueing is disabled', () => {
      state = { ...state, queueMessages: false }

      expect(() => send(channel, message)).toThrow('Cannot send message. Channel test-channel is not open.')
    })
  })
})
