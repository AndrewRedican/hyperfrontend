import type { GitCommit } from '../../git/models/commit'
import type { ConventionalCommit } from '../models/conventional'

/**
 * Source of how a commit relates to a project.
 *
 * Classification determines whether a commit should appear in a
 * project's changelog and how its scope should be displayed.
 */
export type CommitSource =
  | 'direct-scope'
  | 'direct-file'
  | 'unscoped-file'
  | 'indirect-dependency'
  | 'indirect-infra'
  | 'unscoped-global'
  | 'excluded'

/**
 * A commit with classification metadata for changelog generation.
 *
 * Contains the original commit data plus attribution information
 * that determines inclusion and presentation in changelogs.
 */
export interface ClassifiedCommit {
  /** The parsed conventional commit */
  readonly commit: ConventionalCommit

  /** The raw git commit (for hash, date, etc.) */
  readonly raw: GitCommit

  /** How this commit relates to the project */
  readonly source: CommitSource

  /** Whether to include this commit in changelog */
  readonly include: boolean

  /** Whether to preserve scope in changelog output */
  readonly preserveScope: boolean

  /** Files in this project touched by the commit (if applicable) */
  readonly touchedFiles?: readonly string[]

  /** Dependency chain if indirect (e.g., ['lib-utils'] for lib-app → lib-utils) */
  readonly dependencyPath?: readonly string[]
}

/**
 * Input for classification - a parsed commit with its raw git data.
 */
export interface CommitWithRaw {
  /** The parsed conventional commit */
  readonly commit: ConventionalCommit

  /** The raw git commit data */
  readonly raw: GitCommit
}

/**
 * Classification context containing project and workspace info.
 */
export interface ClassificationContext {
  /** Scopes that should be considered direct matches */
  readonly projectScopes: readonly string[]

  /** Set of commit hashes that touched project files */
  readonly fileCommitHashes: ReadonlySet<string>

  /** Map of dependency name to set of commit hashes touching that dependency */
  readonly dependencyCommitMap?: ReadonlyMap<string, ReadonlySet<string>>

  /**
   * Set of commit hashes that touched infrastructure paths.
   * These commits will be classified as 'indirect-infra'.
   */
  readonly infrastructureCommitHashes?: ReadonlySet<string>

  /** Scopes to always exclude */
  readonly excludeScopes?: readonly string[]

  /** Additional scopes to include as direct */
  readonly includeScopes?: readonly string[]
}

/**
 * Result of classifying multiple commits.
 */
export interface ClassificationResult {
  /** All classified commits */
  readonly commits: readonly ClassifiedCommit[]

  /** Commits to include in changelog */
  readonly included: readonly ClassifiedCommit[]

  /** Commits excluded from changelog */
  readonly excluded: readonly ClassifiedCommit[]

  /** Summary statistics */
  readonly summary: ClassificationSummary
}

/**
 * Summary statistics from classification.
 */
export interface ClassificationSummary {
  /** Total commits processed */
  readonly total: number

  /** Commits included in changelog */
  readonly included: number

  /** Commits excluded from changelog */
  readonly excluded: number

  /** Breakdown by source type */
  readonly bySource: Readonly<Record<CommitSource, number>>
}

/**
 * Creates an empty classification summary.
 *
 * @returns A new ClassificationSummary with all counts at zero
 *
 * @example Creating an empty classification summary
 * ```typescript
 * const summary = createEmptyClassificationSummary()
 * // => { total: 0, included: 0, excluded: 0, bySource: { 'direct-scope': 0, ... } }
 * ```
 */
export function createEmptyClassificationSummary(): ClassificationSummary {
  return {
    total: 0,
    included: 0,
    excluded: 0,
    bySource: {
      'direct-scope': 0,
      'direct-file': 0,
      'unscoped-file': 0,
      'indirect-dependency': 0,
      'indirect-infra': 0,
      'unscoped-global': 0,
      excluded: 0,
    },
  }
}

/**
 * Optional metadata that can be attached when constructing a {@link ClassifiedCommit}.
 */
export type CreateClassifiedCommitOptions = {
  /** Files in the project modified by this commit */
  readonly touchedFiles?: readonly string[]
  /** Chain of dependencies leading to indirect inclusion */
  readonly dependencyPath?: readonly string[]
}

/**
 * Creates a classified commit.
 *
 * @param commit - The parsed conventional commit
 * @param raw - The raw git commit
 * @param source - How the commit relates to the project
 * @param options - Additional classification options
 * @param options.touchedFiles - Files in the project modified by this commit
 * @param options.dependencyPath - Chain of dependencies leading to indirect inclusion
 * @returns A new ClassifiedCommit object
 *
 * @example Creating a classified commit
 * ```typescript
 * const commit = { type: 'feat', subject: 'add feature', footers: [], breaking: false, raw: '...' }
 * const raw = { hash: 'abc123', subject: 'feat: add feature', message: '...' }
 * const classified = createClassifiedCommit(commit, raw, 'direct-scope')
 * // => { commit, raw, source: 'direct-scope', include: true, preserveScope: false, ... }
 * ```
 */
export function createClassifiedCommit(
  commit: ConventionalCommit,
  raw: GitCommit,
  source: CommitSource,
  options?: CreateClassifiedCommitOptions
): ClassifiedCommit {
  const include = isIncludedSource(source)
  const preserveScope = shouldPreserveScope(source)

  return {
    commit,
    raw,
    source,
    include,
    preserveScope,
    touchedFiles: options?.touchedFiles,
    dependencyPath: options?.dependencyPath,
  }
}

/**
 * Determines if a source type should be included in changelog.
 *
 * @param source - The commit source type
 * @returns True if commits with this source should be included
 */
function isIncludedSource(source: CommitSource): boolean {
  switch (source) {
    case 'direct-scope':
    case 'direct-file':
    case 'unscoped-file':
    case 'indirect-dependency':
    case 'indirect-infra':
      return true
    case 'unscoped-global':
    case 'excluded':
      return false
  }
}

/**
 * Determines if scope should be preserved for a source type.
 *
 * Direct commits omit scope (redundant in project changelog).
 * Indirect commits preserve scope for context.
 *
 * @param source - The commit source type
 * @returns True if scope should be preserved in changelog
 */
function shouldPreserveScope(source: CommitSource): boolean {
  switch (source) {
    case 'direct-scope':
    case 'unscoped-file':
      return false
    case 'direct-file':
    case 'indirect-dependency':
    case 'indirect-infra':
      return true
    case 'unscoped-global':
    case 'excluded':
      return false
  }
}
