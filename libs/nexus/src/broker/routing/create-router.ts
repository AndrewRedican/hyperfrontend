import type { RouteHandler } from './types'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Handler map configuration
 */
export interface HandlerMap {
  [actionType: string]: RouteHandler
}

/**
 * Creates a router map for action types to handlers.
 *
 * @param handlers - Map of action types to handler functions
 * @returns Router map
 */
export function createRouter(handlers: HandlerMap): Map<string, RouteHandler> {
  const router = new Map<string, RouteHandler>()

  // Register each handler
  entries(handlers).forEach(([type, handler]) => {
    router.set(type, handler)
  })

  return router
}
