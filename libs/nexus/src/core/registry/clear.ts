import type { ChannelRegistry } from './factory'

/**
 * Removes all channels from the registry.
 * Useful for cleanup or testing scenarios.
 *
 * @param registry - The channel registry instance
 */
export function clear(registry: ChannelRegistry): void {
  registry.clear()
}
