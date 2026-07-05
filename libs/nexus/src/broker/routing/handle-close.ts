import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'
import { resolveChannel } from './resolve-channel'

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
 * @example Graceful disconnect flow
 * Disconnect flow:
 * Side A -> CLOSE_CONNECTION (initiates)
 * Side B <- CLOSE_CONNECTION (this handler)
 * Side B -> CLOSE_ACKNOWLEDGED
 * Both sides fire 'close' event
 */
export function handleClose(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { state, registry, processManager } = context
  const action = message.data

  if (!('processId' in action)) {
    return
  }
  const processId = <string>action.processId

  const channel = <ChannelHandle | undefined>resolveChannel(registry, message)

  if (!channel || !channel.isActive()) {
    return
  }

  channel.disconnect(false)

  channel.sendAction({
    type: '[nexus] connection-closed-acknowledged',
    processId,
    senderId: state.id,
  })

  processManager.remove(processId)

  channel.notifyEvent('close', { notify: true })
}
