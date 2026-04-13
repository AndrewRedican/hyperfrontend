import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'

/**
 * Known git hosting platforms with built-in compare URL support.
 *
 * Each platform has a specific URL format for compare links:
 * - `github`: `{baseUrl}/compare/{fromCommit}...{toCommit}`
 * - `gitlab`: `{baseUrl}/-/compare/{fromCommit}...{toCommit}`
 * - `bitbucket`: `{baseUrl}/compare/{toCommit}..{fromCommit}` (reversed order)
 * - `azure-devops`: `{baseUrl}/compare?version=GT{toCommit}&compareVersion=GT{fromCommit}`
 */
export type KnownPlatform = 'github' | 'gitlab' | 'bitbucket' | 'azure-devops'

/**
 * Platform identifier.
 *
 * - Known platforms have built-in compare URL formatters
 * - `custom` requires a custom `formatCompareUrl` function
 * - `unknown` indicates platform could not be determined (no URL generation)
 */
export type RepositoryPlatform = KnownPlatform | 'custom' | 'unknown'

/**
 * Checks if a platform identifier is a known platform with built-in support.
 *
 * @param platform - Platform identifier to check
 * @returns True if the platform is a known platform
 *
 * @example Checking if platform has built-in support
 * ```typescript
 * isKnownPlatform('github')     // true
 * isKnownPlatform('gitlab')     // true
 * isKnownPlatform('custom')     // false
 * isKnownPlatform('unknown')    // false
 * ```
 */
export function isKnownPlatform(platform: RepositoryPlatform): platform is KnownPlatform {
  return platform === 'github' || platform === 'gitlab' || platform === 'bitbucket' || platform === 'azure-devops'
}

/**
 * Known platform hostnames mapped to their platform type.
 * Used for automatic platform detection from repository URLs.
 *
 * Includes both standard SaaS domains and common patterns for self-hosted instances.
 */
export const PLATFORM_HOSTNAMES: ReadonlyMap<string, KnownPlatform> = createMap<string, KnownPlatform>([
  ['github.com', 'github'],

  ['gitlab.com', 'gitlab'],

  ['bitbucket.org', 'bitbucket'],

  ['dev.azure.com', 'azure-devops'],
  ['visualstudio.com', 'azure-devops'],
])

/**
 * Detects platform from a hostname.
 *
 * First checks for exact match in known platforms, then applies heuristics
 * for self-hosted instances (e.g., `github.company.com` → `github`).
 *
 * @param hostname - Hostname to detect platform from (e.g., "github.com")
 * @returns Detected platform or 'unknown' if not recognized
 *
 * @example Detecting platform from hostname
 * ```typescript
 * detectPlatformFromHostname('github.com')           // 'github'
 * detectPlatformFromHostname('gitlab.mycompany.com') // 'gitlab'
 * detectPlatformFromHostname('custom-git.internal')  // 'unknown'
 * ```
 */
export function detectPlatformFromHostname(hostname: string): RepositoryPlatform {
  const normalized = hostname.toLowerCase()

  const exactMatch = PLATFORM_HOSTNAMES.get(normalized)
  if (exactMatch) {
    return exactMatch
  }

  if (normalized.endsWith('.visualstudio.com')) {
    return 'azure-devops'
  }

  if (normalized.endsWith('.azure.com')) {
    return 'azure-devops'
  }

  if (normalized.includes('github')) {
    return 'github'
  }

  if (normalized.includes('gitlab')) {
    return 'gitlab'
  }

  if (normalized.includes('bitbucket')) {
    return 'bitbucket'
  }

  return 'unknown'
}
