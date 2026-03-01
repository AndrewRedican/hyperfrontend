import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'

/**
 * Handles CLOSE_CONNECTION_ACKNOWLEDGED action.
 * Completes close on initiator's side and notifies close event.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the CLOSE_CONNECTION_ACKNOWLEDGED action
 */
export function handleCloseAcknowledged(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { processManager } = context
  const action = message.data
  const processId = (action as unknown as Record<string, unknown>)['processId'] as string

  // Get channel by process ID
  const channel = processManager.get(processId) as ChannelHandle | undefined

  if (!channel) {
    return // Channel not found
  }

  // Terminate process
  processManager.remove(processId)

  // Notify CLOSED event to subscribers
  channel.notifyEvent('close', { notify: false })
}
