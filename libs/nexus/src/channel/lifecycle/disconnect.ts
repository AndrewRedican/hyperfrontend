import type { ChannelInternals } from '../types'

/**
 * Gracefully closes an active channel connection.
 *
 * - Only works if channel is currently active
 * - Sets channel state to inactive
 * - Optionally notifies the target window
 * - Fires 'close' event to subscribers
 *
 * @param channel - Channel internals with state and dependencies
 * @param notify - Whether to notify target window (default: true)
 *
 * @example
 * ```typescript
 * disconnect(channel, true) // Close and notify target
 * disconnect(channel, false) // Close silently
 * ```
 */
export function disconnect(channel: ChannelInternals, notify = true): void {
  const state = channel.getState()

  // Only disconnect if currently active
  if (!state.active) {
    return
  }

  // Set channel to inactive
  channel.updateState({ active: false })

  // Notify target if requested
  if (notify) {
    const processId = channel.createProcess()
    const closeAction = channel.actions.closeConnection(processId)
    channel.sendAction(closeAction)
  }

  // Notify event subscribers
  channel.notifyEvent('close')
}
