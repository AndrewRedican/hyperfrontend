import type { IBrokerSettings } from '../types/broker'
import type { IChannelSettings } from '../types/channel'
import type { IChannelContract } from '../types/contract'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Default empty contract.
 * No actions accepted or emitted.
 */
export const DEFAULT_EMPTY_CONTRACT: IChannelContract = freeze({
  accepted: freeze([]),
  emitted: freeze([]),
} as IChannelContract)

/**
 * Default broker settings.
 * Safe defaults that allow all origins and queue messages.
 */
export const DEFAULT_BROKER_SETTINGS: Partial<IBrokerSettings> = freeze({
  contract: DEFAULT_EMPTY_CONTRACT,
  debug: false,
  originWhitelist: freeze([]),
  originBlacklist: freeze([]),
  securityPolicy: undefined,
} as Partial<IBrokerSettings>)

/**
 * Default connection deadline in milliseconds.
 * A connection attempt left unanswered this long fires the 'connect-timeout' event.
 */
export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000

/**
 * Default handshake re-send cadence in milliseconds.
 * Pending REQUEST/ACCEPT messages are re-sent at this interval until answered.
 */
export const DEFAULT_REQUEST_RETRY_MS = 500

/**
 * Default close-acknowledgement deadline in milliseconds.
 * A polite close left unacknowledged this long completes locally anyway.
 */
export const DEFAULT_CLOSE_TIMEOUT_MS = 2_000

/**
 * Default channel settings.
 * Accept any origin, queue messages, inherit contract from broker.
 */
export const DEFAULT_CHANNEL_SETTINGS: Partial<IChannelSettings> = freeze({
  origin: '*',
  queueMessages: true,
  debug: false,
  contract: undefined,
} as Partial<IChannelSettings>)
