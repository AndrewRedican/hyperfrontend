import type { ChannelInternals } from '../types'
import { clearHandshakeTimers } from './handshake-timers'

/**
 * Gracefully closes an active channel connection.
 *
 * - Only works if channel is currently active
 * - Sets channel state to inactive
 * - Optionally notifies the target window
 * - Detaches the security transport and clears the negotiated protocol so a
 *   later handshake starts from a clean security state
 * - Fires 'close' event to subscribers
 *
 * @param channel - Channel internals with state and dependencies
 * @param notify - Whether to notify target window (default: true)
 *
 * @example Gracefully closing a connection
 * ```typescript
 * disconnect(channel, true) // Close and notify target
 * disconnect(channel, false) // Close silently
 * ```
 */
export function disconnect(channel: ChannelInternals, notify = true): void {
  const state = channel.getState()

  if (!state.active) {
    return
  }

  clearHandshakeTimers(channel)
  channel.updateState({ active: false, pendingProcessId: null, pendingAccept: null })

  if (notify) {
    const processId = channel.createProcess()
    const closeAction = channel.actions.closeConnection(processId)
    channel.sendAction(closeAction)
  }

  // why: The next handshake renegotiates security from scratch; a transport kept across connections would encrypt to a peer that may no longer decrypt.
  channel.updateState({
    negotiatedProtocol: null,
    securityReady: false,
    securityTransport: null,
    pendingSecurityRequest: null,
  })

  channel.notifyEvent('close')
}
