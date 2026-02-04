import type { ChannelRegistry } from './factory'

// Minimal channel structure required for registry operations
interface MinimalChannel {
  id: string
  name: string
  target: Window
}

/**
 * Removes a channel from the registry, making it unavailable
 * for all lookup methods.
 *
 * @param registry - The channel registry instance
 * @param channel - Channel to unregister
 */
export function remove(registry: ChannelRegistry, channel: MinimalChannel): void {
  registry.remove(channel)
}
