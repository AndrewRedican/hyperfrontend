/* eslint-disable workspace/lib-require-jsdoc-example */
import type { CancelEventHandler } from '../../types/events'
import type { EventHandler } from './create'
import { create } from './create'

/**
 * Creates a filter that only passes CANCEL events to the handler
 *
 * @param handler - Handler that only receives CANCEL events
 * @returns Wrapped handler that filters for CANCEL events
 */
export function cancel(handler: CancelEventHandler): EventHandler {
  return create('cancel')(<EventHandler>handler)
}
