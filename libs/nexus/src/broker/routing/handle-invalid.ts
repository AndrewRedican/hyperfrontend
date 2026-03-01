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
 * @example
 * Protocol violation detected:
 * Initiator sends malformed action
 * Responder detects violation
 * Initiator <- INVALID_REQUEST (this handler)
 * Initiator fires 'invalid' event with reason
 */
export function handleInvalid(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { processManager } = context
  const action = message.data

  // Use type guard to safely access processId
  if (!isActionWithProcess(action)) {
    return // Invalid action structure
  }

  const processId = action.processId

  // Get channel by process ID
  const channel = <ChannelHandle | undefined>processManager.get(processId)

  if (!channel) {
    return // Channel not found
  }

  // Extract error details
  const reason = <string | undefined>(<unknown>action)['error']

  // Notify INVALID event with error details
  channel.notifyEvent('invalid', { reason, origin: message.origin })
}
