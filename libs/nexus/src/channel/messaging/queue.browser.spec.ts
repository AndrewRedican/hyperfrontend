import type { Mock } from '@hyperfrontend/testing'
import type { ChannelState } from '../../types/channel'
import type { IMessage } from '../../types/message'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import * as queueMessageModule from '../state/queue-message'
import { queue } from './queue'

jest.mock('../state/queue-message')

describe('channel/messaging/queue', () => {
  const queueMessage = queueMessageModule.queueMessage as Mock
  const message: IMessage = { type: 'USER_ACTION', data: { userId: 123 } }

  let state: ChannelState
  let channel: ChannelInternals

  beforeEach(() => {
    jest.clearAllMocks()

    state = createInitialState('test-channel', window, {})

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
    queueMessage.mockImplementation((current: ChannelState, queued: IMessage) => ({
      ...current,
      queuedMessages: [...current.queuedMessages, queued],
    }))
  })

  it('derives the queued state from the current state and the message', () => {
    queue(channel, message)

    expect(queueMessage).toHaveBeenCalledWith(state, message)
  })

  it('stores the queued state on the channel', () => {
    queue(channel, message)

    expect(channel.updateState).toHaveBeenCalledWith({ ...state, queuedMessages: [message] })
  })
})
