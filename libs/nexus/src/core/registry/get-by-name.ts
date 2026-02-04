import type { ChannelRegistry } from './factory'

// Minimal channel structure required for registry operations
interface MinimalChannel {
  id: string
  name: string
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
