import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'
import { isPeerInstance } from './peer-instance'
import { resolveChannel } from './resolve-channel'

/**
 * Handles CANCEL_CONNECTION action.
 * Processes connection cancellation request.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the CANCEL_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Ignores a CANCEL from an instance other than the counterpart this channel
 *   answered, so a frame left over from a reloaded document cannot abort the
 *   handshake that replaced it
 * - Cancels pending connection
 * - Sends CANCEL_CONNECTION_ACKNOWLEDGED response
 * - Terminates process
 * - Fires 'cancel' lifecycle event
 *
 * @example Cancellation flow during connection
 * Cancel flow (before connection completes):
 * Side A -> CANCEL_CONNECTION
 * Side B <- CANCEL (this handler)
 * Side B -> CANCEL_ACKNOWLEDGED
 * Both sides fire 'cancel' event
 */
export function handleCancel(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { state, registry, processManager } = context
  const action = message.data
  const processId = <string>(<Record<string, unknown>>(<unknown>action))['processId']

  const channel = <ChannelHandle | undefined>(resolveChannel(registry, message) || processManager.get(processId))

  if (!channel || !isPeerInstance(channel, action)) {
    return
  }

  channel.cancel(false)

  channel.sendAction({
    type: '[nexus] connection-request-cancelled-acknowledged',
    processId,
    senderId: state.id,
  })

  processManager.remove(processId)

  channel.notifyEvent('cancel', { notify: true })
}
