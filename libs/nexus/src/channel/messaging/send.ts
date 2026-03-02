import type { IMessage } from '../../types/message'
import type { ChannelInternals } from '../types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { queue } from './queue'
import { sendAction } from './send-action'

/**
 * Sends a typed message through an active channel.
 *
 * Message routing behavior:
 * - If channel is closed and queueMessages is enabled, queues the message
 * - If channel is closed and queueMessages is disabled, throws error
 * - If security transport exists but is not ready, queues the message
 * - If channel is open and security is ready (or protocol is 'none'), sends message
 *
 * For secure protocols (v1/v2), the message is routed through the security
 * transport which encrypts and sends as Uint8Array via postMessage.
 *
 * @param channel - Channel internals with state and dependencies
 * @param message - Message to send with type and data
 *
 * @throws {Error} If channel is closed and queueing is disabled
 * @throws {Error} If message type is not accepted in channel contract
 *
 * @example
 * ```typescript
 * send(channel, { type: 'USER_ACTION', data: { userId: 123 } })
 * ```
 */
export function send(channel: ChannelInternals, message: IMessage): void {
  const state = channel.getState()

  if (!state.active) {
    if (state.queueMessages) {
      queue(channel, message)
      return
    }
    throw createError(`Cannot send message. Channel ${state.name} is not open.`)
  }

  const securityTransport = state.securityTransport
  const negotiatedProtocol = state.negotiatedProtocol

  if (securityTransport && negotiatedProtocol !== 'none' && !securityTransport.isReady()) {
    if (state.queueMessages) {
      queue(channel, message)
      return
    }
    throw createError(`Cannot send message. Security transport for channel ${state.name} is not ready.`)
  }

  const emittedTypes = state.contract?.emitted.map((a) => a.type) ?? []
  if (!emittedTypes.includes(message.type)) {
    throw createError(
      `Cannot send message to ${state.name} channel. Message type '${message.type}' is not in the emitted actions of channel contract.`
    )
  }

  const action = channel.actions.newMessage(message.data)
  sendAction(channel, action)

  channel.notifyMessage(message)
}
