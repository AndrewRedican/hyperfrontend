import type { KnownPlatform } from '../models/platform'
import type { RepositoryConfig } from '../models/repository-config'
import { isKnownPlatform } from '../models/platform'

/**
 * Options for creating a compare URL.
 */
export interface CreateCompareUrlOptions {
  /**
   * Repository configuration containing platform and base URL.
   */
  readonly repository: RepositoryConfig

  /**
   * Source commit hash for comparison (older version).
   * Must be a full or abbreviated commit hash.
   */
  readonly fromCommit: string

  /**
   * Target commit hash for comparison (newer version).
   * Must be a full or abbreviated commit hash.
   */
  readonly toCommit: string
}

/**
 * Creates a platform-specific compare URL for viewing changes between two commits.
 *
 * Each platform has a different URL format:
 * - **GitHub**: `{baseUrl}/compare/{fromCommit}...{toCommit}` (three dots)
 * - **GitLab**: `{baseUrl}/-/compare/{fromCommit}...{toCommit}` (three dots, `/-/` prefix)
 * - **Bitbucket**: `{baseUrl}/compare/{toCommit}..{fromCommit}` (two dots, reversed order)
 * - **Azure DevOps**: `{baseUrl}/compare?version=GT{toCommit}&compareVersion=GT{fromCommit}` (query params)
 *
 * For `custom` platforms, a `formatCompareUrl` function must be provided in the repository config.
 * For `unknown` platforms, returns `null`.
 *
 * @param options - Compare URL options including repository, fromCommit, and toCommit
 * @returns The compare URL string, or null if URL cannot be generated
 *
 * @example
 * ```typescript
 * // GitHub
 * createCompareUrl({
 *   repository: { platform: 'github', baseUrl: 'https://github.com/owner/repo' },
 *   fromCommit: 'abc1234',
 *   toCommit: 'def5678'
 * })
 * // → 'https://github.com/owner/repo/compare/abc1234...def5678'
 *
 * // GitLab
 * createCompareUrl({
 *   repository: { platform: 'gitlab', baseUrl: 'https://gitlab.com/group/project' },
 *   fromCommit: 'abc1234',
 *   toCommit: 'def5678'
 * })
 * // → 'https://gitlab.com/group/project/-/compare/abc1234...def5678'
 *
 * // Bitbucket (reversed order)
 * createCompareUrl({
 *   repository: { platform: 'bitbucket', baseUrl: 'https://bitbucket.org/owner/repo' },
 *   fromCommit: 'abc1234',
 *   toCommit: 'def5678'
 * })
 * // → 'https://bitbucket.org/owner/repo/compare/def5678..abc1234'
 *
 * // Azure DevOps
 * createCompareUrl({
 *   repository: { platform: 'azure-devops', baseUrl: 'https://dev.azure.com/org/proj/_git/repo' },
 *   fromCommit: 'abc1234',
 *   toCommit: 'def5678'
 * })
 * // → 'https://dev.azure.com/org/proj/_git/repo/compare?version=GTdef5678&compareVersion=GTabc1234'
 *
 * // Custom formatter
 * createCompareUrl({
 *   repository: {
 *     platform: 'custom',
 *     baseUrl: 'https://my-git.internal/repo',
 *     formatCompareUrl: (from, to) => `https://my-git.internal/diff/${from}/${to}`
 *   },
 *   fromCommit: 'abc1234',
 *   toCommit: 'def5678'
 * })
 * // → 'https://my-git.internal/diff/abc1234/def5678'
 * ```
 */
export function createCompareUrl(options: CreateCompareUrlOptions): string | null {
  const { repository, fromCommit, toCommit } = options

  if (!repository || !fromCommit || !toCommit) {
    return null
  }

  if (repository.formatCompareUrl) {
    return repository.formatCompareUrl(fromCommit, toCommit)
  }

  const { platform, baseUrl } = repository

  if (platform === 'unknown') {
    return null
  }

  if (platform === 'custom') {
    return null
  }

  if (isKnownPlatform(platform)) {
    return formatKnownPlatformCompareUrl(platform, baseUrl, fromCommit, toCommit)
  }

  return null
}

/**
 * Formats a compare URL for known platforms.
 *
 * @param platform - Known platform type
 * @param baseUrl - Repository base URL
 * @param fromCommit - Source commit hash (older version)
 * @param toCommit - Target commit hash (newer version)
 * @returns Formatted compare URL
 *
 * @internal
 */
function formatKnownPlatformCompareUrl(platform: KnownPlatform, baseUrl: string, fromCommit: string, toCommit: string): string {
  switch (platform) {
    case 'github':
      return `${baseUrl}/compare/${fromCommit}...${toCommit}`

    case 'gitlab':
      return `${baseUrl}/-/compare/${fromCommit}...${toCommit}`

    case 'bitbucket':
      return `${baseUrl}/compare/${toCommit}..${fromCommit}`

    case 'azure-devops':
      return `${baseUrl}/compare?version=GT${encodeURIComponent(toCommit)}&compareVersion=GT${encodeURIComponent(fromCommit)}`
  }
}
