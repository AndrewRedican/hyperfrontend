import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'
import { getById } from '../../core/registry/get-by-id'

/**
 * Handles CANCEL_CONNECTION action.
 * Processes connection cancellation request.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the CANCEL_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Cancels pending connection
 * - Sends CANCEL_CONNECTION_ACKNOWLEDGED response
 * - Terminates process
 * - Fires 'cancel' lifecycle event
 *
 * @example
 * Cancel flow (before connection completes):
 * Side A -> CANCEL_CONNECTION
 * Side B <- CANCEL (this handler)
 * Side B -> CANCEL_ACKNOWLEDGED
 * Both sides fire 'cancel' event
 */
export function handleCancel(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { state, registry, processManager } = context
  const action = message.data
  const senderId = (action as unknown as Record<string, unknown>)['senderId'] as string
  const processId = (action as unknown as Record<string, unknown>)['processId'] as string

  // Try to find channel by sender ID or process ID
  const channel = (getById(registry, senderId) || processManager.get(processId)) as ChannelHandle | undefined

  if (!channel) {
    return // Channel not found
  }

  // Cancel the channel (without notifying - we'll notify after acknowledgement)
  channel.cancel(false)

  // Send acknowledgement back to the sender
  channel.sendAction({
    type: '[nexus] connection-request-cancelled-acknowledged',
    processId,
    senderId: state.id,
  })

  // Terminate process
  processManager.remove(processId)

  // Notify CANCELLED event
  channel.notifyEvent('cancel', { notify: true })
}
