import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { MessageHandler, ChannelState } from '../../types/channel'
import type { IMessage } from '../../types/message'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { notifyMessage } from './notify-message'

describe('channel/subscription/notify-message', () => {
  const message: IMessage = { type: 'USER_ACTION', data: { userId: 123 } }
  const payloads: readonly IMessage[] = [
    { type: 'STRING_DATA', data: 'hello' },
    { type: 'NUMBER_DATA', data: 42 },
    { type: 'OBJECT_DATA', data: { key: 'value' } },
    { type: 'ARRAY_DATA', data: [1, 2, 3] },
    { type: 'NO_DATA' },
  ]

  let state: ChannelState
  let channel: ChannelInternals
  let logger: Logger

  beforeEach(() => {
    logger = { error: jest.fn() } as unknown as Logger

    state = createInitialState('test-channel', window, { logger })

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

  it('calls every subscriber with the message', () => {
    const handlers: Mock[] = [jest.fn(), jest.fn(), jest.fn()]
    state = { ...state, messageSubscriptions: handlers }

    notifyMessage(channel, message)

    expect(handlers.map((handler) => handler.mock.calls)).toEqual([[[message]], [[message]], [[message]]])
  })

  it('does nothing without subscribers', () => {
    expect(() => notifyMessage(channel, message)).not.toThrow()
  })

  it('leaves event subscribers alone', () => {
    const eventHandler = jest.fn()
    state = { ...state, eventSubscriptions: [eventHandler] }

    notifyMessage(channel, message)

    expect(eventHandler).not.toHaveBeenCalled()
  })

  it.each(payloads)('delivers %p unchanged', (payload: IMessage) => {
    const handler: MessageHandler = jest.fn()
    state = { ...state, messageSubscriptions: [handler] }

    notifyMessage(channel, payload)

    expect(handler).toHaveBeenCalledWith(payload)
  })

  describe('when a subscriber throws', () => {
    let after: MessageHandler

    beforeEach(() => {
      after = jest.fn()
      const failing: MessageHandler = () => {
        throw createError('Handler failed')
      }
      state = { ...state, messageSubscriptions: [jest.fn(), failing, after] }
    })

    it('keeps notifying the remaining subscribers', () => {
      notifyMessage(channel, message)

      expect(after).toHaveBeenCalledWith(message)
    })

    it('logs the failure', () => {
      notifyMessage(channel, message)

      expect(logger.error).toHaveBeenCalledWith(
        "Error in message handler for 'USER_ACTION' message:",
        expect.objectContaining({ message: 'Handler failed' })
      )
    })

    it('keeps notifying the remaining subscribers when the channel has no logger', () => {
      state = { ...state, logger: null }

      notifyMessage(channel, message)

      expect(after).toHaveBeenCalledWith(message)
    })
  })
})
