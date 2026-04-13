import type { ChannelRegistry } from './factory'

/**
 * Minimal channel interface for registry operations.
 */
interface MinimalChannel {
  /** Unique identifier for the channel */
  id: string
  /** Human-readable name of the channel */
  name: string
  /** Target window for cross-window communication */
  target: Window
}

/**
 * Adds a channel to the registry, making it available for lookup
 * by window, ID, and name.
 *
 * @param registry - The channel registry instance
 * @param channel - Channel to register (must have id, name, target)
 * @throws {Error} Error if channel is invalid
 *
 * @example Registering a channel
 * ```typescript
 * const registry = createRegistry()
 * add(registry, { id: 'ch-1', name: 'main', target: iframe.contentWindow })
 * ```
 */
export function add(registry: ChannelRegistry, channel: MinimalChannel): void {
  registry.add(channel)
}
