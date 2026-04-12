import type { Registry, RegistryConfig } from './models/registry'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createNpmRegistry } from './npm/client'

/**
 * Supported registry types.
 */
export type RegistryType = 'npm'

/**
 * Creates a registry client.
 *
 * @param type - Type of registry to create
 * @param config - Registry configuration
 * @returns A Registry instance
 *
 * @example Creating an npm registry client
 * const registry = createRegistry('npm')
 * const version = await registry.getLatestVersion('lodash')
 */
export function createRegistry(type: RegistryType = 'npm', config: RegistryConfig = {}): Registry {
  switch (type) {
    case 'npm':
      return createNpmRegistry(config)
    default:
      throw createError(`Unknown registry type: ${type}`)
  }
}
