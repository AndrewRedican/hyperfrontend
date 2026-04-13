import type { ChannelJSON } from '../../types/channel'
import type { ChannelEvent, OpenEventData, CloseEventData, CancelEventData, DenyEventData, InvalidEventData } from '../../types/events'

/**
 * Generic event handler that receives all events
 */
export type EventHandler = (
  event: ChannelEvent,
  data: OpenEventData | CloseEventData | CancelEventData | DenyEventData | InvalidEventData,
  channel: ChannelJSON
) => void

/**
 * Creates an event filter that only calls the handler for a specific event type
 *
 * @param eventType - The event type to filter for
 * @returns A higher-order function that wraps a handler
 *
 * @example Filtering channel events
 * ```typescript
 * const openFilter = create('open')
 * const filteredHandler = openFilter((event, data, channel) => {
 *   console.log('Channel opened:', channel.name)
 * })
 * ```
 */
export function create(eventType: ChannelEvent): (handler: EventHandler) => EventHandler {
  return (handler: EventHandler): EventHandler => {
    return (
      event: ChannelEvent,
      data: OpenEventData | CloseEventData | CancelEventData | DenyEventData | InvalidEventData,
      channel: ChannelJSON
    ) => {
      if (event === eventType) {
        handler(event, data, channel)
      }
    }
  }
}
