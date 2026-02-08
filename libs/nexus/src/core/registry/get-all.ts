import type { ChannelRegistry } from './factory'

// Minimal channel structure required for registry operations
interface MinimalChannel {
  id: string
  name: string
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
