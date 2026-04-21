import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Options for deriving project scopes.
 */
export interface DeriveProjectScopesOptions {
  /** The project name (e.g., 'lib-versioning') */
  readonly projectName: string

  /** The npm package name (e.g., '@hyperfrontend/versioning') */
  readonly packageName?: string

  /** Additional scopes to include */
  readonly additionalScopes?: readonly string[]

  /**
   * Project name prefixes to strip for scope matching.
   *
   * @default DEFAULT_PROJECT_PREFIXES
   */
  readonly prefixes?: readonly string[]
}

/**
 * Derives all scope variations that should match a project.
 *
 * Given a project named 'lib-versioning' with package '@hyperfrontend/versioning',
 * this generates variations like:
 * - 'lib-versioning' (full project name)
 * - 'versioning' (without lib- prefix)
 *
 * @param options - Project identification options
 * @returns Array of scope strings that match this project
 *
 * @example Deriving scopes for a library project
 * deriveProjectScopes({ projectName: 'lib-versioning', packageName: '@hyperfrontend/versioning' })
 * // Returns: ['lib-versioning', 'versioning']
 *
 * @example Deriving scopes for an app project
 * deriveProjectScopes({ projectName: 'app-demo', packageName: 'demo-app' })
 * // Returns: ['app-demo', 'demo']
 */
export function deriveProjectScopes(options: DeriveProjectScopesOptions): readonly string[] {
  const { projectName, packageName, additionalScopes = [], prefixes = DEFAULT_PROJECT_PREFIXES } = options
  const scopes = createSet<string>()

  scopes.add(projectName)

  const prefixVariations = extractPrefixVariations(projectName, prefixes)
  for (const variation of prefixVariations) {
    scopes.add(variation)
  }

  if (packageName) {
    const packageVariations = extractPackageNameVariations(packageName)
    for (const variation of packageVariations) {
      scopes.add(variation)
    }
  }

  for (const scope of additionalScopes) {
    if (scope) {
      scopes.add(scope)
    }
  }

  return [...scopes]
}

/**
 * Default project name prefixes that can be stripped for scope matching.
 */
export const DEFAULT_PROJECT_PREFIXES = <const>['lib-', 'app-', 'e2e-', 'tool-', 'plugin-', 'feature-', 'package-']

/**
 * Generates scope variations by stripping recognized project prefixes.
 *
 * @param projectName - The project name to extract variations from
 * @param prefixes - Prefixes to check and strip
 * @returns Array of scope name variations
 */
function extractPrefixVariations(projectName: string, prefixes: readonly string[]): readonly string[] {
  const variations: string[] = []

  for (const prefix of prefixes) {
    if (projectName.startsWith(prefix)) {
      const withoutPrefix = projectName.slice(prefix.length)
      if (withoutPrefix) {
        variations.push(withoutPrefix)
      }
      break
    }
  }

  return variations
}

/**
 * Extracts scope variations from an npm package name.
 *
 * @param packageName - The npm package name (e.g., '@scope/name')
 * @returns Array of name variations
 */
function extractPackageNameVariations(packageName: string): readonly string[] {
  const variations: string[] = []

  if (packageName.startsWith('@')) {
    const slashIndex = packageName.indexOf('/')
    if (slashIndex !== -1) {
      const unscoped = packageName.slice(slashIndex + 1)
      if (unscoped) {
        variations.push(unscoped)
      }
    }
  } else {
    variations.push(packageName)
  }

  return variations
}

/**
 * Checks if any element of a commit's scope list matches any of the project scopes.
 *
 * A commit matches the project when **any** of its scope entries matches a
 * project scope. Empty commit scopes never match.
 *
 * @param commitScopes - Scopes from a conventional commit
 * @param projectScopes - Array of scopes that match the project
 * @returns True if at least one commit scope matches the project
 *
 * @example Matching scope to project
 * scopeMatchesProject(['versioning'], ['lib-versioning', 'versioning']) // true
 * scopeMatchesProject(['logging'], ['lib-versioning', 'versioning']) // false
 * scopeMatchesProject(['versioning', 'questions'], ['lib-questions']) // true
 * scopeMatchesProject([], ['lib-versioning']) // false
 */
export function scopeMatchesProject(commitScopes: readonly string[], projectScopes: readonly string[]): boolean {
  if (commitScopes.length === 0) {
    return false
  }

  const normalizedProjectScopes = projectScopes.map((scope) => scope.toLowerCase())
  return commitScopes.some((commitScope) => normalizedProjectScopes.includes(commitScope.toLowerCase()))
}

/**
 * Checks if all scopes of a commit are in the exclude list.
 *
 * A commit is excluded only when **every** scope entry matches an exclude
 * scope. Commits with no scope entries are never considered excluded here.
 *
 * @param commitScopes - Scopes from a conventional commit
 * @param excludeScopes - Array of scopes to exclude
 * @returns True if every commit scope is in the exclude list
 *
 * @example Checking if a scope should be excluded
 * ```typescript
 * scopeIsExcluded(['release'], ['release', 'deps'])
 * // => true
 *
 * scopeIsExcluded(['auth'], ['release', 'deps'])
 * // => false
 *
 * scopeIsExcluded([], ['release'])
 * // => false
 *
 * scopeIsExcluded(['release', 'auth'], ['release'])
 * // => false (not every scope is excluded)
 * ```
 */
export function scopeIsExcluded(commitScopes: readonly string[], excludeScopes: readonly string[]): boolean {
  if (commitScopes.length === 0) {
    return false
  }

  const normalizedExcludes = excludeScopes.map((scope) => scope.toLowerCase())
  return commitScopes.every((commitScope) => normalizedExcludes.includes(commitScope.toLowerCase()))
}

/**
 * Default scopes to exclude from changelogs.
 *
 * These represent repository-level or infrastructure changes
 * that typically don't belong in individual project changelogs.
 */
export const DEFAULT_EXCLUDE_SCOPES: readonly string[] = ['release', 'deps', 'workspace', 'root', 'repo', 'ci', 'build']
