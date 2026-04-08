import type { ChannelRegistry } from './factory'

/**
 * Removes all channels from the registry.
 * Useful for cleanup or testing scenarios.
 *
 * @param registry - The channel registry instance
 *
 * @example
 * ```typescript
 * const registry = createRegistry()
 * // ... add channels
 * clear(registry) // removes all channels
 * ```
 */
export function clear(registry: ChannelRegistry): void {
  registry.clear()
}
