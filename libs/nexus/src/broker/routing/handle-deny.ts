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
  const processId = <string>(<Record<string, unknown>>(<unknown>action))['processId']
  const error = <string | undefined>(<Record<string, unknown>>(<unknown>action))['error']

  const channel = <ChannelHandle | undefined>processManager.get(processId)

  if (!channel) {
    return
  }

  processManager.remove(processId)

  channel.notifyEvent('deny', { error, origin: message.origin })
}
