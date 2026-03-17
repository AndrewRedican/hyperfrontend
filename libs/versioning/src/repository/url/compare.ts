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
   * Source tag for comparison (older version).
   */
  readonly fromTag: string

  /**
   * Target tag for comparison (newer version).
   */
  readonly toTag: string
}

/**
 * Creates a platform-specific compare URL for viewing changes between two tags.
 *
 * Each platform has a different URL format:
 * - **GitHub**: `{baseUrl}/compare/{fromTag}...{toTag}` (three dots)
 * - **GitLab**: `{baseUrl}/-/compare/{fromTag}...{toTag}` (three dots, `/-/` prefix)
 * - **Bitbucket**: `{baseUrl}/compare/{toTag}..{fromTag}` (two dots, reversed order)
 * - **Azure DevOps**: `{baseUrl}/compare?version=GT{toTag}&compareVersion=GT{fromTag}` (query params)
 *
 * For `custom` platforms, a `formatCompareUrl` function must be provided in the repository config.
 * For `unknown` platforms, returns `null`.
 *
 * @param options - Compare URL options including repository, fromTag, and toTag
 * @returns The compare URL string, or null if URL cannot be generated
 *
 * @example
 * ```typescript
 * // GitHub
 * createCompareUrl({
 *   repository: { platform: 'github', baseUrl: 'https://github.com/owner/repo' },
 *   fromTag: 'v1.0.0',
 *   toTag: 'v1.1.0'
 * })
 * // → 'https://github.com/owner/repo/compare/v1.0.0...v1.1.0'
 *
 * // GitLab
 * createCompareUrl({
 *   repository: { platform: 'gitlab', baseUrl: 'https://gitlab.com/group/project' },
 *   fromTag: 'v1.0.0',
 *   toTag: 'v1.1.0'
 * })
 * // → 'https://gitlab.com/group/project/-/compare/v1.0.0...v1.1.0'
 *
 * // Bitbucket (reversed order)
 * createCompareUrl({
 *   repository: { platform: 'bitbucket', baseUrl: 'https://bitbucket.org/owner/repo' },
 *   fromTag: 'v1.0.0',
 *   toTag: 'v1.1.0'
 * })
 * // → 'https://bitbucket.org/owner/repo/compare/v1.1.0..v1.0.0'
 *
 * // Azure DevOps
 * createCompareUrl({
 *   repository: { platform: 'azure-devops', baseUrl: 'https://dev.azure.com/org/proj/_git/repo' },
 *   fromTag: 'v1.0.0',
 *   toTag: 'v1.1.0'
 * })
 * // → 'https://dev.azure.com/org/proj/_git/repo/compare?version=GTv1.1.0&compareVersion=GTv1.0.0'
 *
 * // Custom formatter
 * createCompareUrl({
 *   repository: {
 *     platform: 'custom',
 *     baseUrl: 'https://my-git.internal/repo',
 *     formatCompareUrl: (from, to) => `https://my-git.internal/diff/${from}/${to}`
 *   },
 *   fromTag: 'v1.0.0',
 *   toTag: 'v1.1.0'
 * })
 * // → 'https://my-git.internal/diff/v1.0.0/v1.1.0'
 * ```
 */
export function createCompareUrl(options: CreateCompareUrlOptions): string | null {
  const { repository, fromTag, toTag } = options

  // Validate inputs
  if (!repository || !fromTag || !toTag) {
    return null
  }

  // If custom formatter is provided, use it (works for any platform including overrides)
  if (repository.formatCompareUrl) {
    return repository.formatCompareUrl(fromTag, toTag)
  }

  const { platform, baseUrl } = repository

  // Cannot generate URL for unknown platforms without a formatter
  if (platform === 'unknown') {
    return null
  }

  // Custom platform requires a formatter
  if (platform === 'custom') {
    return null
  }

  // Generate URL for known platforms
  if (isKnownPlatform(platform)) {
    return formatKnownPlatformCompareUrl(platform, baseUrl, fromTag, toTag)
  }

  return null
}

/**
 * Formats a compare URL for known platforms.
 *
 * @param platform - Known platform type
 * @param baseUrl - Repository base URL
 * @param fromTag - Source tag (older version)
 * @param toTag - Target tag (newer version)
 * @returns Formatted compare URL
 *
 * @internal
 */
function formatKnownPlatformCompareUrl(platform: KnownPlatform, baseUrl: string, fromTag: string, toTag: string): string {
  switch (platform) {
    case 'github':
      // GitHub: {baseUrl}/compare/{fromTag}...{toTag}
      return `${baseUrl}/compare/${fromTag}...${toTag}`

    case 'gitlab':
      // GitLab: {baseUrl}/-/compare/{fromTag}...{toTag}
      return `${baseUrl}/-/compare/${fromTag}...${toTag}`

    case 'bitbucket':
      // Bitbucket: {baseUrl}/compare/{toTag}..{fromTag} (reversed order, two dots)
      return `${baseUrl}/compare/${toTag}..${fromTag}`

    case 'azure-devops':
      // Azure DevOps: {baseUrl}/compare?version=GT{toTag}&compareVersion=GT{fromTag}
      // Use encodeURIComponent for query parameter values
      return `${baseUrl}/compare?version=GT${encodeURIComponent(toTag)}&compareVersion=GT${encodeURIComponent(fromTag)}`
  }
}
