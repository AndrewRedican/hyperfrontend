import type { ChannelInternals } from '../types'
import { clearCloseTimer } from './disconnect'
import { clearHandshakeTimers } from './handshake-timers'

/**
 * Immediately destroys a channel and removes it from the broker.
 *
 * - Sets channel to inactive immediately
 * - Optionally notifies the target window
 * - Removes channel from all registries
 * - Fires no channel event: unlike a close, destruction is not observable through
 *   subscriptions, and it cancels a pending polite close's deadline timer
 * - This is irreversible - channel cannot be reconnected
 *
 * @param channel - Channel internals with state and dependencies
 * @param notify - Whether to notify target window (default: true)
 *
 * @example Destroying a channel
 * ```typescript
 * destroy(channel, true) // Destroy and notify target
 * destroy(channel, false) // Destroy silently
 * ```
 */
export function destroy(channel: ChannelInternals, notify = true): void {
  clearHandshakeTimers(channel)
  clearCloseTimer(channel)
  channel.updateState({ active: false, pendingProcessId: null, pendingAccept: null, scheduledActivation: null, closingProcessId: null })

  if (notify) {
    const destroyAction = channel.actions.destroyConnection()
    channel.sendAction(destroyAction)
  }

  if (channel.cleanup) {
    channel.cleanup()
  }
}
