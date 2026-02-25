import type { ChannelState } from '../../types/channel'

/**
 * Sets the origin for a channel.
 * Returns a new state object (immutable update).
 *
 * @param state - Current channel state
 * @param origin - Origin to set
 * @returns New state with origin updated
 */
export function setOrigin(state: ChannelState, origin: string): ChannelState {
  return {
    ...state,
    origin,
  }
}
