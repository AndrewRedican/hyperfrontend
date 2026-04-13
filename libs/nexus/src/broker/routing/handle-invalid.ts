import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'
import { isActionWithProcess } from '../../types/action'

/**
 * Handles INVALID_REQUEST action.
 * Processes error responses from remote broker.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the INVALID_REQUEST action
 *
 * @remarks
 * Side Effects:
 * - Fires 'invalid' lifecycle event with error details
 *
 * @example Handling protocol violations
 * Protocol violation detected:
 * Initiator sends malformed action
 * Responder detects violation
 * Initiator <- INVALID_REQUEST (this handler)
 * Initiator fires 'invalid' event with reason
 */
export function handleInvalid(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { processManager } = context
  const action = message.data

  if (!isActionWithProcess(action)) {
    return
  }

  const processId = action.processId

  const channel = <ChannelHandle | undefined>processManager.get(processId)

  if (!channel) {
    return
  }

  const reason = <string | undefined>(<unknown>action)['error']

  channel.notifyEvent('invalid', { reason, origin: message.origin })
}
