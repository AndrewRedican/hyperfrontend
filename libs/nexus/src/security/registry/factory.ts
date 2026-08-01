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
 * no provider) and cannot be registered or unregistered. Any other
 * identifier is accepted so external protocol packages can register
 * their own providers.
 *
 * @returns A new protocol registry instance
 *
 * @example Managing protocol providers
 * ```typescript
 * const registry = createProtocolRegistry()
 *
 * // Register v1 protocol
 * registry.register('v1', provider)
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
  const providers = createMap<string, unknown>()

  /**
   * Register a protocol provider.
   *
   * @param version - The protocol version (e.g. 'v1' or 'v2')
   * @param provider - The protocol provider instance
   */
  const register = (version: SecurityProtocolVersion, provider: unknown): void => {
    if (version === 'none') {
      throw createError(`Cannot register a provider for 'none': the plaintext protocol needs no provider`)
    }

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
  const unregister = (version: SecurityProtocolVersion): void => {
    if (version === 'none') {
      throw createError(`Cannot unregister 'none': the plaintext protocol is always available`)
    }

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
   * Built-in versions lead the list ('v2' before 'v1'), followed by any
   * registered external identifiers in registration order, with 'none' last.
   *
   * @returns Array of supported protocol versions
   */
  const getSupportedVersions = (): SecurityProtocolVersion[] => {
    const versions: SecurityProtocolVersion[] = []

    if (providers.has('v2')) {
      versions.push('v2')
    }

    if (providers.has('v1')) {
      versions.push('v1')
    }

    for (const version of providers.keys()) {
      if (version !== 'v1' && version !== 'v2') {
        versions.push(version)
      }
    }

    versions.push('none')

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
