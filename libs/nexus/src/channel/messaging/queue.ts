import type { ChannelInternals } from '../types'
import type { IMessage } from '../../types/message'
import { queueMessage } from '../state/queue-message'

/**
 * Queues a message for delivery when the channel opens.
 *
 * Messages are stored in the channel state and will be sent
 * automatically when the channel becomes active via the flush operation.
 *
 * @param channel - Channel internals with state and dependencies
 * @param message - Message to queue
 *
 * @example
 * ```typescript
 * queue(channel, { type: 'GREETING', data: 'Hello' })
 * ```
 */
export function queue(channel: ChannelInternals, message: IMessage): void {
  const state = channel.getState()
  const newState = queueMessage(state, message)
  channel.updateState(newState)
}
