import type { ChannelState, IMessage } from '../../types'

/**
 * Adds a message to the channel's queue.
 * Returns a new state object with the message appended (immutable update).
 *
 * @param state - Current channel state
 * @param message - Message to queue
 * @returns New state with message added to queue
 */
export function queueMessage(state: ChannelState, message: IMessage): ChannelState {
  return {
    ...state,
    queuedMessages: [...state.queuedMessages, message],
  }
}
