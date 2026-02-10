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
 * dynamic registration and retrieval during channel setup.
 */
export interface ProtocolRegistry {
  /**
   * Register a protocol provider.
   *
   * @param version - The protocol version ('v1' or 'v2')
   * @param provider - The protocol provider instance
   */
  register(version: 'v1' | 'v2', provider: unknown): void

  /**
   * Unregister a protocol provider.
   *
   * @param version - The protocol version to unregister
   */
  unregister(version: 'v1' | 'v2'): void

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
