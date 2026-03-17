import type { RepositoryPlatform } from './platform'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Custom compare URL formatter function.
 *
 * @param fromTag - The source tag for comparison (older version)
 * @param toTag - The target tag for comparison (newer version)
 * @returns Full compare URL string
 *
 * @example
 * ```typescript
 * const formatter: CompareUrlFormatter = (from, to) =>
 *   `https://my-git.internal/diff/${from}/${to}`
 * ```
 */
export type CompareUrlFormatter = (fromTag: string, toTag: string) => string

/**
 * Repository configuration for compare URL generation.
 *
 * Supports both standard platforms and self-hosted instances.
 * When using a known platform, compare URLs are generated automatically.
 * For custom or unknown platforms, provide a `formatCompareUrl` function.
 *
 * @example
 * ```typescript
 * // GitHub repository
 * const github: RepositoryConfig = {
 *   platform: 'github',
 *   baseUrl: 'https://github.com/owner/repo'
 * }
 *
 * // Self-hosted GitLab
 * const gitlabSelfHosted: RepositoryConfig = {
 *   platform: 'gitlab',
 *   baseUrl: 'https://gitlab.mycompany.com/team/project'
 * }
 *
 * // Custom platform with formatter
 * const custom: RepositoryConfig = {
 *   platform: 'custom',
 *   baseUrl: 'https://custom-git.internal/repo',
 *   formatCompareUrl: (from, to) => `https://custom-git.internal/diff/${from}/${to}`
 * }
 * ```
 */
export interface RepositoryConfig {
  /**
   * Platform type - determines URL format for known platforms.
   */
  readonly platform: RepositoryPlatform

  /**
   * Base URL for the repository.
   *
   * This is the URL without any trailing slashes or paths like `/compare`.
   *
   * @example
   * - GitHub: `"https://github.com/owner/repo"`
   * - GitLab: `"https://gitlab.com/group/project"`
   * - Azure DevOps: `"https://dev.azure.com/org/project/_git/repo"`
   */
  readonly baseUrl: string

  /**
   * Custom compare URL formatter.
   *
   * Required when `platform` is `'custom'`.
   * Optional for known platforms (overrides built-in formatter).
   *
   * Receives the from and to tags, returns the full compare URL.
   */
  readonly formatCompareUrl?: CompareUrlFormatter
}

/**
 * Options for creating a repository config.
 */
export interface CreateRepositoryConfigOptions {
  /**
   * Platform type - determines URL format for known platforms.
   */
  readonly platform: RepositoryPlatform

  /**
   * Base URL for the repository.
   * Trailing slashes will be automatically stripped.
   */
  readonly baseUrl: string

  /**
   * Custom compare URL formatter.
   * Required when platform is 'custom'.
   */
  readonly formatCompareUrl?: CompareUrlFormatter
}

/**
 * Creates a new RepositoryConfig.
 *
 * Normalizes the base URL by stripping trailing slashes and validating
 * that custom platforms have a formatter function.
 *
 * @param options - Repository configuration options
 * @returns A new RepositoryConfig object
 * @throws {Error} if platform is 'custom' but no formatCompareUrl is provided
 *
 * @example
 * ```typescript
 * // GitHub repository
 * const config = createRepositoryConfig({
 *   platform: 'github',
 *   baseUrl: 'https://github.com/owner/repo'
 * })
 *
 * // Custom platform
 * const customConfig = createRepositoryConfig({
 *   platform: 'custom',
 *   baseUrl: 'https://my-git.internal/repo',
 *   formatCompareUrl: (from, to) => `https://my-git.internal/diff/${from}/${to}`
 * })
 * ```
 */
export function createRepositoryConfig(options: CreateRepositoryConfigOptions): RepositoryConfig {
  const { platform, formatCompareUrl } = options

  // Validate custom platform has formatter
  if (platform === 'custom' && !formatCompareUrl) {
    throw createError("Repository config with platform 'custom' requires a formatCompareUrl function")
  }

  // Normalize base URL - strip trailing slashes
  const baseUrl = normalizeBaseUrl(options.baseUrl)

  return {
    platform,
    baseUrl,
    formatCompareUrl,
  }
}

/**
 * Checks if a value is a RepositoryConfig object.
 *
 * @param value - Value to check
 * @returns True if the value is a RepositoryConfig
 *
 * @example
 * ```typescript
 * const config = { platform: 'github', baseUrl: 'https://...' }
 * if (isRepositoryConfig(config)) {
 *   // config is typed as RepositoryConfig
 * }
 * ```
 */
export function isRepositoryConfig(value: unknown): value is RepositoryConfig {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const obj = <Record<string, unknown>>value

  return (
    typeof obj['platform'] === 'string' &&
    typeof obj['baseUrl'] === 'string' &&
    (obj['formatCompareUrl'] === undefined || typeof obj['formatCompareUrl'] === 'function')
  )
}

/**
 * Normalizes a base URL by stripping trailing slashes and .git suffix.
 *
 * @param url - URL to normalize
 * @returns Normalized URL
 *
 * @internal
 */
function normalizeBaseUrl(url: string): string {
  let normalized = url.trim()

  // Remove trailing slashes
  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  // Remove .git suffix if present
  if (normalized.endsWith('.git')) {
    normalized = normalized.slice(0, -4)
  }

  return normalized
}
