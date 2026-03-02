import type { Logger } from '@hyperfrontend/logging'
import type { ChannelEvent } from '../../types/events'

/**
 * Logs a channel event in a structured format.
 *
 * @param logger - Logger instance to use
 * @param event - Type of channel event that occurred
 * @param data - Additional data associated with the event
 */
export function logEvent(logger: Logger, event: ChannelEvent, data: unknown): void {
  logger.debug(`Channel event:`, event, data)
}
