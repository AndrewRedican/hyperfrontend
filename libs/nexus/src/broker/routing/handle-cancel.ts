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
 * - Cancels pending connection, which fires the single 'cancel' lifecycle
 *   event this side reports for the attempt, with `notify: true`: the
 *   counterpart sent the CANCEL frame this handler is answering
 * - Sends CANCEL_CONNECTION_ACKNOWLEDGED response
 * - Terminates process
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
  const processId = (action as unknown as Record<string, unknown>)['processId'] as string

  const channel = (resolveChannel(registry, message) || processManager.get(processId)) as ChannelHandle | undefined

  if (!channel || !isPeerInstance(channel, action)) {
    return
  }

  // why: No CANCEL frame goes back, but one arrived, so the 'cancel' event still reports the counterpart as party to the cancellation rather than a teardown this side did alone.
  channel.cancel(false, true)

  channel.sendAction({
    type: '[nexus] connection-request-cancelled-acknowledged',
    processId,
    senderId: state.id,
  })

  processManager.remove(processId)
}
