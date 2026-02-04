import type { ChannelJSON, ChannelHandle } from '../../types/channel'

/**
 * Converts a channel to a safe JSON representation
 * Removes functions and internal state, keeping only data
 *
 * @param channel - Channel handle to serialize
 * @returns Safe JSON representation
 */
export function channelToJSON(channel: ChannelHandle): ChannelJSON {
  return channel.toJSON()
}
