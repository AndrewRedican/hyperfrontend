import type { Registry } from '../../core/registry/factory'
import { createChannel } from '../../channel/factory'
import { remove as removeFromRegistry } from '../../core/registry/remove'

/**
 * Removes a channel from the broker
 *
 * @param registry - Channel registry from which to remove the channel
 * @param channel - The channel instance to cleanup and remove
 *
 * @example Removing a channel from the broker
 * ```typescript
 * const channel = getChannel(registry, 'widget-channel')
 * if (channel) {
 *   removeChannel(registry, channel)
 * }
 * ```
 */
export function removeChannel(registry: Registry, channel: ReturnType<typeof createChannel>): void {
  channel.destroy(false)

  removeFromRegistry(registry, channel)
}
