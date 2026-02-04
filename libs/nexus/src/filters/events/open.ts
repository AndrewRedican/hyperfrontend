import type { OpenEventHandler } from '../../types/events'
import { create, type EventHandler } from './create'

/**
 * Creates a filter that only passes OPEN events to the handler
 *
 * @param handler - Handler that only receives OPEN events
 * @returns Wrapped handler that filters for OPEN events
 */
export function open(handler: OpenEventHandler): EventHandler {
  return create('open')(<EventHandler>handler)
}
