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
 * @example
 * deriveProjectScopes({ projectName: 'lib-versioning', packageName: '@hyperfrontend/versioning' })
 * // Returns: ['lib-versioning', 'versioning']
 *
 * @example
 * deriveProjectScopes({ projectName: 'app-demo', packageName: 'demo-app' })
 * // Returns: ['app-demo', 'demo']
 */
export function deriveProjectScopes(options: DeriveProjectScopesOptions): readonly string[] {
  const { projectName, packageName, additionalScopes = [], prefixes = DEFAULT_PROJECT_PREFIXES } = options
  const scopes = createSet<string>()

  // Always include the full project name
  scopes.add(projectName)

  // Add variations based on common prefixes
  const prefixVariations = extractPrefixVariations(projectName, prefixes)
  for (const variation of prefixVariations) {
    scopes.add(variation)
  }

  // Add package name variations if provided
  if (packageName) {
    const packageVariations = extractPackageNameVariations(packageName)
    for (const variation of packageVariations) {
      scopes.add(variation)
    }
  }

  // Add any additional scopes
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
      break // Only remove one prefix
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

  // Handle scoped packages: @scope/name -> name
  if (packageName.startsWith('@')) {
    const slashIndex = packageName.indexOf('/')
    if (slashIndex !== -1) {
      const unscoped = packageName.slice(slashIndex + 1)
      if (unscoped) {
        variations.push(unscoped)
      }
    }
  } else {
    // Non-scoped package: just use the name
    variations.push(packageName)
  }

  return variations
}

/**
 * Checks if a commit scope matches any of the project scopes.
 *
 * @param commitScope - The scope from a conventional commit
 * @param projectScopes - Array of scopes that match the project
 * @returns True if the commit scope matches the project
 *
 * @example
 * scopeMatchesProject('versioning', ['lib-versioning', 'versioning']) // true
 * scopeMatchesProject('logging', ['lib-versioning', 'versioning']) // false
 */
export function scopeMatchesProject(commitScope: string | undefined, projectScopes: readonly string[]): boolean {
  if (!commitScope) {
    return false
  }

  // Case-insensitive comparison
  const normalizedScope = commitScope.toLowerCase()
  return projectScopes.some((scope) => scope.toLowerCase() === normalizedScope)
}

/**
 * Checks if a commit scope should be explicitly excluded.
 *
 * @param commitScope - The scope from a conventional commit
 * @param excludeScopes - Array of scopes to exclude
 * @returns True if the scope should be excluded
 */
export function scopeIsExcluded(commitScope: string | undefined, excludeScopes: readonly string[]): boolean {
  if (!commitScope) {
    return false
  }

  const normalizedScope = commitScope.toLowerCase()
  return excludeScopes.some((scope) => scope.toLowerCase() === normalizedScope)
}

/**
 * Default scopes to exclude from changelogs.
 *
 * These represent repository-level or infrastructure changes
 * that typically don't belong in individual project changelogs.
 */
export const DEFAULT_EXCLUDE_SCOPES: readonly string[] = ['release', 'deps', 'workspace', 'root', 'repo', 'ci', 'build']
