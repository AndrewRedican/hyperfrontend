import type { ReceiveFn } from '../../receiver/model'
import type { SendFn } from '../../sender/model'
import type { ChannelOptions, Channel } from '../model'
import { createReceiver } from '../../receiver/creators/create-receiver'
import { createSender } from '../../sender/creators/create-sender'
import { protocol, protocolProvider, receive, send, session } from '../mocks'
import { createChannelFactory } from './create-channel'
import { createChannelStoreFactory } from './create-channel-store'

/** Mock channel factory for testing */
export const mockCreateChannel = createChannelFactory(createSender, createReceiver)
/** Mock channel store factory for testing */
export const mockCreateChannelStore = createChannelStoreFactory(mockCreateChannel)

/** Mock channel label */
export const label = 'channel-label'

/** Options that build a channel over the mock protocol */
export const options: ChannelOptions = { send, receive, protocolProvider, session }

/**
 * Mock stop function.
 *
 * @returns void
 *
 * @example Calling mock stop
 * ```typescript
 * stop() // no-op for testing
 * ```
 */
export const stop = () => void 0

/**
 * Mock resume function.
 *
 * @returns void
 *
 * @example Calling mock resume
 * ```typescript
 * resume() // no-op for testing
 * ```
 */
export const resume = () => void 0

export const queue = { size: 10 }

/**
 * A channel-level send that accepts anything and does nothing.
 *
 * @returns void
 *
 * @example Standing in for a channel's send
 * ```typescript
 * sendMessage(origin, target, data) // does nothing
 * ```
 */
export const sendMessage: SendFn = () => void 0

/**
 * A channel-level receive that accepts anything and does nothing.
 *
 * @returns void
 *
 * @example Standing in for a channel's receive
 * ```typescript
 * receiveFrame(frame) // does nothing
 * ```
 */
export const receiveFrame: ReceiveFn = () => void 0

export const channel: Channel = {
  label,
  send: sendMessage,
  receive: receiveFrame,
  hello: protocol.hello,
  isHello: protocol.isHello,
  acceptHello: protocol.acceptHello,
  outbound: { queue: { ...queue }, stop, resume },
  inbound: { queue: { ...queue }, stop, resume },
  stop,
  resume,
}
