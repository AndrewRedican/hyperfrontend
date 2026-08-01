/**
 * Protocol registry types.
 *
 * Defines the interface for managing protocol providers at the broker level.
 *
 * @module security/registry/types
 */

import type { SecurityProtocolVersion } from '../../types/security'

/**
 * Protocol registry for managing available protocol providers.
 *
 * The registry stores protocol providers keyed by version, allowing
 * dynamic registration and retrieval during channel setup. Providers are
 * expected to satisfy the `SecurityProvider` shape.
 */
export interface ProtocolRegistry {
  /**
   * Register a protocol provider.
   *
   * The 'none' protocol requires no provider and cannot be registered.
   *
   * @param version - The protocol version (e.g. 'v1' or 'v2')
   * @param provider - The protocol provider instance
   */
  register(version: SecurityProtocolVersion, provider: unknown): void

  /**
   * Unregister a protocol provider.
   *
   * The 'none' protocol is always available and cannot be unregistered.
   *
   * @param version - The protocol version to unregister
   */
  unregister(version: SecurityProtocolVersion): void

  /**
   * Get a registered protocol provider.
   *
   * @param version - The protocol version to retrieve
   * @returns The provider if registered, otherwise undefined
   */
  get(version: SecurityProtocolVersion): unknown | undefined

  /**
   * Check if a protocol provider is registered.
   *
   * @param version - The protocol version to check
   * @returns True if the provider is registered
   */
  has(version: SecurityProtocolVersion): boolean

  /**
   * Get all supported protocol versions.
   *
   * Returns versions that have registered providers plus 'none'
   * which is always supported.
   *
   * @returns Array of supported protocol versions
   */
  getSupportedVersions(): SecurityProtocolVersion[]
}
