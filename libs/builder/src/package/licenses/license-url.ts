import type { PackageJson } from '../../models'
import { parseRepositoryUrl } from '@hyperfrontend/versioning/repository/parse'

const extractRepositoryUrl = (repository: PackageJson['repository']): string | null => {
  if (typeof repository === 'string') return repository
  if (repository && typeof repository === 'object') return repository.url
  return null
}

const formatLicenseUrl = (platform: string, baseUrl: string, fileName: string): string | null => {
  if (platform === 'github') return `${baseUrl}/blob/master/${fileName}`
  if (platform === 'gitlab') return `${baseUrl}/-/blob/main/${fileName}`
  if (platform === 'bitbucket') return `${baseUrl}/src/master/${fileName}`
  return null
}

/**
 * Derives a canonical license-file URL for a dependency from its `package.json`
 * `repository` field and the discovered LICENSE filename.
 *
 * Returns `null` for missing repository fields, unparseable URLs, and platforms
 * outside the supported set (GitHub, GitLab, Bitbucket).
 *
 * @param repository - Source `package.json` `repository` field (string or object form).
 * @param licenseFileName - Filename of the LICENSE inside the upstream repo.
 * @returns Resolved license URL, or `null` when one cannot be derived.
 *
 * @example Resolving a GitHub LICENSE URL from a string-form repository field
 * ```typescript
 * const url = constructLicenseUrl('https://github.com/x/y.git', 'LICENSE')
 * // → 'https://github.com/x/y/blob/master/LICENSE'
 * ```
 */
export const constructLicenseUrl = (repository: PackageJson['repository'], licenseFileName: string): string | null => {
  const url = extractRepositoryUrl(repository)
  if (!url) return null
  const parsed = parseRepositoryUrl(url)
  if (!parsed) return null
  return formatLicenseUrl(parsed.platform, parsed.baseUrl, licenseFileName)
}
