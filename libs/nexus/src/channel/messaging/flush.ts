import type { ChannelInternals } from '../types'
import { clearQueue } from '../state/clear-queue'
import { send } from './send'

/**
 * Sends all queued messages and clears the queue.
 *
 * Called automatically when a channel opens if queueMessages is enabled.
 * Messages are sent in FIFO order.
 *
 * @param channel - Channel internals with state and dependencies
 *
 * @example
 * ```typescript
 * flush(channel) // Sends all queued messages
 * ```
 */
export function flush(channel: ChannelInternals): void {
  const state = channel.getState()

  // Send each queued message
  for (const message of state.queuedMessages) {
    try {
      send(channel, message)
    } catch (error) {
      // Continue flushing even if one message fails
      if (state.logger) {
        state.logger.error('Failed to send queued message:', <Error>error)
      }
    }
  }

  // Clear the queue
  const newState = clearQueue(state)
  channel.updateState(newState)
}
