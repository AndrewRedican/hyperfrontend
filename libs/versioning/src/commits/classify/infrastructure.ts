import type { GitCommit } from '../../git/models/commit'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Context provided to infrastructure matchers for decision making.
 *
 * Contains information about a commit that helps determine
 * whether it should be classified as infrastructure-related.
 */
export interface InfrastructureMatchContext {
  /** The git commit being evaluated */
  readonly commit: GitCommit

  /** Parsed conventional scope (convenience, may be undefined) */
  readonly scope?: string

  /** Commit message subject */
  readonly subject: string

  /** Full commit message */
  readonly message: string
}

/**
 * Infrastructure matcher function type.
 *
 * Returns true if the commit should be classified as infrastructure-related.
 * Matchers are composable - combine them using `anyOf`, `allOf`, and `not`.
 *
 * @example
 * // Simple scope matcher
 * const ciMatcher: InfrastructureMatcher = (ctx) => ctx.scope === 'ci'
 *
 * @example
 * // Using factory functions
 * const matcher = anyOf(
 *   scopeMatcher(['ci', 'build', 'tooling']),
 *   pathMatcher(['tools/', '.github/'])
 * )
 */
export type InfrastructureMatcher = (context: InfrastructureMatchContext) => boolean

/**
 * Configuration for building infrastructure commit sets.
 *
 * Supports multiple detection methods that can be combined:
 * - Path-based: Commits touching specific file paths
 * - Scope-based: Commits with specific conventional scopes
 * - Custom matcher: User-provided matching logic
 */
export interface InfrastructureConfig {
  /**
   * File/directory paths that indicate infrastructure changes.
   * Used to query git for commits touching these paths.
   *
   * @example ['tools/', '.github/workflows/', 'nx.json']
   */
  readonly paths?: readonly string[]

  /**
   * Conventional commit scopes that indicate infrastructure.
   * Matched against parsed commit scope.
   *
   * @example ['ci', 'build', 'tooling', 'workspace']
   */
  readonly scopes?: readonly string[]

  /**
   * Custom matcher function for complex logic.
   * Combined with paths/scopes using OR logic.
   *
   * @example (ctx) => ctx.message.includes('[infra]')
   */
  readonly matcher?: InfrastructureMatcher
}

/**
 * Creates a matcher that checks if commit scope matches any of the given scopes.
 *
 * @param scopes - Scopes to match against (case-insensitive)
 * @returns Matcher that returns true if scope matches
 *
 * @example Matching against specific scopes
 * const matcher = scopeMatcher(['ci', 'build', 'tooling'])
 * matcher({ scope: 'CI', ... }) // true
 * matcher({ scope: 'feat', ... }) // false
 */
export function scopeMatcher(scopes: readonly string[]): InfrastructureMatcher {
  const normalizedScopes = createSet(scopes.map((s) => s.toLowerCase()))
  return (ctx) => {
    if (!ctx.scope) return false
    return normalizedScopes.has(ctx.scope.toLowerCase())
  }
}

/**
 * Creates a matcher that checks if commit scope starts with any of the given prefixes.
 *
 * @param prefixes - Scope prefixes to match (case-insensitive)
 * @returns Matcher that returns true if scope starts with any prefix
 *
 * @example Matching prefixed scopes
 * const matcher = scopePrefixMatcher(['tool-', 'infra-'])
 * matcher({ scope: 'tool-package', ... }) // true
 * matcher({ scope: 'lib-utils', ... }) // false
 */
export function scopePrefixMatcher(prefixes: readonly string[]): InfrastructureMatcher {
  const normalizedPrefixes = prefixes.map((p) => p.toLowerCase())
  return (ctx) => {
    if (!ctx.scope) return false
    const normalizedScope = ctx.scope.toLowerCase()
    return normalizedPrefixes.some((prefix) => normalizedScope.startsWith(prefix))
  }
}

/**
 * Creates a matcher that checks if commit message contains any of the given patterns.
 *
 * @param patterns - Patterns to search for in commit message (case-insensitive)
 * @returns Matcher that returns true if message contains any pattern
 *
 * @example Matching message patterns
 * const matcher = messageMatcher(['[infra]', '[ci skip]'])
 */
export function messageMatcher(patterns: readonly string[]): InfrastructureMatcher {
  const normalizedPatterns = patterns.map((p) => p.toLowerCase())
  return (ctx) => {
    const normalizedMessage = ctx.message.toLowerCase()
    return normalizedPatterns.some((pattern) => normalizedMessage.includes(pattern))
  }
}

/**
 * Creates a matcher from a regex pattern tested against the scope.
 *
 * @param pattern - Regex pattern to test against scope
 * @returns Matcher that returns true if scope matches regex
 *
 * @example Matching with regex pattern
 * const matcher = scopeRegexMatcher(/^(ci|build|tool)-.+/)
 */
export function scopeRegexMatcher(pattern: RegExp): InfrastructureMatcher {
  return (ctx) => {
    if (!ctx.scope) return false
    return pattern.test(ctx.scope)
  }
}

/**
 * Combines matchers with OR logic - returns true if ANY matcher matches.
 *
 * @param matchers - Matchers to combine
 * @returns Combined matcher
 *
 * @example Combining matchers with OR logic
 * const combined = anyOf(
 *   scopeMatcher(['ci', 'build']),
 *   messageMatcher(['[infra]']),
 *   custom((ctx) => ctx.scope?.startsWith('tool-'))
 * )
 */
export function anyOf(...matchers: readonly InfrastructureMatcher[]): InfrastructureMatcher {
  return (ctx) => matchers.some((matcher) => matcher(ctx))
}

/**
 * Combines matchers with AND logic - returns true if ALL matchers match.
 *
 * @param matchers - Matchers to combine
 * @returns Combined matcher
 *
 * @example Combining matchers with AND logic
 * const combined = allOf(
 *   scopeMatcher(['deps']),
 *   messageMatcher(['security'])
 * )
 */
export function allOf(...matchers: readonly InfrastructureMatcher[]): InfrastructureMatcher {
  return (ctx) => matchers.every((matcher) => matcher(ctx))
}

/**
 * Negates a matcher - returns true if matcher returns false.
 *
 * @param matcher - Matcher to negate
 * @returns Negated matcher
 *
 * @example Negating a matcher
 * const notRelease = not(scopeMatcher(['release']))
 */
export function not(matcher: InfrastructureMatcher): InfrastructureMatcher {
  return (ctx) => !matcher(ctx)
}

/**
 * Matches common CI/CD scopes.
 *
 * Matches: ci, cd, build, pipeline, workflow, actions
 */
export const CI_SCOPE_MATCHER: InfrastructureMatcher = scopeMatcher(['ci', 'cd', 'build', 'pipeline', 'workflow', 'actions'])

/**
 * Matches common tooling/workspace scopes.
 *
 * Matches: tooling, workspace, monorepo, nx, root
 */
export const TOOLING_SCOPE_MATCHER: InfrastructureMatcher = scopeMatcher(['tooling', 'workspace', 'monorepo', 'nx', 'root'])

/**
 * Matches tool-prefixed scopes (e.g., tool-package, tool-scripts).
 */
export const TOOL_PREFIX_MATCHER: InfrastructureMatcher = scopePrefixMatcher(['tool-'])

/**
 * Combined matcher for common infrastructure patterns.
 *
 * Combines CI, tooling, and tool-prefix matchers.
 */
export const DEFAULT_INFRA_SCOPE_MATCHER: InfrastructureMatcher = anyOf(CI_SCOPE_MATCHER, TOOLING_SCOPE_MATCHER, TOOL_PREFIX_MATCHER)

/**
 * Builds a combined matcher from infrastructure configuration.
 *
 * Combines scope-based matching with any custom matcher using OR logic.
 * Path-based matching is handled separately via git queries.
 *
 * @param config - Infrastructure configuration
 * @returns Combined matcher, or null if no matchers configured
 *
 * @example Building an infrastructure matcher
 * const matcher = buildInfrastructureMatcher({
 *   scopes: ['ci', 'build'],
 *   matcher: (ctx) => ctx.scope?.startsWith('tool-')
 * })
 */
export function buildInfrastructureMatcher(config: InfrastructureConfig): InfrastructureMatcher | null {
  const matchers: InfrastructureMatcher[] = []

  if (config.scopes && config.scopes.length > 0) {
    matchers.push(scopeMatcher(config.scopes))
  }

  if (config.matcher) {
    matchers.push(config.matcher)
  }

  if (matchers.length === 0) {
    return null
  }
  if (matchers.length === 1) {
    return matchers[0] ?? null
  }
  return anyOf(...matchers)
}

/**
 * Creates match context from a git commit.
 *
 * Extracts scope from conventional commit message if present.
 *
 * @param commit - Git commit to create context for
 * @param scope - Pre-parsed scope (optional, saves re-parsing)
 * @returns Match context for use with matchers
 *
 * @example Creating match context from a git commit
 * ```typescript
 * const commit = { hash: 'abc123', subject: 'chore(ci): update workflow', message: 'chore(ci): update workflow' }
 * createMatchContext(commit, 'ci')
 * // => { commit, scope: 'ci', subject: 'chore(ci): update workflow', message: 'chore(ci): update workflow' }
 * ```
 */
export function createMatchContext(commit: GitCommit, scope?: string): InfrastructureMatchContext {
  return {
    commit,
    scope,
    subject: commit.subject,
    message: commit.message,
  }
}

/**
 * Evaluates a commit against an infrastructure matcher.
 *
 * @param commit - Git commit to evaluate
 * @param matcher - Matcher function to apply
 * @param scope - Pre-parsed scope (optional)
 * @returns True if commit matches infrastructure criteria
 *
 * @example Evaluating a commit against infrastructure matcher
 * ```typescript
 * const commit = { hash: 'abc123', subject: 'chore(ci): update workflow', message: '...' }
 * const ciMatcher = (ctx) => ctx.scope === 'ci'
 * evaluateInfrastructure(commit, ciMatcher, 'ci')
 * // => true
 * ```
 */
export function evaluateInfrastructure(commit: GitCommit, matcher: InfrastructureMatcher, scope?: string): boolean {
  const context = createMatchContext(commit, scope)
  return matcher(context)
}
