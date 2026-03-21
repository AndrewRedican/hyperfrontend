import type { PackageInfo } from '../models/package-info'
import type { Registry, RegistryConfig } from '../models/registry'
import type { VersionInfo, Maintainer } from '../models/version-info'
import type { Cache } from './cache'
import { execFileSync } from 'node:child_process'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createCache } from './cache'

/**
 * Internal state for the npm registry client.
 */
interface NpmRegistryState {
  readonly config: Required<Omit<RegistryConfig, 'authToken'>> & { authToken?: string }
  readonly cache: Cache
}

/**
 * Creates an npm registry client.
 *
 * @param config - Registry configuration
 * @returns A Registry implementation for npm
 *
 * @example
 * const registry = createNpmRegistry()
 * const version = await registry.getLatestVersion('@hyperfrontend/utils')
 */
export function createNpmRegistry(config: RegistryConfig = {}): Registry {
  const state: NpmRegistryState = {
    config: {
      url: config.url ?? 'https://registry.npmjs.org',
      timeout: config.timeout ?? 10000,
      cacheTtl: config.cacheTtl ?? 60000,
      authToken: config.authToken,
    },
    cache: createCache(config.cacheTtl ?? 60000),
  }

  return {
    name: 'npm',
    url: state.config.url,

    getLatestVersion: (packageName) => getLatestVersion(state, packageName),
    isVersionPublished: (packageName, version) => isVersionPublished(state, packageName, version),
    getPackageInfo: (packageName) => getPackageInfo(state, packageName),
    getVersionInfo: (packageName, version) => getVersionInfo(state, packageName, version),
    listVersions: (packageName) => listVersions(state, packageName),
  }
}

/**
 * Gets the latest published version of a package.
 *
 * @param state - Internal registry client state
 * @param packageName - Name of the package to query
 * @returns The latest version string, or null if not found
 */
async function getLatestVersion(state: NpmRegistryState, packageName: string): Promise<string | null> {
  const cacheKey = `latest:${packageName}`
  const cached = state.cache.get<string | null>(cacheKey)
  if (cached !== undefined) return cached

  try {
    const safeName = escapePackageName(packageName)
    const result = execFileSync('npm', ['view', safeName, 'version'], {
      encoding: 'utf-8',
      timeout: state.config.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    const version = result || null
    state.cache.set(cacheKey, version)
    return version
  } catch {
    state.cache.set(cacheKey, null)
    return null
  }
}

/**
 * Checks if a specific version is published.
 *
 * @param state - Internal registry client state
 * @param packageName - Name of the package to check
 * @param version - Semver version string to verify
 * @returns True if the version is published
 */
async function isVersionPublished(state: NpmRegistryState, packageName: string, version: string): Promise<boolean> {
  const cacheKey = `published:${packageName}@${version}`
  const cached = state.cache.get<boolean>(cacheKey)
  if (cached !== undefined) return cached

  try {
    const safeName = escapePackageName(packageName)
    const safeVersion = escapeVersion(version)
    const result = execFileSync('npm', ['view', `${safeName}@${safeVersion}`, 'version'], {
      encoding: 'utf-8',
      timeout: state.config.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()

    const published = result === version
    state.cache.set(cacheKey, published)
    return published
  } catch {
    state.cache.set(cacheKey, false)
    return false
  }
}

/**
 * Gets full package information.
 *
 * @param state - Internal registry client state
 * @param packageName - Name of the package to query
 * @returns Package info, or null if not found
 */
async function getPackageInfo(state: NpmRegistryState, packageName: string): Promise<PackageInfo | null> {
  const cacheKey = `info:${packageName}`
  const cached = state.cache.get<PackageInfo | null>(cacheKey)
  if (cached !== undefined) return cached

  try {
    const safeName = escapePackageName(packageName)
    const result = execFileSync('npm', ['view', safeName, '--json'], {
      encoding: 'utf-8',
      timeout: state.config.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 10 * 1024 * 1024, // 10MB
    })

    const data = parse(result)

    const info: PackageInfo = {
      name: data.name,
      description: data.description,
      latestVersion: data.version,
      versions: isArray(data.versions) ? data.versions : [data.version],
      license: data.license,
      repository: extractRepoUrl(data.repository),
      homepage: data.homepage,
      maintainers: (data.maintainers ?? []).map((m: { name?: string; email?: string } | string): Maintainer => {
        if (typeof m === 'string') {
          return { name: m }
        }
        return { name: m.name ?? '', email: m.email }
      }),
      keywords: data.keywords,
      lastModified: data.time?.modified,
    }

    state.cache.set(cacheKey, info)
    return info
  } catch {
    state.cache.set(cacheKey, null)
    return null
  }
}

/**
 * Gets version-specific information.
 *
 * @param state - Internal registry client state
 * @param packageName - Name of the package to query
 * @param version - Semver version string to look up
 * @returns Version info, or null if not found
 */
async function getVersionInfo(state: NpmRegistryState, packageName: string, version: string): Promise<VersionInfo | null> {
  const cacheKey = `versionInfo:${packageName}@${version}`
  const cached = state.cache.get<VersionInfo | null>(cacheKey)
  if (cached !== undefined) return cached

  try {
    const safeName = escapePackageName(packageName)
    const safeVersion = escapeVersion(version)
    const result = execFileSync('npm', ['view', `${safeName}@${safeVersion}`, '--json'], {
      encoding: 'utf-8',
      timeout: state.config.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 5 * 1024 * 1024, // 5MB
    })

    const data = parse(result)

    const info: VersionInfo = {
      version: data.version,
      publishedAt: data.time ?? createDate().toISOString(),
      tarball: data.dist?.tarball ?? '',
      integrity: data.dist?.integrity,
      dependencies: data.dependencies,
      devDependencies: data.devDependencies,
      peerDependencies: data.peerDependencies,
      optionalDependencies: data.optionalDependencies,
      engines: data.engines,
      nodeVersion: data._nodeVersion,
      npmVersion: data._npmVersion,
      gitHead: data.gitHead,
    }

    state.cache.set(cacheKey, info)
    return info
  } catch {
    state.cache.set(cacheKey, null)
    return null
  }
}

/**
 * Lists all published versions.
 *
 * @param state - Internal registry client state
 * @param packageName - Name of the package to query
 * @returns Array of version strings
 */
async function listVersions(state: NpmRegistryState, packageName: string): Promise<readonly string[]> {
  const cacheKey = `versions:${packageName}`
  const cached = state.cache.get<string[]>(cacheKey)
  if (cached !== undefined) return cached

  try {
    const safeName = escapePackageName(packageName)
    const result = execFileSync('npm', ['view', safeName, 'versions', '--json'], {
      encoding: 'utf-8',
      timeout: state.config.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const versions = parse(result)
    const versionList = isArray(versions) ? versions : [versions]
    state.cache.set(cacheKey, versionList)
    return versionList
  } catch {
    state.cache.set(cacheKey, [])
    return []
  }
}

/**
 * Maximum allowed package name length (npm limit).
 */
const MAX_PACKAGE_NAME_LENGTH = 214

/**
 * Escapes a package name for safe use in shell commands.
 * Uses character-by-character validation to prevent injection.
 *
 * @param name - Package name to escape
 * @returns Safe package name
 * @throws {Error} If package name contains invalid characters
 */
export function escapePackageName(name: string): string {
  if (!name || typeof name !== 'string') {
    throw createError('Package name is required')
  }

  if (name.length > MAX_PACKAGE_NAME_LENGTH) {
    throw createError(`Package name exceeds maximum length of ${MAX_PACKAGE_NAME_LENGTH}`)
  }

  const safe: string[] = []

  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i)

    // Allow: a-z, A-Z, 0-9, @, /, -, _, .
    if (
      (code >= 97 && code <= 122) || // a-z
      (code >= 65 && code <= 90) || // A-Z
      (code >= 48 && code <= 57) || // 0-9
      code === 64 || // @
      code === 47 || // /
      code === 45 || // -
      code === 95 || // _
      code === 46 // .
    ) {
      safe.push(name[i])
    } else {
      throw createError(`Invalid character in package name at position ${i}: "${name[i]}"`)
    }
  }

  return safe.join('')
}

/**
 * Maximum allowed version string length.
 */
const MAX_VERSION_LENGTH = 256

/**
 * Escapes a version string for safe use in shell commands.
 *
 * @param version - Version string to escape
 * @returns Safe version string
 * @throws {Error} If version contains invalid characters
 */
export function escapeVersion(version: string): string {
  if (!version || typeof version !== 'string') {
    throw createError('Version is required')
  }

  if (version.length > MAX_VERSION_LENGTH) {
    throw createError(`Version exceeds maximum length of ${MAX_VERSION_LENGTH}`)
  }

  const safe: string[] = []

  for (let i = 0; i < version.length; i++) {
    const code = version.charCodeAt(i)

    // Allow: 0-9, ., -, +, a-z, A-Z
    if (
      (code >= 48 && code <= 57) || // 0-9
      (code >= 97 && code <= 122) || // a-z
      (code >= 65 && code <= 90) || // A-Z
      code === 46 || // .
      code === 45 || // -
      code === 43 // +
    ) {
      safe.push(version[i])
    } else {
      throw createError(`Invalid character in version at position ${i}: "${version[i]}"`)
    }
  }

  return safe.join('')
}

/**
 * Extracts repository URL from npm package repository field.
 *
 * @param repository - Repository field from package.json (string or object)
 * @returns Repository URL, or undefined if not found
 */
function extractRepoUrl(repository: unknown): string | undefined {
  if (typeof repository === 'string') return repository

  if (repository && typeof repository === 'object') {
    const repo = <{ url?: string; type?: string }>repository
    if (repo.url) {
      // Clean up git+ prefix and .git suffix
      let url = repo.url
      if (url.startsWith('git+')) {
        url = url.slice(4)
      }
      if (url.endsWith('.git')) {
        url = url.slice(0, -4)
      }
      return url
    }
  }

  return undefined
}
