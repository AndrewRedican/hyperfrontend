import type { DenyEventHandler } from '../../types/events'
import { create, type EventHandler } from './create'

/**
 * Creates a filter that only passes DENY events to the handler
 *
 * @param handler - Handler that only receives DENY events
 * @returns Wrapped handler that filters for DENY events
 */
export function deny(handler: DenyEventHandler): EventHandler {
  return create('deny')(<EventHandler>handler)
}
