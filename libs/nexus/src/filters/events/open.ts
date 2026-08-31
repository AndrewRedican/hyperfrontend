/* eslint-disable workspace/lib-require-jsdoc-example */
import type { OpenEventHandler } from '../../types/events'
import type { EventHandler } from './create'
import { create } from './create'

/**
 * Creates a filter that only passes OPEN events to the handler
 *
 * @param handler - Handler that only receives OPEN events
 * @returns Wrapped handler that filters for OPEN events
 */
export function open(handler: OpenEventHandler): EventHandler {
  return create('open')(handler as EventHandler)
}
