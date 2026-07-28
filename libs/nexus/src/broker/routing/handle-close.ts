import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'
import { resolveChannel } from './resolve-channel'

/**
 * Handles CLOSE_CONNECTION action.
 * Gracefully closes an open connection after a flush window.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the CLOSE_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Fires 'closing' while the channel is still active, so subscribers may
 *   flush final messages that deliver before the acknowledgement
 * - Sends CLOSE_CONNECTION_ACKNOWLEDGED response
 * - Deactivates the channel and fires a single 'close' lifecycle event
 * - Terminates process
 *
 * @example Graceful disconnect flow
 * Disconnect flow:
 * Side A -> CLOSE_CONNECTION (initiates, stays active awaiting acknowledgement)
 * Side B <- CLOSE_CONNECTION (this handler: 'closing', flush, acknowledge, 'close')
 * Side B -> CLOSE_ACKNOWLEDGED
 * Side A <- CLOSE_ACKNOWLEDGED (completes its close, fires its 'close')
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

  // why: Simultaneous polite closes (close glare) already fired this side's 'closing' when it sent its own CLOSE; a second one would double-notify subscribers.
  if (!channel.isClosing()) {
    channel.notifyEvent('closing', { initiatedLocally: false })
  }

  channel.sendAction({
    type: '[nexus] connection-closed-acknowledged',
    processId,
    senderId: state.id,
  })

  processManager.remove(processId)

  channel.disconnect(false)
}
