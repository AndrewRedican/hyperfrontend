import type { ChannelInternals } from '../types'
import type { IAction } from '../../types/action'

/**
 * Sends a raw action to the channel's target window.
 *
 * This is a low-level function used by lifecycle operations to send
 * control messages (connect, disconnect, etc.). Does not validate
 * message contracts or queue messages.
 *
 * @param channel - Channel internals with state and dependencies
 * @param action - Action to send
 *
 * @example
 * ```typescript
 * const action = channel.actions.requestConnection(processId)
 * sendAction(channel, action)
 * ```
 */
export function sendAction(channel: ChannelInternals, action: IAction): void {
  const state = channel.getState()

  if (!action || typeof action.type !== 'string') {
    throw new Error("Action must contain a 'type' property that is a non-empty string.")
  }

  // Send action via postMessage
  state.target.postMessage(action, '*')
}
