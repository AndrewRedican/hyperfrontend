import type { ChannelInternals } from '../types'

/**
 * Immediately destroys a channel and removes it from the broker.
 *
 * - Sets channel to inactive immediately
 * - Optionally notifies the target window
 * - Removes channel from all registries
 * - Fires 'destroy' event to subscribers
 * - This is irreversible - channel cannot be reconnected
 *
 * @param channel - Channel internals with state and dependencies
 * @param notify - Whether to notify target window (default: true)
 *
 * @example
 * ```typescript
 * destroy(channel, true) // Destroy and notify target
 * destroy(channel, false) // Destroy silently
 * ```
 */
export function destroy(channel: ChannelInternals, notify = true): void {
  // Set inactive immediately
  channel.updateState({ active: false })

  // Notify target if requested
  if (notify) {
    const destroyAction = channel.actions.destroyConnection()
    channel.sendAction(destroyAction)
  }

  // Remove from broker registries (if cleanup callback provided)
  if (channel.cleanup) {
    channel.cleanup()
  }
}
