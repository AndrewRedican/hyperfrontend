import type { ChannelState } from '../../types/channel'
import type { IChannelContract } from '../../types/contract'

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
  // Extract accepted action types from contract for quick lookup
  const acceptedActions = (contract.accepted || []).map((action) => action.type)

  return {
    ...state,
    origin,
    active: true,
    connectTimestamp: Date.now(),
    contract,
    acceptedActions,
    scheduledActivation: null, // Clear any pending activation
  }
}
