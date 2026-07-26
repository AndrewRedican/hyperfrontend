import type { IAction } from '../../types/action'
import type { ScheduledActivation } from '../../types/channel'
import type { ChannelInternals } from '../types'
import { expireHandshake, startHandshakeTimers } from './handshake-timers'

/**
 * Answers an inbound connection request as the responder.
 *
 * Pins the origin learned from the request, records the counterpart's
 * contract and id, stores the pending activation for the coming OPEN,
 * sends ACCEPT, and re-sends it until OPEN arrives or the connection
 * deadline expires.
 *
 * @param channel - Channel internals with state and dependencies
 * @param activation - Connection data from the request: [senderId, origin, contract, processId]
 * @param acceptAction - Composed ACCEPT action to send and replay
 *
 * @example Responding to a connection request
 * ```typescript
 * beginResponse(channel, [senderId, event.origin, contract, processId], acceptAction)
 * ```
 */
export function beginResponse(channel: ChannelInternals, activation: ScheduledActivation, acceptAction: IAction): void {
  const [senderId, origin, contract, processId] = activation

  channel.updateState({
    origin,
    peerContract: contract,
    peerId: senderId,
    scheduledActivation: null,
    pendingAccept: activation,
  })

  // why: Timers start before the send so a synchronously delivered OPEN finds them registered and clears them.
  startHandshakeTimers(channel, acceptAction, () => expireHandshake(channel, processId))
  channel.sendAction(acceptAction)
}
