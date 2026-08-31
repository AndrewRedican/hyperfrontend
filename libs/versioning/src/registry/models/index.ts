/**
 * Registry types and factories for registries, packages, versions, and maintainers.
 *
 * @module @hyperfrontend/versioning/registry/models
 */
export type { PackageInfo } from './package-info'
export type { Registry, RegistryConfig } from './registry'
export type { RegistryFailureReason, RegistryUnavailableError, RegistryUnavailableDetails } from './registry-error'
export type { VersionInfo, Maintainer } from './version-info'
export { createPackageInfo } from './package-info'
export { REGISTRY_UNAVAILABLE_ERROR, createRegistryUnavailableError, isRegistryUnavailableError } from './registry-error'
export { createVersionInfo } from './version-info'
