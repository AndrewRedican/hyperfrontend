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
 * @example Flushing queued messages
 * ```typescript
 * flush(channel) // Sends all queued messages
 * ```
 */
export function flush(channel: ChannelInternals): void {
  const state = channel.getState()
  const pending = state.queuedMessages

  // why: The queue is cleared before re-sending so messages a not-ready security transport re-queues during this pass survive for the next flush.
  channel.updateState(clearQueue(state))

  for (const message of pending) {
    try {
      send(channel, message)
    } catch (error) {
      if (state.logger) {
        state.logger.error('Failed to send queued message:', error as Error)
      }
    }
  }
}
