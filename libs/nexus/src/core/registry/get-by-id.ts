import type { ChannelRegistry } from './factory'

// Minimal channel structure required for registry operations
interface MinimalChannel {
  id: string
  name: string
  target: Window
}

/**
 * Finds a channel by its unique ID.
 * Uses Map for O(1) lookup.
 *
 * @param registry - The channel registry instance
 * @param id - The channel ID (UUID) to look up
 * @returns Channel if found, undefined otherwise
 */
export function getById(registry: ChannelRegistry, id: string): MinimalChannel | undefined {
  return registry.getById(id)
}
