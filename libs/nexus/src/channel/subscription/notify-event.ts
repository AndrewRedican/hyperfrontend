import type { ChannelJSON } from '../../types/channel'
import type { ChannelEvent } from '../../types/events'
import type { ChannelInternals } from '../types'
import { logEvent } from '../../utils/logging/log-event'

/**
 * Notifies all event subscribers of a channel event.
 *
 * Calls each subscribed event handler with the event type, optional data, and channel JSON.
 * Errors in handlers are caught and logged to prevent breaking other handlers.
 *
 * @param channel - Channel internals with state and dependencies
 * @param event - Event type that occurred
 * @param data - Optional event data
 *
 * @example
 * ```typescript
 * notifyEvent(channel, 'open', { timestamp: Date.now() })
 * ```
 */
export function notifyEvent(channel: ChannelInternals, event: ChannelEvent, data?: unknown): void {
  const state = channel.getState()

  if (state.logger) {
    logEvent(state.logger, event, data)
  }

  const channelJSON: ChannelJSON = {
    id: state.id,
    name: state.name,
    active: state.active,
    origin: state.origin,
    connectTimestamp: state.connectTimestamp,
    contract: state.contract,
    queuedMessagesCount: state.queuedMessages.length,
  }

  for (const handler of state.eventSubscriptions) {
    try {
      handler(event, data, channelJSON)
    } catch (error) {
      if (state.logger) {
        state.logger.error(`Error in event handler for '${event}' event:`, <Error>error)
      }
    }
  }
}
