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
  return channels.map((channel) => (<{ toJSON: () => ChannelJSON }>(<unknown>channel)).toJSON())
}
