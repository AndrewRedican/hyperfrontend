/**
 * Semantic Version
 *
 * A version number in the format MAJOR.MINOR.PATCH with optional
 * prerelease and build metadata.
 *
 * @see https://semver.org/
 */
export interface SemVer {
  /** Major version - incremented for breaking changes */
  readonly major: number

  /** Minor version - incremented for new features */
  readonly minor: number

  /** Patch version - incremented for bug fixes */
  readonly patch: number

  /** Prerelease identifiers (e.g., ["alpha", "1"]) */
  readonly prerelease: readonly string[]

  /** Build metadata identifiers (e.g., ["build", "123"]) */
  readonly build: readonly string[]

  /** Original raw string if parsed */
  readonly raw?: string
}

/**
 * Bump type for version increments.
 */
export type BumpType = 'major' | 'minor' | 'patch' | 'premajor' | 'preminor' | 'prepatch' | 'prerelease' | 'none'

/** Required version number components for creating a SemVer. */
interface RequiredVersionComponents {
  /** Major version number. */
  major: number
  /** Minor version number. */
  minor: number
  /** Patch version number. */
  patch: number
}

/**
 * Creates a new SemVer object.
 *
 * @param options - Version components
 * @returns A new SemVer object
 */
export function createSemVer(options: Partial<SemVer> & RequiredVersionComponents): SemVer {
  return {
    major: options.major,
    minor: options.minor,
    patch: options.patch,
    prerelease: options.prerelease ?? [],
    build: options.build ?? [],
    raw: options.raw,
  }
}

/**
 * Creates a SemVer representing version 0.0.0.
 *
 * @returns A SemVer at version 0.0.0
 */
export function createInitialVersion(): SemVer {
  return createSemVer({ major: 0, minor: 0, patch: 0 })
}

/**
 * Creates a SemVer representing version 1.0.0.
 *
 * @returns A SemVer at version 1.0.0
 */
export function createFirstRelease(): SemVer {
  return createSemVer({ major: 1, minor: 0, patch: 0 })
}

/**
 * Checks if the version has prerelease identifiers.
 *
 * @param version - The version to check
 * @returns True if version has prerelease identifiers
 */
export function isPrerelease(version: SemVer): boolean {
  return version.prerelease.length > 0
}

/**
 * Checks if the version is a stable release (>= 1.0.0 with no prerelease).
 *
 * @param version - The version to check
 * @returns True if version is stable
 */
export function isStable(version: SemVer): boolean {
  return version.major >= 1 && version.prerelease.length === 0
}

/**
 * Returns a new version with build metadata stripped.
 *
 * @param version - The version to strip
 * @returns A new SemVer without build metadata
 */
export function stripBuild(version: SemVer): SemVer {
  return createSemVer({
    major: version.major,
    minor: version.minor,
    patch: version.patch,
    prerelease: version.prerelease,
    build: [],
  })
}

/**
 * Returns a new version with prerelease identifiers stripped.
 *
 * @param version - The version to strip
 * @returns A new SemVer without prerelease identifiers
 */
export function stripPrerelease(version: SemVer): SemVer {
  return createSemVer({
    major: version.major,
    minor: version.minor,
    patch: version.patch,
    prerelease: [],
    build: version.build,
  })
}
