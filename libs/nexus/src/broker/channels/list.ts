import type { Registry } from '../../core/registry/factory'
import type { ChannelJSON } from '../../types/channel'
import { getAll } from '../../core/registry/get-all'

/**
 * Minimal shape exposing the {@link ChannelJSON} serializer on a channel instance.
 * Used to safely cast registry entries before serialization.
 */
type ChannelWithToJSON = {
  /** Serializes channel to JSON */
  toJSON: () => ChannelJSON
}

/**
 * Lists all channels in JSON format
 *
 * @param registry - Channel registry containing all registered channels
 * @returns Array of channel JSON representations
 *
 * @example Listing all channels as JSON
 * ```typescript
 * const channels = listChannels(registry)
 * // => [{ id: 'abc-123', name: 'widget', state: 'connected' }, ...]
 * ```
 */
export function listChannels(registry: Registry): ChannelJSON[] {
  const channels = getAll(registry)
  return channels.map((channel) => (channel as unknown as ChannelWithToJSON).toJSON())
}
