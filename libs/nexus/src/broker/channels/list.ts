import type { Registry } from '../../core/registry/factory'
import type { ChannelJSON } from '../../types/channel'
import { getAll } from '../../core/registry/get-all'

/**
 * Lists all channels in JSON format
 *
 * @param registry - Channel registry containing all registered channels
 * @returns Array of channel JSON representations
 */
export function listChannels(registry: Registry): ChannelJSON[] {
  const channels = getAll(registry)
  // Cast to ChannelHandle since registry stores full channel objects
  return channels.map((channel) => (channel as unknown as { toJSON: () => ChannelJSON }).toJSON())
}
