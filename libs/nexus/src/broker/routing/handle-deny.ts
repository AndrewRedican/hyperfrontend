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
 * @example Connection denial during handshake
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
  const reason = (action as unknown as Record<string, unknown>)['reason'] as string | undefined

  const channel = processManager.get(processId) as ChannelHandle | undefined

  if (!channel) {
    return
  }

  // why: A denied request must stop retrying, or REQUEST would be re-sent (and re-denied) until the deadline expires.
  channel.abandonRequest()

  processManager.remove(processId)

  channel.notifyEvent('deny', { error, ...(reason && { reason }), origin: message.origin })
}
