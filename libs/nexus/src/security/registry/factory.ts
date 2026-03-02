/**
 * Protocol registry factory.
 *
 * Creates a registry for managing protocol providers at the broker level.
 *
 * @module security/registry/factory
 */

import type { SecurityProtocolVersion } from '../../types/security'
import type { ProtocolRegistry } from './types'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

/**
 * Creates a protocol registry for managing security protocol providers.
 *
 * The registry provides a centralized store for protocol providers,
 * allowing channels to retrieve the appropriate provider based on
 * the negotiated protocol version.
 *
 * The 'none' protocol is always considered supported (it requires
 * no provider) and cannot be registered or unregistered.
 *
 * @returns A new protocol registry instance
 *
 * @example
 * ```typescript
 * const registry = createProtocolRegistry()
 *
 * // Register v1 protocol
 * registry.register('v1', createProtocol(logger, 60))
 *
 * // Check availability
 * registry.has('v1') // true
 * registry.has('v2') // false
 * registry.has('none') // always true
 *
 * // Get supported versions
 * registry.getSupportedVersions() // ['v1', 'none']
 * ```
 */
export function createProtocolRegistry(): ProtocolRegistry {
  const providers = createMap<'v1' | 'v2', unknown>()

  /**
   * Register a protocol provider.
   *
   * @param version - The protocol version ('v1' or 'v2')
   * @param provider - The protocol provider instance
   */
  const register = (version: 'v1' | 'v2', provider: unknown): void => {
    if (!provider) {
      throw createError(`Cannot register null/undefined provider for ${version}`)
    }

    providers.set(version, provider)
  }

  /**
   * Unregister a protocol provider.
   *
   * @param version - The protocol version to unregister
   */
  const unregister = (version: 'v1' | 'v2'): void => {
    providers.delete(version)
  }

  /**
   * Get a registered protocol provider.
   *
   * Returns undefined for 'none' since it requires no provider.
   *
   * @param version - The protocol version to retrieve
   * @returns The provider if registered, otherwise undefined
   */
  const get = (version: SecurityProtocolVersion): unknown | undefined => {
    if (version === 'none') {
      return undefined
    }

    return providers.get(version)
  }

  /**
   * Check if a protocol provider is registered.
   *
   * The 'none' protocol is always considered available.
   *
   * @param version - The protocol version to check
   * @returns True if the provider is registered (or 'none')
   */
  const has = (version: SecurityProtocolVersion): boolean => {
    if (version === 'none') {
      return true
    }

    return providers.has(version)
  }

  /**
   * Get all supported protocol versions.
   *
   * Returns versions that have registered providers plus 'none'.
   *
   * @returns Array of supported protocol versions
   */
  const getSupportedVersions = (): SecurityProtocolVersion[] => {
    const versions: SecurityProtocolVersion[] = ['none']

    if (providers.has('v1')) {
      versions.unshift('v1')
    }

    if (providers.has('v2')) {
      versions.unshift('v2')
    }

    return versions
  }

  return freeze({
    register,
    unregister,
    get,
    has,
    getSupportedVersions,
  })
}
