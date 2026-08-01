import type { IAction } from '../../types/action'
import type { IChannelContract } from '../../types/contract'
import type { ChannelInternals } from '../types'
import { flush } from '../messaging/flush'
import { activate } from '../state/activate'
import { clearHandshakeTimers } from './handshake-timers'

/**
 * Completes the handshake on the initiator side after ACCEPT is verified.
 *
 * Clears the handshake timers, activates the channel with the counterpart's
 * details (the channel's own contract stays the validation authority), sends
 * the reply action (OPEN), and flushes the outbound queue.
 *
 * @param channel - Channel internals with state and dependencies
 * @param origin - Origin to pin, learned from the authentic ACCEPT event
 * @param peerContract - Contract declared by the counterpart
 * @param peerId - Broker id of the counterpart
 * @param replyAction - Composed OPEN action confirming the connection
 *
 * @example Completing the handshake after ACCEPT
 * ```typescript
 * completeConnection(channel, event.origin, action.contract, action.senderId, openAction)
 * ```
 */
export function completeConnection(
  channel: ChannelInternals,
  origin: string,
  peerContract: IChannelContract,
  peerId: string,
  replyAction: IAction
): void {
  clearHandshakeTimers(channel)
  channel.updateState(activate(channel.getState(), origin, peerContract, peerId))
  channel.sendAction(replyAction)
  flush(channel)
}
