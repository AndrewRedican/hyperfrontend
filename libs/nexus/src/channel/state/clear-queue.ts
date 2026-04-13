import type { ChannelState } from '../../types/channel'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Clears all queued messages from the channel.
 * Returns a new state object with empty queue (immutable update).
 *
 * @param state - Current channel state
 * @returns New state with cleared message queue
 *
 * @example Clearing all queued messages
 * ```typescript
 * const clearedState = clearQueue(channelState)
 * // => { ...channelState, queuedMessages: [] }
 * ```
 */
export function clearQueue(state: ChannelState): ChannelState {
  return freeze(<ChannelState>{
    ...state,
    queuedMessages: freeze([]),
  })
}
