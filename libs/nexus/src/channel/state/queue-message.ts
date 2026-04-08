import type { ChannelState } from '../../types/channel'
import type { IMessage } from '../../types/message'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Adds a message to the channel's queue.
 * Returns a new state object with the message appended (immutable update).
 *
 * @param state - Current channel state
 * @param message - Message to queue
 * @returns New state with message added to queue
 *
 * @example
 * ```typescript
 * const message = { type: 'data', payload: { userId: 123 } }
 * const updatedState = queueMessage(channelState, message)
 * // => { ...channelState, queuedMessages: [...existingMessages, message] }
 * ```
 */
export function queueMessage(state: ChannelState, message: IMessage): ChannelState {
  return freeze(<ChannelState>{
    ...state,
    queuedMessages: freeze([...state.queuedMessages, message]),
  })
}
