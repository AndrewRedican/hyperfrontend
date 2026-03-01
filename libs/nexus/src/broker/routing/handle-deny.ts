import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'

/**
 * Handles DENY_CONNECTION action.
 * Processes connection denial from remote broker.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the DENY_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Terminates the connection process
 * - Fires 'deny' lifecycle event with error details
 *
 * @example
 * Denial flow (during handshake):
 * Initiator -> REQUEST_CONNECTION
 * Responder validates and rejects
 * Initiator <- DENY_CONNECTION (this handler)
 * Initiator fires 'deny' event
 */
export function handleDeny(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { processManager } = context
  const action = message.data
  const processId = (action as unknown as Record<string, unknown>)['processId'] as string
  const error = (action as unknown as Record<string, unknown>)['error'] as string | undefined

  // Get channel by process ID
  const channel = processManager.get(processId) as ChannelHandle | undefined

  if (!channel) {
    return // Channel not found
  }

  // Terminate process by removing it from the process manager
  processManager.remove(processId)

  // Notify DENIED event with error context
  channel.notifyEvent('deny', { error, origin: message.origin })
}
