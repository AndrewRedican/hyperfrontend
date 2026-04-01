import type { IBrokerSettings } from '../types/broker'
import type { IChannelSettings } from '../types/channel'
import type { IChannelContract } from '../types/contract'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Default empty contract.
 * No actions accepted or emitted.
 */
export const DEFAULT_EMPTY_CONTRACT: IChannelContract = freeze(<IChannelContract>{
  accepted: freeze([]),
  emitted: freeze([]),
})

/**
 * Default broker settings.
 * Safe defaults that allow all origins and queue messages.
 */
export const DEFAULT_BROKER_SETTINGS: Partial<IBrokerSettings> = freeze(<Partial<IBrokerSettings>>{
  contract: DEFAULT_EMPTY_CONTRACT,
  debug: false,
  originWhitelist: freeze([]),
  originBlacklist: freeze([]),
  securityPolicy: undefined,
})

/**
 * Default channel settings.
 * Accept any origin, queue messages, inherit contract from broker.
 */
export const DEFAULT_CHANNEL_SETTINGS: Partial<IChannelSettings> = freeze(<Partial<IChannelSettings>>{
  origin: '*',
  queueMessages: true,
  debug: false,
  contract: undefined,
})
