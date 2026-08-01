import type { ChannelState } from '../../types/channel'
import type { IChannelContract } from '../../types/contract'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Activates a channel by setting it as active and recording connection details.
 * Returns a new state object (immutable update).
 *
 * The channel's own contract stays in place as the validation authority:
 * accepted action types are derived from the own contract's `accepted` list,
 * while the counterpart's contract is stored separately as `peerContract`.
 * All pending handshake state is cleared.
 *
 * @param state - Current channel state
 * @param origin - Origin of the connected counterpart
 * @param peerContract - Contract declared by the connected counterpart
 * @param peerId - Broker id of the connected counterpart
 * @returns New state with channel activated
 *
 * @example Activating a channel after the handshake completes
 * ```typescript
 * const activeState = activate(channelState, 'https://example.com', peerContract, peerId)
 * // => { ...channelState, active: true, origin: 'https://example.com', ... }
 * ```
 */
export function activate(state: ChannelState, origin: string, peerContract: IChannelContract, peerId: string | null): ChannelState {
  const acceptedActions = (state.contract?.accepted || []).map((action) => action.type)

  return freeze(<ChannelState>{
    ...state,
    origin,
    active: true,
    connectTimestamp: dateNow(),
    peerContract,
    peerId,
    acceptedActions: freeze(acceptedActions),
    scheduledActivation: null,
    pendingAccept: null,
    pendingProcessId: null,
    retryTimer: null,
    deadlineTimer: null,
  })
}
