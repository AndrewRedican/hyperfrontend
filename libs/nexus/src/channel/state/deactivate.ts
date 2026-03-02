import type { ChannelState } from '../../types/channel'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Deactivates a channel by marking it as inactive.
 * Returns a new state object (immutable update).
 *
 * @param state - Current channel state
 * @returns New state with channel deactivated
 */
export function deactivate(state: ChannelState): ChannelState {
  return freeze(<ChannelState>{
    ...state,
    active: false,
  })
}
