import type { ChannelRegistry } from './factory'

interface MinimalChannel {
  id: string
  name: string
  target: Window
}

/**
 * Adds a channel to the registry, making it available for lookup
 * by window, ID, and name.
 *
 * @param registry - The channel registry instance
 * @param channel - Channel to register (must have id, name, target)
 * @throws {Error} Error if channel is invalid
 */
export function add(registry: ChannelRegistry, channel: MinimalChannel): void {
  registry.add(channel)
}
