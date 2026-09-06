import type { MessageHandler, ChannelState } from '../../types/channel'
import type { ChannelInternals } from '../types'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createInitialState } from '../state/initial'
import { subscribeToMessages } from './messages'

describe('channel/subscription/messages', () => {
  const nonFunctions: readonly [string, unknown][] = [
    ['null', null],
    ['undefined', undefined],
    ['a string', 'not a function'],
  ]

  let state: ChannelState
  let channel: ChannelInternals

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

  it('registers the handler as-is', () => {
    const handler: MessageHandler = jest.fn()

    subscribeToMessages(channel, handler)

    expect(state.messageSubscriptions).toEqual([handler])
  })

  it('keeps handlers in subscription order', () => {
    const first: MessageHandler = jest.fn()
    const second: MessageHandler = jest.fn()
    const third: MessageHandler = jest.fn()

    subscribeToMessages(channel, first)
    subscribeToMessages(channel, second)
    subscribeToMessages(channel, third)

    expect(state.messageSubscriptions).toEqual([first, second, third])
  })

  it('leaves event subscriptions untouched', () => {
    subscribeToMessages(channel, jest.fn())

    expect(state.eventSubscriptions).toEqual([])
  })

  it('returns an unsubscribe function', () => {
    expect(subscribeToMessages(channel, jest.fn())).toEqual(expect.any(Function))
  })

  it('removes the handler on unsubscribe', () => {
    const unsubscribe = subscribeToMessages(channel, jest.fn())

    unsubscribe()

    expect(state.messageSubscriptions).toEqual([])
  })

  it('removes only the unsubscribed handler', () => {
    const first: MessageHandler = jest.fn()
    const second: MessageHandler = jest.fn()
    const third: MessageHandler = jest.fn()
    subscribeToMessages(channel, first)
    const unsubscribeSecond = subscribeToMessages(channel, second)
    subscribeToMessages(channel, third)

    unsubscribeSecond()

    expect(state.messageSubscriptions).toEqual([first, third])
  })

  it('tolerates a second unsubscribe', () => {
    const unsubscribe = subscribeToMessages(channel, jest.fn())
    unsubscribe()

    unsubscribe()

    expect(state.messageSubscriptions).toEqual([])
  })

  it('keeps other handlers across a second unsubscribe', () => {
    const survivor: MessageHandler = jest.fn()
    const unsubscribe = subscribeToMessages(channel, jest.fn())
    unsubscribe()
    subscribeToMessages(channel, survivor)

    unsubscribe()

    expect(state.messageSubscriptions).toEqual([survivor])
  })

  it.each(nonFunctions)('throws when the handler is %s', (_label: string, handler: unknown) => {
    expect(() => subscribeToMessages(channel, handler as MessageHandler)).toThrow('Expected callback function.')
  })

  it('registers nothing when the handler is invalid', () => {
    expect(() => subscribeToMessages(channel, null as unknown as MessageHandler)).toThrow()
    expect(state.messageSubscriptions).toEqual([])
  })
})
