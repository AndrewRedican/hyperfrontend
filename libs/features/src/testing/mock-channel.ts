import type { ChannelHandle, IMessage } from '@hyperfrontend/nexus'
import type { DeepMocked, MockedFunction } from '@hyperfrontend/testing'
import { createMock } from '@hyperfrontend/testing'

// note: the host and hostee lifecycle specs drive a session through this one fake channel instead of each declaring its own listener registry.

/**
 * A channel lifecycle listener as the lifecycles register it.
 */
type ChannelListener = (data?: unknown) => void

/**
 * A user-message handler as the lifecycles register it.
 */
type ChannelMessageHandler = (message: IMessage) => void

/**
 * A fake nexus channel whose events and messages a spec fires by hand.
 */
export type MockChannel = {
  /** The channel to hand to the code under test; every member it lacks is a mock. */
  channel: DeepMocked<ChannelHandle>
  /** Fires a lifecycle event at every listener registered for it through `channel.on`. */
  trigger(event: string, data?: unknown): void
  /** Delivers a user message to every handler registered through `channel.onMessage`. */
  triggerMessage(type: string, data?: unknown): void
  /** The channel's `send` mock. */
  send: MockedFunction<ChannelHandle['send']>
  /** The channel's `disconnect` mock. */
  disconnect: MockedFunction<ChannelHandle['disconnect']>
  /** The channel's `destroy` mock. */
  destroy: MockedFunction<ChannelHandle['destroy']>
  /** The channel's `connect` mock. */
  connect: MockedFunction<ChannelHandle['connect']>
}

/**
 * Creates a fake channel that records listeners and lets the spec fire them.
 *
 * @returns The channel together with its trigger functions and the mocks specs assert on.
 *
 * @example Opening a session by hand
 * ```typescript
 * const mock = createMockChannel()
 * broker.addChannel.mockReturnValue(mock.channel)
 * mock.trigger('open', { origin: 'https://feature.example' })
 * expect(mock.send).toHaveBeenCalled()
 * ```
 */
export function createMockChannel(): MockChannel {
  const listeners: Record<string, ChannelListener[]> = {}
  const messageHandlers: ChannelMessageHandler[] = []
  const on = (event: string, handler: ChannelListener): (() => void) => {
    ;(listeners[event] ?? (listeners[event] = [])).push(handler)
    return () => undefined
  }
  const onMessage = (handler: ChannelMessageHandler): (() => void) => {
    messageHandlers.push(handler)
    return () => undefined
  }
  // how: `on` is overloaded on the channel, so the single listener-registry signature is narrowed to it here.
  const channel = createMock<ChannelHandle>({ on: on as ChannelHandle['on'], onMessage })
  return {
    channel,
    trigger: (event, data) => listeners[event]?.forEach((handler) => handler(data)),
    triggerMessage: (type, data) => messageHandlers.forEach((handler) => handler({ type, data })),
    send: channel.send,
    disconnect: channel.disconnect,
    destroy: channel.destroy,
    connect: channel.connect,
  }
}
