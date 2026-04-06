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
 * Finds a channel by its name.
 * Uses Map for O(1) lookup.
 *
 * @param registry - The channel registry instance
 * @param name - The channel name to look up
 * @returns Channel if found, undefined otherwise
 */
export function getByName(registry: ChannelRegistry, name: string): MinimalChannel | undefined {
  return registry.getByName(name)
}
