import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { ChannelState } from '../../types/channel'
import type { IMessage } from '../../types/message'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as clearQueueModule from '../state/clear-queue'
import { createInitialState } from '../state/initial'
import { flush } from './flush'
import * as sendModule from './send'

jest.mock('./send')
jest.mock('../state/clear-queue')

describe('channel/messaging/flush', () => {
  const clearQueue = clearQueueModule.clearQueue as Mock
  const send = sendModule.send as Mock
  const messages: IMessage[] = [
    { type: 'MESSAGE_1', data: { id: 1 } },
    { type: 'MESSAGE_2', data: { id: 2 } },
    { type: 'MESSAGE_3', data: { id: 3 } },
  ]

  let state: ChannelState
  let channel: ChannelInternals
  let logger: Logger

  beforeEach(() => {
    jest.clearAllMocks()

    logger = { error: jest.fn() } as unknown as Logger

    state = {
      ...createInitialState('test-channel', window, { logger }),
      active: true,
      queuedMessages: messages,
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
    clearQueue.mockImplementation((current: ChannelState) => ({ ...current, queuedMessages: [] }))
  })

  it('sends every queued message in FIFO order', () => {
    flush(channel)

    expect(send.mock.calls).toEqual([
      [channel, messages[0]],
      [channel, messages[1]],
      [channel, messages[2]],
    ])
  })

  it('derives the cleared state from the current state', () => {
    flush(channel)

    expect(clearQueue).toHaveBeenCalledWith(state)
  })

  it('stores the cleared queue on the channel', () => {
    flush(channel)

    expect(channel.updateState).toHaveBeenCalledWith({ ...state, queuedMessages: [] })
  })

  it('clears the queue before re-sending so a message re-queued during the pass survives', () => {
    flush(channel)

    expect((channel.updateState as Mock).mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0] ?? 0)
  })

  it('sends nothing when the queue is empty', () => {
    state = { ...state, queuedMessages: [] }

    flush(channel)

    expect(send).not.toHaveBeenCalled()
  })

  it('still clears the queue when it is empty', () => {
    state = { ...state, queuedMessages: [] }

    flush(channel)

    expect(clearQueue).toHaveBeenCalledWith(state)
  })

  describe('when a message fails to send', () => {
    beforeEach(() => {
      send.mockImplementation((_channel: ChannelInternals, message: IMessage) => {
        if (message.type === 'MESSAGE_2') {
          throw createError('Send failed')
        }
      })
    })

    it('keeps sending the remaining messages', () => {
      flush(channel)

      expect(send).toHaveBeenCalledTimes(3)
    })

    it('logs the failure', () => {
      flush(channel)

      expect(logger.error).toHaveBeenCalledWith('Failed to send queued message:', expect.objectContaining({ message: 'Send failed' }))
    })

    it('keeps sending the remaining messages when the channel has no logger', () => {
      state = { ...state, logger: null }

      flush(channel)

      expect(send).toHaveBeenCalledTimes(3)
    })
  })
})
