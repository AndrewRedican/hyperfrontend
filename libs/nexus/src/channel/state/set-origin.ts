import type { ChannelState } from '../../types/channel'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Sets the origin for a channel.
 * Returns a new state object (immutable update).
 *
 * @param state - Current channel state
 * @param origin - Origin to set
 * @returns New state with origin updated
 *
 * @example Setting the channel origin
 * ```typescript
 * const updatedState = setOrigin(channelState, 'https://example.com')
 * // => { ...channelState, origin: 'https://example.com' }
 * ```
 */
export function setOrigin(state: ChannelState, origin: string): ChannelState {
  return freeze(<ChannelState>{
    ...state,
    origin,
  })
}
