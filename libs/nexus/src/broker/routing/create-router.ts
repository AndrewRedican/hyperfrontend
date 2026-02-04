import type { IAction } from '../../types/action'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'

/**
 * Handler function signature
 */
export type RouteHandler = (
  state: BrokerState,
  registry: Registry,
  processManager: ProcessManager,
  actions: ActionCreators,
  message: MessageEvent<IAction>
) => void

/**
 * Handler map configuration
 */
export interface HandlerMap {
  [actionType: string]: RouteHandler
}

/**
 * Creates a router map for action types to handlers
 *
 * @param handlers - Map of action types to handler functions
 * @returns Router map
 */
export function createRouter(handlers: HandlerMap): Map<string, RouteHandler> {
  const router = new Map<string, RouteHandler>()

  // Register each handler
  Object.entries(handlers).forEach(([type, handler]) => {
    router.set(type, handler)
  })

  return router
}
