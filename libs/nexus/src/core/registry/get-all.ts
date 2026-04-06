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
 * Returns all registered channels as an array.
 * The order is not guaranteed.
 *
 * @param registry - The channel registry instance
 * @returns Array of all registered channels
 */
export function getAll(registry: ChannelRegistry): MinimalChannel[] {
  return registry.getAll()
}
