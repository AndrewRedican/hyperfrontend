import type { IChannelContract } from './contract'
import type { ChannelHandle } from './channel'

/**
 * Security policy function type for custom connection validation
 */
export type SecurityPolicy = (origin: string, contract: IChannelContract) => boolean

/**
 * Broker configuration settings
 */
export interface IBrokerSettings {
  /** Default contract for all channels */
  contract?: IChannelContract
  /** Custom security policy function */
  securityPolicy?: SecurityPolicy
  /** Allowed origins (whitelist) */
  originWhitelist?: string[]
  /** Blocked origins (blacklist) */
  originBlacklist?: string[]
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Configuration for creating a broker
 */
export interface BrokerConfig {
  /** Unique broker name/identifier */
  name: string
  /** Default contract for channels */
  contract: IChannelContract
  /** Additional broker settings */
  settings?: IBrokerSettings
}

/**
 * Broker instance interface (returned by createBroker)
 */
export interface BrokerHandle {
  /** Broker unique identifier */
  readonly id: string
  /** Broker name */
  readonly name: string
  /** Default contract */
  readonly contract: IChannelContract
  /** List of active channels */
  readonly channels: ReadonlyArray<ChannelHandle>
  /** Add a new channel */
  addChannel(name: string, target: Window): ChannelHandle
  /** Get channel by name, id, or window reference */
  getChannel(ref: string | Window): ChannelHandle | undefined
  /** Remove a channel */
  removeChannel(channel: ChannelHandle): void
  /** Convert broker to JSON */
  toJSON(): Record<string, unknown>
}
