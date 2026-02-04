import type { IAction } from '../../types/action'
import type { BrokerState } from '../types'
import type { Registry } from '../../core/registry/factory'
import type { ProcessManager } from '../../core/processes/factory'
import type { ActionCreators } from '../../core/actions/factory'
import type { RouteHandler } from './create-router'

/**
 * Routes a message to the appropriate handler
 *
 * @param router - Handler map containing action type to handler mappings
 * @param state - Current broker state
 * @param registry - Channel registry for accessing channels
 * @param processManager - Process manager for tracking communication processes
 * @param actions - Action creators for generating responses
 * @param message - Incoming message event containing the action to route
 */
export function routeMessage(
  router: Map<string, RouteHandler>,
  state: BrokerState,
  registry: Registry,
  processManager: ProcessManager,
  actions: ActionCreators,
  message: MessageEvent<IAction>
): void {
  try {
    const action = message?.data
    const actionType = action?.type

    if (!actionType) {
      if (state.settings.debug) {
        console.warn('[nexus] Received message without action type')
      }
      return
    }

    // Look up handler for this action type
    const handler = router.get(actionType)

    if (!handler) {
      if (state.settings.debug) {
        console.warn(`[nexus] No handler for action type: ${actionType}`)
      }
      return
    }

    // Execute handler
    handler(state, registry, processManager, actions, message)
  } catch (error) {
    if (state.settings.debug) {
      console.error('[nexus] Error routing message:', error)
    }
  }
}
