import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'

/**
 * Handles CLOSE_CONNECTION_ACKNOWLEDGED action.
 * Completes close on initiator's side and notifies close event.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the CLOSE_CONNECTION_ACKNOWLEDGED action
 *
 * @example Handling close acknowledgment
 * ```typescript
 * handleCloseAcknowledged(routingContext, closeAcknowledgedEvent)
 * ```
 */
export function handleCloseAcknowledged(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { processManager } = context
  const action = message.data
  const processId = <string>(<Record<string, unknown>>(<unknown>action))['processId']

  const channel = <ChannelHandle | undefined>processManager.get(processId)

  if (!channel) {
    return
  }

  processManager.remove(processId)

  channel.notifyEvent('close', { notify: false })
}
