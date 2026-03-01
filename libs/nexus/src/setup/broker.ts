import type { LogLevel } from '@hyperfrontend/logging'
import type { BrokerHandle } from '../broker/types'
import type { IChannelContract } from '../types/contract'
import { createBroker } from '../broker/factory'

/**
 * Configuration for setting up a broker
 */
export interface SetupBrokerConfig {
  /** Unique broker name */
  name: string
  /** Default channel contract */
  contract: IChannelContract
  /** Log level (default: 'error') */
  logLevel?: LogLevel
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
      logLevel: config.logLevel,
      whitelist: config.originWhitelist,
      blacklist: config.originBlacklist,
    },
  })
}
