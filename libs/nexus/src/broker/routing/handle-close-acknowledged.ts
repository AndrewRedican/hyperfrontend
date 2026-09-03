import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'

/**
 * Handles CLOSE_CONNECTION_ACKNOWLEDGED action.
 * Completes the polite close on the initiator's side: the channel
 * deactivates and fires its single 'close' event only now, after the
 * counterpart confirmed it finished flushing.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the CLOSE_CONNECTION_ACKNOWLEDGED action
 *
 * @example Handling close acknowledgment
 * ```typescript
 * handleCloseAcknowledged(routingContext, closeAcknowledgedEvent)
 * ```
 */
export function handleCloseAcknowledged(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { processManager } = context
  const action = message.data
  const processId = (action as unknown as Record<string, unknown>)['processId'] as string

  const channel = processManager.get(processId) as ChannelHandle | undefined

  // why: A stray acknowledgement whose process id maps to a channel that never proposed a close must not deactivate it.
  if (!channel || !channel.isClosing()) {
    return
  }

  channel.disconnect(false)
}
