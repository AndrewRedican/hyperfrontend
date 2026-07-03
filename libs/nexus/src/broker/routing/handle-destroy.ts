import type { IAction } from '../../types/action'
import type { ChannelHandle } from '../../types/channel'
import type { RoutingContext } from './types'
import { resolveChannel } from './resolve-channel'

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
 * @example Forceful connection termination
 * Forceful termination (e.g., window unload):
 * channel.destroy()
 * -> DESTROY_CONNECTION sent
 * -> Remote receives (this handler)
 * -> Channel immediately removed
 */
export function handleDestroy(context: RoutingContext, message: MessageEvent<IAction>): void {
  const { registry } = context

  const channel = <ChannelHandle | undefined>resolveChannel(registry, message)

  if (!channel) {
    return
  }

  channel.destroy(false)
}
