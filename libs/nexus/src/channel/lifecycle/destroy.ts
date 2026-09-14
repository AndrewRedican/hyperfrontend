import type { ChannelInternals } from '../types'
import { dropSecurityTransport } from '../security/drop'
import { clearCloseTimer } from './disconnect'
import { clearHandshakeTimers } from './handshake-timers'

/**
 * Immediately destroys a channel and removes it from the broker.
 *
 * - Sets channel to inactive immediately
 * - Optionally notifies the target window
 * - Removes channel from all registries, and every handshake or close process
 *   it still tracked, so a frame that arrives late resolves to nothing
 * - Fires no channel event: unlike a close, destruction is not observable through
 *   subscriptions, and it cancels a pending polite close's deadline timer
 * - This is irreversible - the channel cannot be reconnected, and connect()
 *   does nothing on it
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

  const state = channel.getState()
  // why: Untracked here, every process the channel held would keep routing late frames to a handle the broker has already dropped.
  for (const processId of [state.pendingProcessId, state.pendingAccept?.[3], state.scheduledActivation?.[3], state.closingProcessId]) {
    if (typeof processId === 'string') {
      channel.removeProcess(processId)
    }
  }

  channel.updateState({
    active: false,
    destroyed: true,
    pendingProcessId: null,
    pendingAccept: null,
    scheduledActivation: null,
    closingProcessId: null,
  })

  if (notify) {
    const destroyAction = channel.actions.destroyConnection()
    channel.sendAction(destroyAction)
  }
  // why: Released after the destroy frame is handed to it, so a secured channel's last frame is sealed by the transport that the counterpart can still open.
  dropSecurityTransport(channel)

  if (channel.cleanup) {
    channel.cleanup()
  }
}
