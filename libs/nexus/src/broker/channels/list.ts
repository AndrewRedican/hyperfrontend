import type { Registry } from '../../core/registry/factory'
import type { ChannelJSON } from '../../types/channel'
import { getAll } from '../../core/registry/get-all'

/**
 * Lists all channels in JSON format
 *
 * @param registry - Channel registry containing all registered channels
 * @returns Array of channel JSON representations
 *
 * @example
 * ```typescript
 * const channels = listChannels(registry)
 * // => [{ id: 'abc-123', name: 'widget', state: 'connected' }, ...]
 * ```
 */
export function listChannels(registry: Registry): ChannelJSON[] {
  const channels = getAll(registry)
  return channels.map((channel) => (<{ /** Serializes channel to JSON */ toJSON: () => ChannelJSON }>(<unknown>channel)).toJSON())
}
