import type { ChannelInternals } from '../types'
import { flush } from '../messaging/flush'
import { activate } from '../state/activate'
import { clearHandshakeTimers } from './handshake-timers'

/**
 * Completes the handshake on the responder side when OPEN arrives.
 *
 * Activates the channel from the pending activation recorded when ACCEPT
 * was sent, clears the handshake timers, and flushes the outbound queue.
 *
 * @param channel - Channel internals with state and dependencies
 * @returns True when the channel was activated; false when no activation is
 * pending (stale or duplicate OPEN), in which case nothing changes
 *
 * @example Handling the final handshake message
 * ```typescript
 * if (completeScheduledOpen(channel)) {
 *   channel.notifyEvent('open', { origin })
 * }
 * ```
 */
export function completeScheduledOpen(channel: ChannelInternals): boolean {
  const state = channel.getState()
  const activation = state.pendingAccept

  if (!activation) {
    return false
  }

  clearHandshakeTimers(channel)
  const [senderId, origin, contract] = activation
  channel.updateState(activate(channel.getState(), origin, contract, senderId))
  flush(channel)
  return true
}
