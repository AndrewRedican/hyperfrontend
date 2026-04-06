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
 * Finds a channel by its target window.
 * Uses WeakMap for O(1) lookup that doesn't prevent garbage collection.
 *
 * @param registry - The channel registry instance
 * @param target - The window to look up
 * @returns Channel if found, undefined otherwise
 */
export function getByWindow(registry: ChannelRegistry, target: Window): MinimalChannel | undefined {
  return registry.getByWindow(target)
}
