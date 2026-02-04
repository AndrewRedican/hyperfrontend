import type { IBrokerSettings } from '../types/broker'
import type { IChannelSettings } from '../types/channel'
import type { IChannelContract } from '../types/contract'

/**
 * Default empty contract.
 * No actions accepted or emitted.
 */
export const DEFAULT_EMPTY_CONTRACT: IChannelContract = {
  accepted: [],
  emitted: [],
}

/**
 * Default broker settings.
 * Safe defaults that allow all origins and queue messages.
 */
export const DEFAULT_BROKER_SETTINGS: Partial<IBrokerSettings> = {
  contract: DEFAULT_EMPTY_CONTRACT,
  debug: false,
  originWhitelist: [],
  originBlacklist: [],
  securityPolicy: undefined,
}

/**
 * Default channel settings.
 * Accept any origin, queue messages, inherit contract from broker.
 */
export const DEFAULT_CHANNEL_SETTINGS: Partial<IChannelSettings> = Object.freeze({
  origin: '*',
  queueMessages: true,
  debug: false,
  contract: undefined, // Inherit from broker
})
