/* eslint-disable workspace/lib-require-jsdoc-example */
import type { ChannelRegistry } from './factory'

/**
 * Minimal channel representation for registry operations.
 */
interface MinimalChannel {
  /** Unique identifier for the channel */
  id: string
  /** Display name of the channel */
  name: string
  /** Target window for cross-frame communication */
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
