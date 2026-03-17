import type { RepositoryConfig } from '../models/repository-config'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createRepositoryConfigFromUrl, parseRepositoryUrl } from './url'

/**
 * Repository field formats from package.json.
 *
 * Package.json supports multiple formats for the repository field:
 * - Shorthand: `"github:owner/repo"`
 * - URL string: `"https://github.com/owner/repo"`
 * - Object: `{ "type": "git", "url": "..." }`
 */
export interface PackageJsonRepository {
  /**
   * Repository type (typically "git").
   */
  readonly type?: string

  /**
   * Repository URL.
   */
  readonly url: string

  /**
   * Directory within the repository (for monorepos).
   */
  readonly directory?: string
}

/**
 * Minimal package.json structure for repository inference.
 */
export interface PackageJsonForRepository {
  /**
   * Repository field - can be a string or object.
   */
  readonly repository?: string | PackageJsonRepository
}

/**
 * Shorthand platform prefixes supported in package.json repository field.
 *
 * Format: `"platform:owner/repo"` or `"owner/repo"` (defaults to GitHub)
 *
 * @see https://docs.npmjs.com/cli/v9/configuring-npm/package-json#repository
 */
const SHORTHAND_PLATFORMS: ReadonlyMap<string, string> = createMap([
  ['github', 'https://github.com'],
  ['gitlab', 'https://gitlab.com'],
  ['bitbucket', 'https://bitbucket.org'],
  ['gist', 'https://gist.github.com'],
])

/**
 * Infers repository configuration from package.json content.
 *
 * Handles multiple formats:
 * - Shorthand: `"github:owner/repo"`, `"gitlab:group/project"`, `"bitbucket:team/repo"`
 * - Bare shorthand: `"owner/repo"` (defaults to GitHub)
 * - URL string: `"https://github.com/owner/repo"`
 * - Object with URL: `{ "type": "git", "url": "https://..." }`
 *
 * @param packageJsonContent - Raw JSON string content of package.json
 * @returns RepositoryConfig or null if repository cannot be inferred
 *
 * @example
 * ```typescript
 * // Shorthand format
 * inferRepositoryFromPackageJson('{"repository": "github:owner/repo"}')
 * // → { platform: 'github', baseUrl: 'https://github.com/owner/repo' }
 *
 * // URL string
 * inferRepositoryFromPackageJson('{"repository": "https://github.com/owner/repo"}')
 * // → { platform: 'github', baseUrl: 'https://github.com/owner/repo' }
 *
 * // Object format
 * inferRepositoryFromPackageJson('{"repository": {"type": "git", "url": "https://github.com/owner/repo"}}')
 * // → { platform: 'github', baseUrl: 'https://github.com/owner/repo' }
 *
 * // Bare shorthand (defaults to GitHub)
 * inferRepositoryFromPackageJson('{"repository": "owner/repo"}')
 * // → { platform: 'github', baseUrl: 'https://github.com/owner/repo' }
 * ```
 */
export function inferRepositoryFromPackageJson(packageJsonContent: string): RepositoryConfig | null {
  if (!packageJsonContent || typeof packageJsonContent !== 'string') {
    return null
  }

  let packageJson: PackageJsonForRepository
  try {
    packageJson = parse(packageJsonContent)
  } catch {
    return null
  }

  return inferRepositoryFromPackageJsonObject(packageJson)
}

/**
 * Infers repository configuration from a parsed package.json object.
 *
 * This is useful when you already have the parsed object.
 *
 * @param packageJson - Parsed package.json object
 * @returns RepositoryConfig or null if repository cannot be inferred
 *
 * @example
 * ```typescript
 * const pkg = { repository: 'github:owner/repo' }
 * inferRepositoryFromPackageJsonObject(pkg)
 * // → { platform: 'github', baseUrl: 'https://github.com/owner/repo' }
 * ```
 */
export function inferRepositoryFromPackageJsonObject(packageJson: PackageJsonForRepository): RepositoryConfig | null {
  const { repository } = packageJson

  if (!repository) {
    return null
  }

  // Handle string format
  if (typeof repository === 'string') {
    return parseRepositoryString(repository)
  }

  // Handle object format
  if (typeof repository === 'object' && repository.url) {
    return createRepositoryConfigFromUrl(repository.url)
  }

  return null
}

/**
 * Parses a repository string (shorthand or URL).
 *
 * @param repoString - Repository string from package.json
 * @returns RepositoryConfig or null
 *
 * @internal
 */
function parseRepositoryString(repoString: string): RepositoryConfig | null {
  const trimmed = repoString.trim()
  if (!trimmed) {
    return null
  }

  // Check for shorthand format: platform:owner/repo
  const colonIndex = trimmed.indexOf(':')
  if (colonIndex > 0) {
    const potentialPlatform = trimmed.slice(0, colonIndex)
    // Platform must be only letters (a-z, case insensitive)
    if (isOnlyLetters(potentialPlatform)) {
      const platform = potentialPlatform.toLowerCase()
      const path = trimmed.slice(colonIndex + 1)

      if (path) {
        const baseUrl = SHORTHAND_PLATFORMS.get(platform)
        if (baseUrl) {
          // Construct full URL and parse it
          const fullUrl = `${baseUrl}/${path}`
          return createRepositoryConfigFromUrl(fullUrl)
        }

        // Unknown shorthand platform - try as URL
        return createRepositoryConfigFromUrl(trimmed)
      }
    }
  }

  // Check for bare shorthand: owner/repo (no protocol, no platform prefix)
  // Must match pattern like "owner/repo" but not "https://..." or "git@..."
  if (!trimmed.includes('://') && !trimmed.startsWith('git@')) {
    if (isBareShorthand(trimmed)) {
      // Bare shorthand defaults to GitHub
      const fullUrl = `https://github.com/${trimmed}`
      return createRepositoryConfigFromUrl(fullUrl)
    }
  }

  // Try as a full URL
  return createRepositoryConfigFromUrl(trimmed)
}

/**
 * Checks if a string contains only ASCII letters (a-z, A-Z).
 *
 * @param str - String to check
 * @returns True if string contains only letters
 *
 * @internal
 */
function isOnlyLetters(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    const isLowercase = char >= 97 && char <= 122 // a-z
    const isUppercase = char >= 65 && char <= 90 // A-Z
    if (!isLowercase && !isUppercase) {
      return false
    }
  }
  return str.length > 0
}

/**
 * Checks if a string is a bare shorthand format (owner/repo).
 * Must have exactly one forward slash with content on both sides.
 *
 * @param str - String to check
 * @returns True if string matches owner/repo format
 *
 * @internal
 */
function isBareShorthand(str: string): boolean {
  const slashIndex = str.indexOf('/')
  if (slashIndex <= 0 || slashIndex === str.length - 1) {
    return false
  }
  // Must not have another slash
  return str.indexOf('/', slashIndex + 1) === -1
}

/**
 * Extracts the repository URL from package.json content.
 *
 * Unlike `inferRepositoryFromPackageJson`, this returns just the URL string
 * without creating a RepositoryConfig. Useful when you need the raw URL.
 *
 * @param packageJsonContent - Raw JSON string content of package.json
 * @returns Repository URL string or null if not found
 *
 * @example
 * ```typescript
 * extractRepositoryUrl('{"repository": {"url": "https://github.com/owner/repo"}}')
 * // → 'https://github.com/owner/repo'
 *
 * extractRepositoryUrl('{"repository": "github:owner/repo"}')
 * // → null (shorthand is not a URL)
 * ```
 */
export function extractRepositoryUrl(packageJsonContent: string): string | null {
  if (!packageJsonContent || typeof packageJsonContent !== 'string') {
    return null
  }

  let packageJson: PackageJsonForRepository
  try {
    packageJson = parse(packageJsonContent)
  } catch {
    return null
  }

  const { repository } = packageJson

  if (!repository) {
    return null
  }

  // String URL format
  if (typeof repository === 'string') {
    // Check if it's a URL (has protocol)
    if (repository.includes('://') || repository.startsWith('git@')) {
      const parsed = parseRepositoryUrl(repository)
      return parsed && parsed.platform !== 'unknown' ? parsed.baseUrl : null
    }
    // Shorthand - need to expand
    const config = parseRepositoryString(repository)
    return config ? config.baseUrl : null
  }

  // Object format
  if (typeof repository === 'object' && repository.url) {
    const parsed = parseRepositoryUrl(repository.url)
    return parsed && parsed.platform !== 'unknown' ? parsed.baseUrl : null
  }

  return null
}
