/**
 * Package registry abstraction with NPM client, caching, and version/package info models.
 *
 * @module @hyperfrontend/versioning/registry
 */
export type { RegistryType } from './factory'
export type {
  Registry,
  RegistryConfig,
  PackageInfo,
  Maintainer,
  VersionInfo,
  RegistryFailureReason,
  RegistryUnavailableError,
  RegistryUnavailableDetails,
} from './models'
export type { Cache, CacheEntry, NpmLookupFailure, AbsentLookupFailure, UnavailableLookupFailure } from './npm'
export { createRegistry } from './factory'
export {
  createPackageInfo,
  createVersionInfo,
  REGISTRY_UNAVAILABLE_ERROR,
  createRegistryUnavailableError,
  isRegistryUnavailableError,
} from './models'
export { createCache, classifyNpmError, createNpmRegistry, escapePackageName, escapeVersion } from './npm'
