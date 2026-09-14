import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'

/**
 * Handles CANCEL_CONNECTION_ACKNOWLEDGED action.
 * Completes cancellation on the initiator's side.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the CANCEL_CONNECTION_ACKNOWLEDGED action
 *
 * @remarks
 * Side Effects:
 * - Terminates the connection process
 * - Fires no lifecycle event: cancel() already fired the single 'cancel' this
 *   side reports for the attempt when it sent the CANCEL frame
 *
 * @example Initiator-side cancellation acknowledgment
 * Cancellation acknowledgment (initiator side):
 * Initiator -> CANCEL_CONNECTION (fires 'cancel')
 * Initiator <- CANCEL_ACKNOWLEDGED (this handler)
 * Initiator drops the process
 */
export function handleCancelAcknowledged(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { processManager } = context
  const action = message.data
  const processId = (action as unknown as Record<string, unknown>)['processId'] as string

  const channel = processManager.get(processId) as ChannelHandle | undefined

  if (!channel) {
    return
  }

  processManager.remove(processId)
}
