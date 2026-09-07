import type { Mock } from '@hyperfrontend/testing'
import type { EventHandler, ChannelJSON, ChannelState } from '../../types/channel'
import type { CancelCallback, CloseCallback, OpenCallback, OpenEventData } from '../../types/events'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { subscribeToEvents } from './events'

describe('channel/subscription/events', () => {
  const channelJSON: ChannelJSON = {
    id: 'channel-123',
    name: 'test-channel',
    active: false,
    origin: null,
    connectTimestamp: null,
    contract: null,
    peerContract: null,
    peerId: null,
    queuedMessagesCount: 0,
  }
  const openData: OpenEventData = { origin: 'http://test.com', contract: { emitted: [], accepted: [] } }
  const nonFunctions: readonly [string, unknown][] = [
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not a function'],
  ]

  let state: ChannelState
  let channel: ChannelInternals

  const subscription = (index: number): EventHandler => {
    const handler = state.eventSubscriptions[index]
    if (handler === undefined) {
      throw createError(`no subscription at index ${index}`)
    }
    return handler
  }

  beforeEach(() => {
    state = createInitialState('test-channel', window, {})

    channel = {
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
    }
  })

  describe('generic subscriptions', () => {
    it('registers the handler as-is', () => {
      const handler: EventHandler = jest.fn()

      subscribeToEvents(channel, handler)

      expect(state.eventSubscriptions).toEqual([handler])
    })

    it('keeps handlers in subscription order', () => {
      const first: EventHandler = jest.fn()
      const second: EventHandler = jest.fn()
      const third: EventHandler = jest.fn()

      subscribeToEvents(channel, first)
      subscribeToEvents(channel, second)
      subscribeToEvents(channel, third)

      expect(state.eventSubscriptions).toEqual([first, second, third])
    })

    it('returns an unsubscribe function', () => {
      expect(subscribeToEvents(channel, jest.fn())).toEqual(expect.any(Function))
    })

    it('removes the handler on unsubscribe', () => {
      const unsubscribe = subscribeToEvents(channel, jest.fn())

      unsubscribe()

      expect(state.eventSubscriptions).toEqual([])
    })

    it('removes only the unsubscribed handler', () => {
      const first: EventHandler = jest.fn()
      const second: EventHandler = jest.fn()
      const third: EventHandler = jest.fn()
      subscribeToEvents(channel, first)
      const unsubscribeSecond = subscribeToEvents(channel, second)
      subscribeToEvents(channel, third)

      unsubscribeSecond()

      expect(state.eventSubscriptions).toEqual([first, third])
    })

    it('tolerates a second unsubscribe', () => {
      const unsubscribe = subscribeToEvents(channel, jest.fn())
      unsubscribe()

      unsubscribe()

      expect(state.eventSubscriptions).toEqual([])
    })

    it('keeps other handlers across a second unsubscribe', () => {
      const survivor: EventHandler = jest.fn()
      const unsubscribe = subscribeToEvents(channel, jest.fn())
      unsubscribe()
      subscribeToEvents(channel, survivor)

      unsubscribe()

      expect(state.eventSubscriptions).toEqual([survivor])
    })

    it.each(nonFunctions)('throws when the handler is %s', (_label: string, handler: unknown) => {
      expect(() => subscribeToEvents(channel, handler as EventHandler)).toThrow('Expected callback function.')
    })
  })

  describe('event-specific subscriptions', () => {
    it('registers a wrapper rather than the callback itself', () => {
      const handler: OpenCallback = jest.fn()

      subscribeToEvents(channel, 'open', handler)

      expect(state.eventSubscriptions).toEqual([expect.any(Function)])
    })

    it('forwards the matching event data and channel snapshot', () => {
      const handler: OpenCallback = jest.fn()
      subscribeToEvents(channel, 'open', handler)

      subscription(0)('open', openData, channelJSON)

      expect(handler).toHaveBeenCalledWith(openData, channelJSON)
    })

    it('ignores other events', () => {
      const handler: OpenCallback = jest.fn()
      subscribeToEvents(channel, 'open', handler)

      subscription(0)('close', { notify: true }, channelJSON)

      expect(handler).not.toHaveBeenCalled()
    })

    it('routes each event to its own subscriber', () => {
      const onOpen: OpenCallback = jest.fn()
      const onClose: CloseCallback = jest.fn()
      subscribeToEvents(channel, 'open', onOpen)
      subscribeToEvents(channel, 'close', onClose)

      subscription(0)('close', { notify: true }, channelJSON)
      subscription(1)('close', { notify: true }, channelJSON)

      expect([(onOpen as unknown as Mock).mock.calls, (onClose as unknown as Mock).mock.calls]).toEqual([
        [],
        [[{ notify: true }, channelJSON]],
      ])
    })

    it('works with cancel events', () => {
      const handler: CancelCallback = jest.fn()
      subscribeToEvents(channel, 'cancel', handler)

      subscription(0)('cancel', { notify: false }, channelJSON)

      expect(handler).toHaveBeenCalledWith({ notify: false }, channelJSON)
    })

    it('supports several subscribers to the same event', () => {
      const first: OpenCallback = jest.fn()
      const second: OpenCallback = jest.fn()
      subscribeToEvents(channel, 'open', first)
      subscribeToEvents(channel, 'open', second)

      subscription(0)('open', openData, channelJSON)
      subscription(1)('open', openData, channelJSON)

      expect([(first as unknown as Mock).mock.calls, (second as unknown as Mock).mock.calls]).toEqual([
        [[openData, channelJSON]],
        [[openData, channelJSON]],
      ])
    })

    it('mixes with generic subscriptions', () => {
      const generic: EventHandler = jest.fn()
      const onOpen: OpenCallback = jest.fn()
      subscribeToEvents(channel, generic)
      subscribeToEvents(channel, 'open', onOpen)

      subscription(0)('open', openData, channelJSON)
      subscription(1)('open', openData, channelJSON)

      expect([(generic as unknown as Mock).mock.calls, (onOpen as unknown as Mock).mock.calls]).toEqual([
        [['open', openData, channelJSON]],
        [[openData, channelJSON]],
      ])
    })

    it('removes the wrapper on unsubscribe', () => {
      const unsubscribe = subscribeToEvents(channel, 'open', jest.fn())

      unsubscribe()

      expect(state.eventSubscriptions).toEqual([])
    })

    it.each(nonFunctions)('throws when the callback for an event is %s', (_label: string, handler: unknown) => {
      expect(() => subscribeToEvents(channel, 'open', handler as OpenCallback)).toThrow('Expected callback function.')
    })
  })
})
