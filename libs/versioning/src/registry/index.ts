/**
 * Package registry abstraction with NPM client, caching, and version/package info models.
 *
 * @module @hyperfrontend/versioning/registry
 */
export type { RegistryType } from './factory'
export type { Registry, RegistryConfig, PackageInfo, Maintainer, VersionInfo } from './models'
export { createPackageInfo, createVersionInfo } from './models'
export type { Cache, CacheEntry } from './npm'
export { createCache, createNpmRegistry, escapePackageName, escapeVersion } from './npm'
export { createRegistry } from './factory'
