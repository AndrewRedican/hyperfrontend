import { createBroker } from '../broker/factory'
import type { BrokerHandle } from '../broker/types'
import type { IChannelContract } from '../types/contract'

/**
 * Configuration for setting up a broker
 */
export interface SetupBrokerConfig {
  /** Unique broker name */
  name: string
  /** Default channel contract */
  contract: IChannelContract
  /** Enable debug logging */
  debug?: boolean
  /** Allowed origins */
  originWhitelist?: string[]
  /** Blocked origins */
  originBlacklist?: string[]
}

/**
 * Convenience function for creating a singleton broker instance
 * This is a simple wrapper around createBroker for ease of use
 *
 * @param config - Broker configuration
 * @returns Broker handle
 */
export function setupBroker(config: SetupBrokerConfig): BrokerHandle {
  return createBroker({
    name: config.name,
    contract: config.contract,
    settings: {
      debug: config.debug,
      whitelist: config.originWhitelist,
      blacklist: config.originBlacklist,
    },
  })
}
