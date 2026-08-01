import type { ChannelInternals } from '../types'
import { clearHandshakeTimers } from './handshake-timers'

/**
 * Abandons the channel's own outstanding connection request.
 *
 * Clears the handshake timers and removes the pending process, leaving the
 * channel inactive and reconnectable. Used when yielding a glare tie-break
 * (both sides requested simultaneously) or when the counterpart rejects
 * the connection.
 *
 * @param channel - Channel internals with state and dependencies
 *
 * @example Yielding to a simultaneous inbound request
 * ```typescript
 * abandonRequest(channel) // stops retrying; the inbound request is answered instead
 * ```
 */
export function abandonRequest(channel: ChannelInternals): void {
  clearHandshakeTimers(channel)

  const state = channel.getState()
  if (state.pendingProcessId !== null) {
    channel.removeProcess(state.pendingProcessId)
    channel.updateState({ pendingProcessId: null })
  }
}
