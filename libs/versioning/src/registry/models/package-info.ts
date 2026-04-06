import type { Maintainer } from './version-info'

/**
 * Package information from a registry.
 */
export interface PackageInfo {
  /** Package name */
  readonly name: string

  /** Package description */
  readonly description?: string

  /** Latest version */
  readonly latestVersion: string

  /** All published versions */
  readonly versions: readonly string[]

  /** SPDX license identifier */
  readonly license?: string

  /** Repository URL */
  readonly repository?: string

  /** Homepage URL */
  readonly homepage?: string

  /** Package maintainers */
  readonly maintainers: readonly Maintainer[]

  /** Keywords */
  readonly keywords?: readonly string[]

  /** Time of last modification */
  readonly lastModified?: string
}

/**
 * Creates a new PackageInfo object.
 *
 * @param options - Configuration for the package info
 * @param options.name - e.g., 'lodash' or '@scope/pkg'
 * @param options.latestVersion - The most recently published semver string
 * @param options.versions - All published semver strings in chronological order
 * @param options.description - Brief summary of package functionality
 * @param options.license - SPDX license identifier
 * @param options.repository - URL to source code repository
 * @param options.homepage - URL to project homepage or documentation site
 * @param options.maintainers - List of maintainers with name and email
 * @param options.keywords - Search terms for npm registry discovery
 * @param options.lastModified - Time of last modification
 * @returns A new PackageInfo object
 */
export function createPackageInfo(options: {
  /** Package name, e.g., 'lodash' or '@scope/pkg' */
  name: string
  /** The most recently published semver string */
  latestVersion: string
  /** All published semver strings in chronological order */
  versions: readonly string[]
  /** Brief summary of package functionality */
  description?: string
  /** SPDX license identifier */
  license?: string
  /** URL to source code repository */
  repository?: string
  /** URL to project homepage or documentation site */
  homepage?: string
  /** List of maintainers with name and email */
  maintainers?: readonly Maintainer[]
  /** Search terms for npm registry discovery */
  keywords?: readonly string[]
  /** Time of last modification */
  lastModified?: string
}): PackageInfo {
  return {
    name: options.name,
    description: options.description,
    latestVersion: options.latestVersion,
    versions: options.versions,
    license: options.license,
    repository: options.repository,
    homepage: options.homepage,
    maintainers: options.maintainers ?? [],
    keywords: options.keywords,
    lastModified: options.lastModified,
  }
}
