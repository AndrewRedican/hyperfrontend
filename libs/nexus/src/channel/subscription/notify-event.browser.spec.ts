import type { Logger } from '@hyperfrontend/logging'
import type { Mock } from '@hyperfrontend/testing'
import type { EventHandler, ChannelState } from '../../types/channel'
import type { ChannelEvent } from '../../types/events'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { notifyEvent } from './notify-event'

describe('channel/subscription/notify-event', () => {
  const events: readonly ChannelEvent[] = [
    'open',
    'closing',
    'close',
    'cancel',
    'deny',
    'invalid',
    'connect-timeout',
    'security-ready',
    'security-error',
  ]
  const contract = { accepted: [{ type: 'PING' }], emitted: [{ type: 'PONG' }] }
  const peerContract = { accepted: [{ type: 'PONG' }], emitted: [{ type: 'PING' }] }

  let state: ChannelState
  let channel: ChannelInternals
  let logger: Logger

  beforeEach(() => {
    logger = { debug: jest.fn(), error: jest.fn() } as unknown as Logger

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

  it('calls every subscriber with the event and its data', () => {
    const handlers: Mock[] = [jest.fn(), jest.fn(), jest.fn()]
    state = { ...state, eventSubscriptions: handlers }

    notifyEvent(channel, 'open', { timestamp: 123 })

    expect(handlers.map((handler) => handler.mock.calls)).toEqual([
      [['open', { timestamp: 123 }, expect.any(Object)]],
      [['open', { timestamp: 123 }, expect.any(Object)]],
      [['open', { timestamp: 123 }, expect.any(Object)]],
    ])
  })

  it('passes undefined data when the event carries none', () => {
    const handler: EventHandler = jest.fn()
    state = { ...state, eventSubscriptions: [handler] }

    notifyEvent(channel, 'close')

    expect(handler).toHaveBeenCalledWith('close', undefined, expect.any(Object))
  })

  it('hands subscribers a snapshot of the channel', () => {
    const handler: EventHandler = jest.fn()
    state = {
      ...state,
      eventSubscriptions: [handler],
      active: true,
      origin: 'https://peer.example.com',
      connectTimestamp: 1234,
      contract,
      peerContract,
      peerId: 'peer-1',
      queuedMessages: [{ type: 'PONG' }, { type: 'PONG' }],
    }

    notifyEvent(channel, 'open')

    expect(handler).toHaveBeenCalledWith('open', undefined, {
      id: state.id,
      name: 'test-channel',
      active: true,
      origin: 'https://peer.example.com',
      connectTimestamp: 1234,
      contract,
      peerContract,
      peerId: 'peer-1',
      queuedMessagesCount: 2,
    })
  })

  it('logs the event at debug level', () => {
    notifyEvent(channel, 'deny', { reason: 'policy-rejected' })

    expect(logger.debug).toHaveBeenCalledWith('Channel event:', 'deny', { reason: 'policy-rejected' })
  })

  it('logs the event before notifying subscribers', () => {
    const handler: Mock = jest.fn()
    state = { ...state, eventSubscriptions: [handler] }

    notifyEvent(channel, 'open')

    expect((logger.debug as Mock).mock.invocationCallOrder[0]).toBeLessThan(handler.mock.invocationCallOrder[0] ?? 0)
  })

  it('notifies subscribers when the channel has no logger', () => {
    const handler: EventHandler = jest.fn()
    state = { ...state, logger: null, eventSubscriptions: [handler] }

    notifyEvent(channel, 'open')

    expect(handler).toHaveBeenCalledWith('open', undefined, expect.any(Object))
  })

  it('does nothing without subscribers', () => {
    expect(() => notifyEvent(channel, 'open')).not.toThrow()
  })

  it.each(events)('delivers the %s event', (event: ChannelEvent) => {
    const handler: EventHandler = jest.fn()
    state = { ...state, eventSubscriptions: [handler] }

    notifyEvent(channel, event)

    expect(handler).toHaveBeenCalledWith(event, undefined, expect.any(Object))
  })

  describe('when a subscriber throws', () => {
    let before: EventHandler
    let after: EventHandler

    beforeEach(() => {
      before = jest.fn()
      after = jest.fn()
      const failing: EventHandler = () => {
        throw createError('Handler failed')
      }
      state = { ...state, eventSubscriptions: [before, failing, after] }
    })

    it('keeps notifying the remaining subscribers', () => {
      notifyEvent(channel, 'open')

      expect(after).toHaveBeenCalledWith('open', undefined, expect.any(Object))
    })

    it('logs the failure', () => {
      notifyEvent(channel, 'open')

      expect(logger.error).toHaveBeenCalledWith(
        "Error in event handler for 'open' event:",
        expect.objectContaining({ message: 'Handler failed' })
      )
    })

    it('keeps notifying the remaining subscribers when the channel has no logger', () => {
      state = { ...state, logger: null }

      notifyEvent(channel, 'open')

      expect(after).toHaveBeenCalledWith('open', undefined, expect.any(Object))
    })
  })
})
