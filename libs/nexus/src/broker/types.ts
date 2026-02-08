import type { IChannelContract } from '../types/contract'
import type { ChannelHandle, ChannelJSON } from '../types/channel'

/**
 * Security policy function type
 * Validates whether a connection request should be allowed
 */
export type SecurityPolicy = (event: MessageEvent) => boolean

/**
 * Broker settings configuration
 */
export interface BrokerSettings {
  /** Default contract for all channels */
  readonly contract: IChannelContract
  /** Custom security validation function */
  readonly securityPolicy?: SecurityPolicy
  /** List of allowed origins (takes precedence over blacklist) */
  readonly whitelist?: readonly string[]
  /** List of blocked origins */
  readonly blacklist?: readonly string[]
  /** Enable debug logging */
  readonly debug?: boolean
  /** Allow contract extension */
  readonly contractExtension?: boolean
}

/**
 * Broker configuration passed to factory
 */
export interface BrokerConfig {
  /** Unique broker identifier */
  readonly id: string
  /** Broker name */
  readonly name: string
  /** Broker settings */
  readonly settings: BrokerSettings
}

/**
 * Internal broker state
 */
export interface BrokerState {
  readonly id: string
  readonly name: string
  readonly window: Window
  readonly settings: BrokerSettings
  readonly contract: IChannelContract
}

/**
 * Broker handle returned by factory
 */
export interface BrokerHandle {
  readonly id: string
  readonly name: string
  readonly contract: IChannelContract
  readonly settings: BrokerSettings
  readonly channels: ReadonlyArray<ChannelJSON>
  readonly acceptedActionTypes: readonly string[]
  readonly debugMode: boolean

  addChannel(name: string, target: Window, settings?: Record<string, unknown>): ChannelHandle
  getChannel(reference: string | Window): ChannelHandle | null
  removeChannel(reference: string | Window): void
  setSecurityPolicy(policy: SecurityPolicy): BrokerHandle
  extendContract(contract: IChannelContract): BrokerHandle
  toJSON(): Record<string, unknown>
}
