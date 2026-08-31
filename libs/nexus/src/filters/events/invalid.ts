/* eslint-disable workspace/lib-require-jsdoc-example */
import type { InvalidEventHandler } from '../../types/events'
import type { EventHandler } from './create'
import { create } from './create'

/**
 * Creates a filter that only passes INVALID events to the handler
 *
 * @param handler - Handler that only receives INVALID events
 * @returns Wrapped handler that filters for INVALID events
 */
export function invalid(handler: InvalidEventHandler): EventHandler {
  return create('invalid')(handler as EventHandler)
}
