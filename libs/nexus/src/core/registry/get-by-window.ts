import type { ChannelRegistry } from './factory'

// Minimal channel structure required for registry operations
interface MinimalChannel {
  id: string
  name: string
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
