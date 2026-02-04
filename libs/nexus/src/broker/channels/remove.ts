import type { Registry } from '../../core/registry/factory'
import { remove as removeFromRegistry } from '../../core/registry/remove'
import { createChannel } from '../../channel/factory'

/**
 * Removes a channel from the broker
 *
 * @param registry - Channel registry from which to remove the channel
 * @param channel - The channel instance to cleanup and remove
 */
export function removeChannel(registry: Registry, channel: ReturnType<typeof createChannel>): void {
  // Destroy the channel (cleanup)
  channel.destroy(false)

  // Remove from registry
  removeFromRegistry(registry, channel)
}
