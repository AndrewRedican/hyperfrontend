import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'
import { getById } from '../../core/registry/get-by-id'

/**
 * Handles CLOSE_CONNECTION action.
 * Gracefully closes an open connection.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the CLOSE_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Deactivates the channel
 * - Sends CLOSE_CONNECTION_ACKNOWLEDGED response
 * - Terminates process
 * - Fires 'close' lifecycle event
 *
 * @example
 * Disconnect flow:
 * Side A -> CLOSE_CONNECTION (initiates)
 * Side B <- CLOSE_CONNECTION (this handler)
 * Side B -> CLOSE_ACKNOWLEDGED
 * Both sides fire 'close' event
 */
export function handleClose(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { state, registry, processManager } = context
  const action = message.data
  const senderId = <string>action.senderId

  // Type guard to ensure action has processId
  if (!('processId' in action)) {
    return // Action doesn't have processId
  }
  const processId = <string>action.processId

  // Get channel by sender ID
  const channel = <ChannelHandle | undefined>getById(registry, senderId)

  if (!channel || !channel.isActive()) {
    return // Channel not found or not open
  }

  // Close the channel (without notifying yet)
  channel.disconnect(false)

  // Send acknowledgement
  channel.sendAction({
    type: '[nexus] connection-closed-acknowledged',
    processId,
    senderId: state.id,
  })

  // Terminate process
  processManager.remove(processId)

  // Notify CLOSED event
  channel.notifyEvent('close', { notify: true })
}
