import type { ChannelState } from '../../types'

/**
 * Clears all queued messages from the channel.
 * Returns a new state object with empty queue (immutable update).
 *
 * @param state - Current channel state
 * @returns New state with cleared message queue
 */
export function clearQueue(state: ChannelState): ChannelState {
  return {
    ...state,
    queuedMessages: [],
  }
}
