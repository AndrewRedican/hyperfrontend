import type { CloseEventHandler } from '../../types/events'
import type { EventHandler } from './create'
import { create } from './create'

/**
 * Creates a filter that only passes CLOSE events to the handler
 *
 * @param handler - Handler that only receives CLOSE events
 * @returns Wrapped handler that filters for CLOSE events
 */
export function close(handler: CloseEventHandler): EventHandler {
  return create('close')(<EventHandler>handler)
}
