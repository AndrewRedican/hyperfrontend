import type { LogLevel } from '@hyperfrontend/logging'
import type { BrokerHandle } from '../broker/types'
import type { IChannelContract } from '../types/contract'
import { createBroker } from '../broker/factory'
import { assertNoCircularRef } from '../utils/validation/assert-no-circular-ref'

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
 *
 * @example
 * ```typescript
 * const broker = setupBroker({
 *   name: 'main',
 *   contract: { emitted: ['ping'], accepted: ['pong'] },
 *   logLevel: 'debug'
 * })
 * ```
 */
export function setupBroker(config: SetupBrokerConfig): BrokerHandle {
  assertNoCircularRef(config, 'config')

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
