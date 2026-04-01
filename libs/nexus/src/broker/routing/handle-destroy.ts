import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'
import { getById } from '../../core/registry/get-by-id'

/**
 * Handles DESTROY_CONNECTION action.
 * Immediately destroys a connection without handshake.
 *
 * @param context - Routing context with state, registry, actions, and logger
 * @param message - Message event containing the DESTROY_CONNECTION action
 *
 * @remarks
 * Side Effects:
 * - Immediately destroys channel (no acknowledgment)
 * - Removes channel from registry
 * - No lifecycle event fired (forceful termination)
 *
 * @example
 * Forceful termination (e.g., window unload):
 * channel.destroy()
 * -> DESTROY_CONNECTION sent
 * -> Remote receives (this handler)
 * -> Channel immediately removed
 */
export function handleDestroy(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { registry } = context
  const action = message.data
  const senderId = <string>action.senderId

  const channel = <ChannelHandle>(<unknown>getById(registry, senderId))

  if (!channel) {
    return
  }

  channel.destroy(false)
}
