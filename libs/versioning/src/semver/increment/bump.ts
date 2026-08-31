import type { SemVer, BumpType } from '../models/version'
import { globalIsNaN, parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSemVer } from '../models/version'

/**
 * Increments a version based on the bump type.
 *
 * @param version - The version to increment
 * @param type - The type of bump (major, minor, patch, etc.)
 * @param prereleaseId - Optional prerelease identifier for prerelease bumps
 * @returns A new incremented SemVer
 *
 * @example Increment version by bump type
 * increment(parseVersion('1.2.3'), 'minor') // 1.3.0
 * increment(parseVersion('1.2.3'), 'major') // 2.0.0
 * increment(parseVersion('1.2.3'), 'prerelease', 'alpha') // 1.2.4-alpha.0
 */
export function increment(version: SemVer, type: BumpType, prereleaseId?: string): SemVer {
  switch (type) {
    case 'major':
      return createSemVer({
        major: version.major + 1,
        minor: 0,
        patch: 0,
        prerelease: [],
        build: [],
      })

    case 'minor':
      return createSemVer({
        major: version.major,
        minor: version.minor + 1,
        patch: 0,
        prerelease: [],
        build: [],
      })

    case 'patch':
      if (version.prerelease.length > 0) {
        return createSemVer({
          major: version.major,
          minor: version.minor,
          patch: version.patch,
          prerelease: [],
          build: [],
        })
      }
      return createSemVer({
        major: version.major,
        minor: version.minor,
        patch: version.patch + 1,
        prerelease: [],
        build: [],
      })

    case 'premajor':
      return createSemVer({
        major: version.major + 1,
        minor: 0,
        patch: 0,
        prerelease: [prereleaseId ?? 'alpha', '0'],
        build: [],
      })

    case 'preminor':
      return createSemVer({
        major: version.major,
        minor: version.minor + 1,
        patch: 0,
        prerelease: [prereleaseId ?? 'alpha', '0'],
        build: [],
      })

    case 'prepatch':
      return createSemVer({
        major: version.major,
        minor: version.minor,
        patch: version.patch + 1,
        prerelease: [prereleaseId ?? 'alpha', '0'],
        build: [],
      })

    case 'prerelease':
      return incrementPrerelease(version, prereleaseId)

    case 'none':
    default:
      return version
  }
}

/**
 * Increments the prerelease portion of a version.
 *
 * @param version - The version to increment
 * @param id - Optional prerelease identifier
 * @returns A new version with incremented prerelease
 *
 * @example Increment the prerelease portion of a version
 * ```typescript
 * incrementPrerelease(parseVersionStrict('1.0.0')) // => 1.0.1-alpha.0
 * incrementPrerelease(parseVersionStrict('1.0.0-alpha.0')) // => 1.0.0-alpha.1
 * incrementPrerelease(parseVersionStrict('1.0.0'), 'beta') // => 1.0.1-beta.0
 * ```
 */
export function incrementPrerelease(version: SemVer, id?: string): SemVer {
  const prerelease = [...version.prerelease]

  if (prerelease.length === 0) {
    return createSemVer({
      major: version.major,
      minor: version.minor,
      patch: version.patch + 1,
      prerelease: [id ?? 'alpha', '0'],
      build: [],
    })
  }

  const lastIdx = prerelease.length - 1
  const last = prerelease[lastIdx] as string
  const lastNum = parseInt(last, 10)

  if (!globalIsNaN(lastNum)) {
    prerelease[lastIdx] = String(lastNum + 1)
  } else {
    prerelease.push('0')
  }

  if (id && prerelease.length > 0 && prerelease[0] !== id) {
    prerelease[0] = id
    if (prerelease.length > 1) {
      prerelease[prerelease.length - 1] = '0'
    }
  }

  return createSemVer({
    major: version.major,
    minor: version.minor,
    patch: version.patch,
    prerelease,
    build: [],
  })
}

/**
 * Calculates the difference type between two versions.
 *
 * @param older - The older version
 * @param newer - The newer version
 * @returns The type of difference, or null if versions are equal
 *
 * @example Calculate the difference type between two versions
 * diff(parseVersion('1.0.0'), parseVersion('2.0.0')) // 'major'
 * diff(parseVersion('1.0.0'), parseVersion('1.1.0')) // 'minor'
 * diff(parseVersion('1.0.0'), parseVersion('1.0.1')) // 'patch'
 */
export function diff(older: SemVer, newer: SemVer): BumpType | null {
  if (older.major !== newer.major) {
    if (newer.prerelease.length > 0) {
      return 'premajor'
    }
    return 'major'
  }

  if (older.minor !== newer.minor) {
    if (newer.prerelease.length > 0) {
      return 'preminor'
    }
    return 'minor'
  }

  if (older.patch !== newer.patch) {
    if (newer.prerelease.length > 0) {
      return 'prepatch'
    }
    return 'patch'
  }

  if (older.prerelease.length !== newer.prerelease.length) {
    return 'prerelease'
  }

  for (let i = 0; i < older.prerelease.length; i++) {
    if (older.prerelease[i] !== newer.prerelease[i]) {
      return 'prerelease'
    }
  }

  return null
}
