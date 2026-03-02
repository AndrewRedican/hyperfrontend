import type { ChannelState } from '../../types/channel'
import type { IChannelContract } from '../../types/contract'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Activates a channel by setting it as active and recording connection details.
 * Returns a new state object (immutable update).
 *
 * @param state - Current channel state
 * @param origin - Origin of the connected channel
 * @param contract - Negotiated channel contract
 * @returns New state with channel activated
 */
export function activate(state: ChannelState, origin: string, contract: IChannelContract): ChannelState {
  const acceptedActions = (contract.accepted || []).map((action) => action.type)

  return freeze(<ChannelState>{
    ...state,
    origin,
    active: true,
    connectTimestamp: Date.now(),
    contract,
    acceptedActions: freeze(acceptedActions),
    scheduledActivation: null, // Clear any pending activation
  })
}
