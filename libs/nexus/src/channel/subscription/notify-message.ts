import type { IMessage } from '../../types/message'
import type { ChannelInternals } from '../types'

/**
 * Notifies all message subscribers of an incoming message.
 *
 * Calls each subscribed message handler with the message data.
 * Errors in handlers are caught and logged to prevent breaking other handlers.
 *
 * @param channel - Channel internals with state and dependencies
 * @param message - Message that was received
 *
 * @example
 * ```typescript
 * notifyMessage(channel, { type: 'USER_ACTION', data: { userId: 123 } })
 * ```
 */
export function notifyMessage(channel: ChannelInternals, message: IMessage): void {
  const state = channel.getState()

  for (const handler of state.messageSubscriptions) {
    try {
      handler(message)
    } catch (error) {
      if (state.logger) {
        state.logger.error(`Error in message handler for '${message.type}' message:`, <Error>error)
      }
    }
  }
}
