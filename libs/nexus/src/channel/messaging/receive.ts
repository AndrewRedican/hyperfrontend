import type { IMessage } from '../../types/message'
import type { ChannelInternals } from '../types'

/**
 * Handles an incoming message from the target window.
 *
 * - Validates the message type against the channel contract
 * - Notifies all message subscribers with the message data
 *
 * @param channel - Channel internals with state and dependencies
 * @param message - Incoming message to handle
 *
 * @throws {Error} If message type is not provided in channel contract
 *
 * @example
 * ```typescript
 * receive(channel, { type: 'USER_ACTION', data: { userId: 123 } })
 * ```
 */
export function receive(channel: ChannelInternals, message: IMessage): void {
  const state = channel.getState()

  // Validate message type against contract (emitted actions)
  if (state.contract && !state.contract.emitted.some((a) => a.type === message.type)) {
    throw new Error(`Received message type '${message.type}' not emitted in ${state.name} channel contract.`)
  }

  // Notify all message subscribers
  channel.notifyMessage(message)
}
