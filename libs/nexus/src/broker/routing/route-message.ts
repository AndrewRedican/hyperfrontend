import type { IAction } from '../../types/action'
import type { RoutingContext, RouteHandler } from './types'
import { logAction } from '../../utils/logging/log-action'

/**
 * Routes a message to the appropriate handler.
 *
 * @param router - Handler map containing action type to handler mappings
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Incoming message event containing the action to route
 */
export function routeMessage(router: Map<string, RouteHandler>, context: RoutingContext, message: MessageEvent<IAction>): void {
  const { logger } = context

  try {
    const action = message?.data
    const actionType = action?.type

    if (!actionType) {
      logger.warn('Received message without action type')
      return
    }

    logAction(logger, action, 'received')

    const handler = router.get(actionType)

    if (!handler) {
      logger.warn(`No handler for action type: ${actionType}`)
      return
    }

    handler(context, message)
  } catch (error) {
    logger.error('Error routing message:', <Error>error)
  }
}
