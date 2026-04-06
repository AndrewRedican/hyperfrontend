import type { Logger, LogLevel } from '@hyperfrontend/logging'
import type { ChannelHandle, ChannelJSON } from '../types/channel'
import type { IChannelContract } from '../types/contract'
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
  /** Unique broker identifier */
  readonly id: string
  /** Broker name */
  readonly name: string
  /** Window context for the broker */
  readonly window: Window
  /** Broker configuration settings */
  readonly settings: BrokerSettings
  /** Channel contract for messaging */
  readonly contract: IChannelContract
  /** Logger instance for debugging */
  readonly logger: Logger
}

/**
 * Broker handle returned by factory
 */
export interface BrokerHandle {
  /** Unique broker identifier */
  readonly id: string
  /** Broker name */
  readonly name: string
  /** Channel contract for messaging */
  readonly contract: IChannelContract
  /** Broker configuration settings */
  readonly settings: BrokerSettings
  /** List of registered channels */
  readonly channels: ReadonlyArray<ChannelJSON>
  /** Action types accepted by this broker */
  readonly acceptedActionTypes: readonly string[]

  /**
   * Add a new channel to the broker.
   *
   * @param name - Channel identifier
   * @param target - Target window for the channel
   * @param settings - Optional channel settings
   * @returns Handle to the created channel
   */
  addChannel(name: string, target: Window, settings?: Record<string, unknown>): ChannelHandle
  /**
   * Get a channel by reference.
   *
   * @param reference - Channel ID or target window
   * @returns Channel handle if found, null otherwise
   */
  getChannel(reference: string | Window): ChannelHandle | null
  /**
   * Remove a channel from the broker.
   *
   * @param reference - Channel ID or target window
   */
  removeChannel(reference: string | Window): void
  /**
   * Set the security policy for all channels.
   *
   * @param policy - Security policy to apply
   * @returns The broker handle for chaining
   */
  setSecurityPolicy(policy: SecurityPolicy): BrokerHandle
  /**
   * Extend the channel contract with additional actions.
   *
   * @param contract - Contract extension to merge
   * @returns The broker handle for chaining
   */
  extendContract(contract: IChannelContract): BrokerHandle
  /**
   * Convert broker state to JSON representation.
   *
   * @returns JSON object with broker state
   */
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
