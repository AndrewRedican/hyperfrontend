import type { ChannelInternals } from '../types'
import type { IMessage } from '../../types/message'
import { queue } from './queue'
import { sendAction } from './send-action'

/**
 * Sends a typed message through an active channel.
 *
 * - If channel is closed and queueMessages is enabled, queues the message
 * - If channel is closed and queueMessages is disabled, throws error
 * - If channel is open, validates message type against contract and sends
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

  // Queue message if channel is closed
  if (!state.active) {
    if (state.queueMessages) {
      queue(channel, message)
      return
    }
    throw new Error(`Cannot send message. Channel ${state.name} is not open.`)
  }

  // Validate message type against contract (check what we can emit)
  const emittedTypes = state.contract?.emitted.map((a) => a.type) ?? []
  if (!emittedTypes.includes(message.type)) {
    throw new Error(
      `Cannot send message to ${state.name} channel. Message type '${message.type}' is not in the emitted actions of channel contract.`
    )
  }

  // Send as NEW_MESSAGE action
  const action = channel.actions.newMessage(message.data)
  sendAction(channel, action)

  // Notify message subscribers on sender side too
  channel.notifyMessage(message)
}
