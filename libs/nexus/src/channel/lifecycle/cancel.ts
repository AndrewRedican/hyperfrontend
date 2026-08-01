import type { ChannelInternals } from '../types'
import { disconnect } from './disconnect'
import { clearHandshakeTimers } from './handshake-timers'

/**
 * Cancels a pending connection request.
 *
 * - If channel is closed, sends CANCEL_CONNECTION
 * - If channel is already open, calls disconnect instead
 * - Fires 'cancel' event to subscribers
 *
 * @param channel - Channel internals with state and dependencies
 * @param notify - Whether to notify target window (default: true)
 *
 * @example Canceling a pending connection
 * ```typescript
 * cancel(channel, true) // Cancel and notify target
 * cancel(channel, false) // Cancel silently
 * ```
 */
export function cancel(channel: ChannelInternals, notify = true): void {
  const state = channel.getState()

  if (state.active) {
    disconnect(channel, notify)
    return
  }

  clearHandshakeTimers(channel)
  channel.updateState({ pendingProcessId: null, pendingAccept: null, scheduledActivation: null })

  if (notify) {
    const processId = channel.createProcess()
    const cancelAction = channel.actions.cancelConnection(processId)
    channel.sendAction(cancelAction)
  }

  channel.notifyEvent('cancel')
}
