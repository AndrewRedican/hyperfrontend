import type { ChannelInternals } from '../types'
import type { EventHandler } from '../../types/channel'

/**
 * Subscribes to channel lifecycle events.
 *
 * Events include: 'open', 'close', 'cancel', 'deny', 'invalid', 'destroy'
 *
 * @param channel - Channel internals with state and dependencies
 * @param handler - Event handler function
 * @returns Unsubscribe function to remove the handler
 *
 * @throws {Error} If handler is not a function
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToEvents(channel, (event, data) => {
 *   console.log('Event:', event, data)
 * })
 *
 * // Later: unsubscribe()
 * ```
 */
export function subscribeToEvents(channel: ChannelInternals, handler: EventHandler): () => void {
  if (typeof handler !== 'function') {
    throw new Error('Expected callback function.')
  }

  const state = channel.getState()

  // Add handler to subscriptions
  const subscriptions = [...state.eventSubscriptions, handler]
  channel.updateState({ eventSubscriptions: subscriptions })

  // Return unsubscribe function
  return () => {
    const currentState = channel.getState()
    const filtered = currentState.eventSubscriptions.filter((h) => h !== handler)
    channel.updateState({ eventSubscriptions: filtered })
  }
}
