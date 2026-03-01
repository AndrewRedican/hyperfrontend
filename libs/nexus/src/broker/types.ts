import type { Logger, LogLevel } from '@hyperfrontend/logging'
import type { IChannelContract } from '../types/contract'
import type { ChannelHandle, ChannelJSON } from '../types/channel'
import type { BrokerSecurityConfig, SecurityProtocolVersion } from '../types/security'

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
  /** Minimum log level to emit (default: 'error') */
  readonly logLevel?: LogLevel
  /** Custom logger instance to use */
  readonly logger?: Logger
  /** Allow contract extension */
  readonly contractExtension?: boolean
  /** Security configuration for protocol negotiation and encryption */
  readonly security?: BrokerSecurityConfig
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
  readonly logger: Logger
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

  addChannel(name: string, target: Window, settings?: Record<string, unknown>): ChannelHandle
  getChannel(reference: string | Window): ChannelHandle | null
  removeChannel(reference: string | Window): void
  setSecurityPolicy(policy: SecurityPolicy): BrokerHandle
  extendContract(contract: IChannelContract): BrokerHandle
  toJSON(): Record<string, unknown>

  /**
   * Register a security protocol provider.
   *
   * @param version - The protocol version ('v1' or 'v2')
   * @param provider - The protocol provider instance from network-protocol
   * @returns The broker handle for chaining
   */
  registerProtocol(version: 'v1' | 'v2', provider: unknown): BrokerHandle

  /**
   * Unregister a security protocol provider.
   *
   * @param version - The protocol version to unregister
   * @returns The broker handle for chaining
   */
  unregisterProtocol(version: 'v1' | 'v2'): BrokerHandle

  /**
   * Check if a security protocol provider is registered.
   *
   * @param version - The protocol version to check
   * @returns True if the provider is registered (or 'none')
   */
  hasProtocol(version: SecurityProtocolVersion): boolean

  /**
   * Get all supported security protocol versions.
   *
   * Returns versions that have registered providers plus 'none'.
   *
   * @returns Array of supported protocol versions
   */
  getSupportedProtocols(): SecurityProtocolVersion[]

  /**
   * Get the broker's logger instance.
   *
   * @returns The logger used by this broker
   */
  readonly logger: Logger
}
