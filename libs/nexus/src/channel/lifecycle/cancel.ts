import type { ChannelInternals } from '../types'
import { dropSecurityTransport } from '../security/drop'
import { disconnect } from './disconnect'
import { clearHandshakeTimers } from './handshake-timers'

/**
 * Cancels a pending connection request.
 *
 * - If channel is closed, sends CANCEL_CONNECTION
 * - If channel is already open, calls disconnect instead
 * - Drops the process of the request it abandons
 * - Fires the single 'cancel' event this side reports for the attempt,
 *   carrying whether the counterpart is the side that cancelled; the
 *   acknowledgement travelling either way fires nothing further
 *
 * @param channel - Channel internals with state and dependencies
 * @param notify - Whether to notify target window (default: true)
 * @param peerCancelled - Whether this cancellation came from a CANCEL frame the counterpart sent, which the broker passes as `true` when it answers one (default: false, meaning this side cancelled)
 *
 * @example Canceling a pending connection
 * ```typescript
 * cancel(channel, true) // Cancel and notify target
 * cancel(channel, false) // Cancel silently
 * ```
 */
export function cancel(channel: ChannelInternals, notify = true, peerCancelled = false): void {
  const state = channel.getState()

  if (state.active) {
    disconnect(channel, notify)
    return
  }

  clearHandshakeTimers(channel)
  dropSecurityTransport(channel)

  // why: The abandoned request stays routable until its process is dropped, so a late ACCEPT would still resolve to this channel.
  if (state.pendingProcessId !== null) {
    channel.removeProcess(state.pendingProcessId)
  }

  channel.updateState({ pendingProcessId: null, pendingAccept: null, scheduledActivation: null, negotiatedProtocol: null })

  if (notify) {
    const processId = channel.createProcess()
    const cancelAction = channel.actions.cancelConnection(processId)
    channel.sendAction(cancelAction)
  }

  // why: The one 'cancel' an attempt fires on this side comes from here, so the payload reports the only thing a subscriber cannot read off the channel itself: whether the counterpart is in on the cancellation or this side tore the attempt down alone.
  channel.notifyEvent('cancel', { notify: peerCancelled })
}
