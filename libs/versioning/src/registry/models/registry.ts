import type { PackageInfo } from './package-info'
import type { VersionInfo } from './version-info'

/**
 * Abstract interface for package registries.
 */
export interface Registry {
  /** Registry name (e.g., "npm", "yarn") */
  readonly name: string

  /** Registry URL */
  readonly url: string

  /**
   * Get the latest published version of a package.
   *
   * @param packageName - The package name to look up
   * @returns The latest version string, or null if not published
   */
  getLatestVersion(packageName: string): Promise<string | null>

  /**
   * Check if a specific version is published.
   *
   * @param packageName - Name of the package to check (e.g., '@hyperfrontend/versioning')
   * @param version - Semver version string to verify (e.g., '1.2.3')
   * @returns True if the version is published
   */
  isVersionPublished(packageName: string, version: string): Promise<boolean>

  /**
   * Get full package information.
   *
   * @param packageName - Name of the package to query (e.g., '@hyperfrontend/versioning')
   * @returns Package info, or null if not found
   */
  getPackageInfo(packageName: string): Promise<PackageInfo | null>

  /**
   * Get version-specific information including publish time.
   *
   * @param packageName - Name of the package to query (e.g., '@hyperfrontend/versioning')
   * @param version - Semver version string to look up (e.g., '1.2.3')
   * @returns Version info, or null if not found
   */
  getVersionInfo(packageName: string, version: string): Promise<VersionInfo | null>

  /**
   * List all published versions.
   *
   * @param packageName - Name of the package to query (e.g., '@hyperfrontend/versioning')
   * @returns Array of version strings
   */
  listVersions(packageName: string): Promise<readonly string[]>
}

/**
 * Registry configuration options.
 */
export interface RegistryConfig {
  /** Registry URL */
  readonly url?: string

  /** Request timeout in milliseconds */
  readonly timeout?: number

  /** Cache TTL in milliseconds */
  readonly cacheTtl?: number

  /** Authentication token */
  readonly authToken?: string
}
