import type { RepositoryPlatform } from '../models/platform'
import type { RepositoryConfig } from '../models/repository-config'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { detectPlatformFromHostname } from '../models/platform'
import { createRepositoryConfig } from '../models/repository-config'

/**
 * Parsed repository information extracted from a git URL.
 */
export interface ParsedRepository {
  /**
   * Detected platform type.
   */
  readonly platform: RepositoryPlatform

  /**
   * Base URL for the repository (without trailing slashes or .git suffix).
   *
   * @example
   * - GitHub: `"https://github.com/owner/repo"`
   * - GitLab: `"https://gitlab.com/group/project"`
   * - Azure DevOps: `"https://dev.azure.com/org/project/_git/repo"`
   */
  readonly baseUrl: string
}

/**
 * Parses a git URL and extracts platform and base URL.
 *
 * Supports multiple URL formats:
 * - `https://github.com/owner/repo`
 * - `https://github.com/owner/repo.git`
 * - `git+https://github.com/owner/repo.git`
 * - `git://github.com/owner/repo.git`
 * - `git@github.com:owner/repo.git` (SSH format)
 *
 * Handles self-hosted instances by detecting platform from hostname:
 * - `github.mycompany.com` → `github`
 * - `gitlab.internal.com` → `gitlab`
 *
 * Handles Azure DevOps URL formats:
 * - `https://dev.azure.com/org/project/_git/repo`
 * - `https://org.visualstudio.com/project/_git/repo`
 *
 * @param gitUrl - Git repository URL in any supported format
 * @returns Parsed repository info with platform and base URL, or null if parsing fails
 *
 * @example
 * ```typescript
 * // GitHub HTTPS
 * parseRepositoryUrl('https://github.com/owner/repo')
 * // → { platform: 'github', baseUrl: 'https://github.com/owner/repo' }
 *
 * // SSH format
 * parseRepositoryUrl('git@github.com:owner/repo.git')
 * // → { platform: 'github', baseUrl: 'https://github.com/owner/repo' }
 *
 * // Azure DevOps
 * parseRepositoryUrl('https://dev.azure.com/org/proj/_git/repo')
 * // → { platform: 'azure-devops', baseUrl: 'https://dev.azure.com/org/proj/_git/repo' }
 *
 * // Self-hosted GitLab
 * parseRepositoryUrl('https://gitlab.mycompany.com/team/project')
 * // → { platform: 'gitlab', baseUrl: 'https://gitlab.mycompany.com/team/project' }
 * ```
 */
export function parseRepositoryUrl(gitUrl: string): ParsedRepository | null {
  if (!gitUrl || typeof gitUrl !== 'string') {
    return null
  }

  const trimmed = gitUrl.trim()
  if (!trimmed) {
    return null
  }

  const sshParsed = parseSshUrl(trimmed)
  if (sshParsed) {
    return sshParsed
  }

  const httpParsed = parseHttpUrl(trimmed)
  if (httpParsed) {
    return httpParsed
  }

  return null
}

/**
 * Parses an SSH-style git URL.
 *
 * @param url - URL to parse (e.g., "git@github.com:owner/repo.git")
 * @returns Parsed repository or null
 *
 * @internal
 */
function parseSshUrl(url: string): ParsedRepository | null {
  let remaining = url
  if (remaining.startsWith('ssh://')) {
    remaining = remaining.slice(6)
  }

  if (!remaining.startsWith('git@')) {
    return null
  }

  remaining = remaining.slice(4)

  const colonIndex = remaining.indexOf(':')
  const slashIndex = remaining.indexOf('/')

  let separatorIndex: number
  if (colonIndex === -1 && slashIndex === -1) {
    return null
  } else if (colonIndex === -1) {
    separatorIndex = slashIndex
  } else if (slashIndex === -1) {
    separatorIndex = colonIndex
  } else {
    separatorIndex = min(colonIndex, slashIndex)
  }

  const hostname = remaining.slice(0, separatorIndex)
  const pathPart = normalizePathPart(remaining.slice(separatorIndex + 1))

  if (!hostname || !pathPart) {
    return null
  }

  const platform = detectPlatformFromHostname(hostname)

  if (platform === 'azure-devops') {
    const baseUrl = constructAzureDevOpsBaseUrl(hostname, pathPart)
    if (baseUrl) {
      return { platform, baseUrl }
    }
    return null
  }

  const baseUrl = `https://${hostname}/${pathPart}`
  return { platform, baseUrl }
}

/**
 * Parses an HTTP(S)-style git URL.
 *
 * @param url - URL to parse
 * @returns Parsed repository or null
 *
 * @internal
 */
function parseHttpUrl(url: string): ParsedRepository | null {
  const normalized = url.replace(/^git\+/, '').replace(/^git:\/\//, 'https://')

  let parsed: URL
  try {
    parsed = createURL(normalized)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null
  }

  const hostname = parsed.hostname.toLowerCase()
  const platform = detectPlatformFromHostname(hostname)
  const pathPart = normalizePathPart(parsed.pathname)

  if (!pathPart) {
    return null
  }

  if (platform === 'azure-devops') {
    const baseUrl = constructAzureDevOpsBaseUrl(hostname, pathPart)
    if (baseUrl) {
      return { platform, baseUrl }
    }
    return null
  }

  const baseUrl = `${parsed.protocol}//${hostname}/${pathPart}`
  return { platform, baseUrl }
}

/**
 * Normalizes a path part by removing leading slashes and .git suffix.
 *
 * @param path - Path to normalize
 * @returns Normalized path or null if empty
 *
 * @internal
 */
function normalizePathPart(path: string): string | null {
  let normalized = path.trim()

  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1)
  }

  while (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  if (normalized.endsWith('.git')) {
    normalized = normalized.slice(0, -4)
  }

  if (!normalized) {
    return null
  }

  return normalized
}

/**
 * Constructs the base URL for Azure DevOps repositories.
 *
 * Azure DevOps has special URL structures:
 * - Modern: `https://dev.azure.com/{org}/{project}/_git/{repo}`
 * - Legacy: `https://{org}.visualstudio.com/{project}/_git/{repo}`
 * - SSH: `git@ssh.dev.azure.com:v3/{org}/{project}/{repo}`
 *
 * @param hostname - Hostname from the URL
 * @param pathPart - Path portion after hostname
 * @returns Constructed base URL or null if invalid
 *
 * @internal
 */
function constructAzureDevOpsBaseUrl(hostname: string, pathPart: string): string | null {
  const pathParts = pathPart.split('/')

  if (hostname === 'dev.azure.com' || hostname.endsWith('.azure.com')) {
    if (pathParts.length >= 4) {
      if (pathParts[0] === 'v3') {
        const org = pathParts[1]
        const project = pathParts[2]
        const repo = pathParts[3]
        if (org && project && repo) {
          return `https://dev.azure.com/${org}/${project}/_git/${repo}`
        }
      }

      const gitIndex = pathParts.indexOf('_git')
      if (gitIndex >= 2 && pathParts[gitIndex + 1]) {
        const org = pathParts.slice(0, gitIndex - 1).join('/')
        const project = pathParts[gitIndex - 1]
        const repo = pathParts[gitIndex + 1]
        if (org && project && repo) {
          return `https://dev.azure.com/${org}/${project}/_git/${repo}`
        }
      }
    }
    return null
  }

  if (hostname.endsWith('.visualstudio.com')) {
    const org = hostname.replace('.visualstudio.com', '')
    const gitIndex = pathParts.indexOf('_git')

    if (gitIndex >= 1 && pathParts[gitIndex + 1]) {
      const project = pathParts.slice(0, gitIndex).join('/')
      const repo = pathParts[gitIndex + 1]
      if (project && repo) {
        return `https://dev.azure.com/${org}/${project}/_git/${repo}`
      }
    }
    return null
  }

  return null
}

/**
 * Creates a RepositoryConfig from a git URL.
 *
 * This is a convenience function that combines `parseRepositoryUrl` with
 * `createRepositoryConfig` to produce a ready-to-use configuration.
 *
 * @param gitUrl - Git repository URL in any supported format
 * @returns RepositoryConfig or null if URL cannot be parsed
 *
 * @example
 * ```typescript
 * const config = createRepositoryConfigFromUrl('https://github.com/owner/repo')
 * // → { platform: 'github', baseUrl: 'https://github.com/owner/repo' }
 *
 * const config = createRepositoryConfigFromUrl('git@gitlab.com:group/project.git')
 * // → { platform: 'gitlab', baseUrl: 'https://gitlab.com/group/project' }
 * ```
 */
export function createRepositoryConfigFromUrl(gitUrl: string): RepositoryConfig | null {
  const parsed = parseRepositoryUrl(gitUrl)

  if (!parsed) {
    return null
  }

  if (parsed.platform === 'unknown') {
    return null
  }

  return createRepositoryConfig({
    platform: parsed.platform,
    baseUrl: parsed.baseUrl,
  })
}
