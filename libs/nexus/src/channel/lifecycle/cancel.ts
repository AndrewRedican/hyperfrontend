import type { ChannelInternals } from '../types'
import { disconnect } from './disconnect'

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
 * @example
 * ```typescript
 * cancel(channel, true) // Cancel and notify target
 * cancel(channel, false) // Cancel silently
 * ```
 */
export function cancel(channel: ChannelInternals, notify = true): void {
  const state = channel.getState()

  // If already open, just disconnect
  if (state.active) {
    disconnect(channel, notify)
    return
  }

  // Send cancel notification if requested
  if (notify) {
    const processId = channel.createProcess()
    const cancelAction = channel.actions.cancelConnection(processId)
    channel.sendAction(cancelAction)
  }

  // Notify event subscribers
  channel.notifyEvent('cancel')
}
