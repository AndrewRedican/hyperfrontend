/**
 * Maintainer information.
 */
export interface Maintainer {
  /** Maintainer name */
  readonly name: string

  /** Maintainer email */
  readonly email?: string
}

/**
 * Version-specific information from a registry.
 */
export interface VersionInfo {
  /** Version string */
  readonly version: string

  /** ISO date when published */
  readonly publishedAt: string

  /** Tarball URL */
  readonly tarball: string

  /** Subresource integrity hash */
  readonly integrity?: string

  /** Runtime dependencies */
  readonly dependencies?: Record<string, string>

  /** Development dependencies */
  readonly devDependencies?: Record<string, string>

  /** Peer dependencies */
  readonly peerDependencies?: Record<string, string>

  /** Optional peer dependencies */
  readonly optionalDependencies?: Record<string, string>

  /** Engine requirements */
  readonly engines?: Record<string, string>

  /** Node.js version range */
  readonly nodeVersion?: string

  /** npm version used to publish */
  readonly npmVersion?: string

  /**
   * Git commit hash at publish time.
   * Used to determine commit range for changelog generation.
   *
   * NOTE: This value comes from npm registry, making it immutable
   * and independent of local git state.
   */
  readonly gitHead?: string
}

/**
 * Inputs for {@link createVersionInfo}.
 */
export interface CreateVersionInfoOptions {
  /** Semver version string (e.g., '1.2.3') */
  version: string
  /** ISO 8601 timestamp of publication */
  publishedAt: string
  /** URL to the package tarball */
  tarball: string
  /** Subresource integrity hash */
  integrity?: string
  /** Production dependencies map */
  dependencies?: Record<string, string>
  /** Development dependencies map */
  devDependencies?: Record<string, string>
  /** Peer dependencies map */
  peerDependencies?: Record<string, string>
  /** Optional dependencies map */
  optionalDependencies?: Record<string, string>
  /** Engine requirements (Node/npm) */
  engines?: Record<string, string>
  /** Node.js version used during publish */
  nodeVersion?: string
  /** npm version used during publish */
  npmVersion?: string
  /** Git commit hash at publish time */
  gitHead?: string
}

/**
 * Creates a new VersionInfo object.
 *
 * @param options - Configuration for the release info
 * @param options.version - e.g., '1.2.3' or '2.0.0-beta.1'
 * @param options.publishedAt - ISO 8601 timestamp of publication
 * @param options.tarball - URL to the package tarball
 * @param options.integrity - Subresource integrity hash
 * @param options.dependencies - Production dependencies map
 * @param options.devDependencies - Development dependencies map
 * @param options.peerDependencies - Peer dependencies map
 * @param options.optionalDependencies - Optional dependencies map
 * @param options.engines - Node/npm engine requirements
 * @param options.nodeVersion - Node.js version used during publish
 * @param options.npmVersion - npm version used during publish
 * @param options.gitHead - Git commit hash at publish time
 * @returns A new VersionInfo object
 *
 * @example Creating version info from registry data
 * ```typescript
 * const release = createVersionInfo({
 *   version: '1.2.3',
 *   publishedAt: '2024-01-15T10:30:00Z',
 *   tarball: 'https://registry.npmjs.org/pkg/-/pkg-1.2.3.tgz'
 * })
 * ```
 */
export function createVersionInfo(options: CreateVersionInfoOptions): VersionInfo {
  return {
    version: options.version,
    publishedAt: options.publishedAt,
    tarball: options.tarball,
    integrity: options.integrity,
    dependencies: options.dependencies,
    devDependencies: options.devDependencies,
    peerDependencies: options.peerDependencies,
    optionalDependencies: options.optionalDependencies,
    engines: options.engines,
    nodeVersion: options.nodeVersion,
    npmVersion: options.npmVersion,
    gitHead: options.gitHead,
  }
}
