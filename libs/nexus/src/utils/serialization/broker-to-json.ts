import type { BrokerHandle } from '../../broker/types'
import type { ChannelJSON } from '../../types/channel'

/**
 * JSON representation of a broker
 */
export interface BrokerJSON {
  id: string
  name: string
  channels: ChannelJSON[]
}

/**
 * Converts a broker to a safe JSON representation
 * Removes functions and internal state, keeping only data
 *
 * @param broker - Broker handle to serialize
 * @returns Safe JSON representation
 */
export function brokerToJSON(broker: BrokerHandle): BrokerJSON {
  return {
    id: broker.id,
    name: broker.name,
    channels: [...broker.channels],
  }
}
