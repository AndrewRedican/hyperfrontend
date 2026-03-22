import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope'
import type { ChangelogEntry } from '../../changelog/models/entry'
import type { ChangelogSectionType } from '../../changelog/models/section'
import type { ClassificationResult, InfrastructureConfig, InfrastructureMatcher } from '../../commits/classify'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { RepositoryConfig, RepositoryResolution } from '../../repository/models'
import type { BumpType } from '../../semver/models/version'
import { DEFAULT_EXCLUDE_SCOPES, DEFAULT_PROJECT_PREFIXES } from '../../commits/classify'
export type { Logger } from '@hyperfrontend/logging'

/**
 * Default changelog filename.
 */
export const DEFAULT_CHANGELOG_FILENAME = 'CHANGELOG.md'

/**
 * Accumulated state during flow execution.
 * Each step can read previous state and contribute updates.
 */
export interface FlowState {
  /** Current/local version from package.json */
  readonly currentVersion?: string

  /** Published version on registry (null if never published) */
  readonly publishedVersion?: string | null

  /** Git commit hash of the last published version */
  readonly publishedCommit?: string | null

  /** Calculated next version */
  readonly nextVersion?: string

  /** Bump type (major/minor/patch/none) */
  readonly bumpType?: BumpType

  /** Analyzed commits since last release */
  readonly commits?: readonly ConventionalCommit[]

  /** Classification result with source attribution (when scope filtering enabled) */
  readonly classificationResult?: ClassificationResult

  /**
   * The verified base commit used for commit scoping and changelog generation.
   * This will be `publishedCommit` if that commit is reachable from HEAD,
   * or `null` if a fallback was used (e.g., history was rewritten).
   *
   * When null, compare URLs are omitted from the changelog.
   */
  readonly effectiveBaseCommit?: string | null

  /** Generated changelog entry */
  readonly changelogEntry?: ChangelogEntry

  /** Files modified during flow execution */
  readonly modifiedFiles?: readonly string[]

  /** Created git commit hash */
  readonly commitHash?: string

  /** Created git tag name */
  readonly tagName?: string

  /** Whether this is a first release (no prior versions) */
  readonly isFirstRelease?: boolean

  /** Repository configuration for compare URL generation */
  readonly repositoryConfig?: RepositoryConfig

  /**
   * Whether this is a pending publication scenario.
   * True when currentVersion > publishedVersion, meaning the version
   * was already bumped but not yet published to the registry.
   * When true:
   * - nextVersion is calculated from publishedVersion (not currentVersion)
   * - Changelog entries > publishedVersion should be cleaned up
   * - The correct changelog entry replaces any stacked ones
   */
  readonly isPendingPublication?: boolean

  /** Additional custom state for extensibility */
  readonly [key: string]: unknown
}

/**
 * Strategy for filtering commits to a project's changelog.
 *
 * - `'hybrid'`: Use scope + file validation (default, recommended)
 * - `'scope-only'`: Only use scope matching (fast, for disciplined teams)
 * - `'file-only'`: Only use file-based filtering (for non-scoped repos)
 * - `'inferred'`: Auto-detect from commit history
 */
export type ScopeFilteringStrategy = 'hybrid' | 'scope-only' | 'file-only' | 'inferred'

/**
 * Scope filtering configuration.
 *
 * By default, hybrid filtering is enabled universally.
 * Configuration exists for edge cases and external codebases.
 */
export interface ScopeFilteringConfig {
  /**
   * Filtering strategy.
   *
   * @default 'hybrid'
   */
  readonly strategy?: ScopeFilteringStrategy

  /**
   * Additional scopes to include as direct commits.
   * Use for shared library scopes that should appear in multiple projects.
   *
   * @example ['shared-utils', 'common']
   */
  readonly includeScopes?: readonly string[]

  /**
   * Scopes to explicitly exclude even if files match.
   * Use for infrastructure scopes that affect build but aren't "changes".
   *
   * @example ['deps', 'release']
   */
  readonly excludeScopes?: readonly string[]

  /**
   * Include commits that touch dependency packages.
   * When true, changes to dependencies appear as indirect commits.
   *
   * @default false
   */
  readonly trackDependencyChanges?: boolean

  /**
   * Project name prefixes stripped for scope matching.
   * Example: ['lib-', 'pkg-'] means 'lib-auth' matches scope 'auth'.
   *
   * @default ['lib-', 'app-', 'e2e-', 'tool-', 'plugin-', 'feature-', 'package-']
   */
  readonly projectPrefixes?: readonly string[]

  /**
   * Infrastructure tracking configuration.
   *
   * Defines how to detect commits that affect build/tooling infrastructure.
   * Supports multiple detection methods:
   * - `paths`: File paths to track via git queries
   * - `scopes`: Conventional commit scopes to match
   * - `matcher`: Custom matching logic
   *
   * All methods are combined with OR logic.
   *
   * @example
   * // Simple path-based
   * infrastructure: { paths: ['tools/', '.github/workflows/'] }
   *
   * @example
   * // Scope-based
   * infrastructure: { scopes: ['ci', 'build', 'tooling'] }
   *
   * @example
   * // Composable matcher
   * import { anyOf, scopeMatcher, scopePrefixMatcher } from '@hyperfrontend/versioning'
   * infrastructure: {
   *   paths: ['tools/'],
   *   matcher: anyOf(
   *     scopeMatcher(['ci', 'build']),
   *     scopePrefixMatcher(['tool-'])
   *   )
   * }
   */
  readonly infrastructure?: InfrastructureConfig

  /**
   * Custom infrastructure matcher function.
   *
   * Provides full programmatic control over infrastructure detection.
   * Takes precedence over `infrastructure` config if both provided.
   *
   * @example
   * infrastructureMatcher: (ctx) => {
   *   // Match CI scopes
   *   if (ctx.scope === 'ci' || ctx.scope === 'build') return true
   *   // Match tool-prefixed scopes
   *   if (ctx.scope?.startsWith('tool-')) return true
   *   // Match workspace commits during major refactors
   *   if (ctx.message.includes('[infra]')) return true
   *   return false
   * }
   */
  readonly infrastructureMatcher?: InfrastructureMatcher
}

/**
 * Default scope filtering configuration.
 *
 * Uses DEFAULT_EXCLUDE_SCOPES from commits/classify to ensure consistency
 * between flow-level filtering and commit classification.
 */
export const DEFAULT_SCOPE_FILTERING_CONFIG: Required<Omit<ScopeFilteringConfig, 'infrastructure' | 'infrastructureMatcher'>> & {
  infrastructure: undefined
  infrastructureMatcher: undefined
} = {
  strategy: 'hybrid',
  includeScopes: [],
  excludeScopes: DEFAULT_EXCLUDE_SCOPES,
  trackDependencyChanges: false,
  projectPrefixes: DEFAULT_PROJECT_PREFIXES,
  infrastructure: undefined,
  infrastructureMatcher: undefined,
}

/**
 * Flow configuration options.
 */
export interface FlowConfig {
  /** Preset name or custom configuration */
  readonly preset?: 'conventional' | 'independent' | 'synced'

  /** Commit types that trigger releases */
  readonly releaseTypes?: readonly string[]

  /** Commit types that trigger minor bumps */
  readonly minorTypes?: readonly string[]

  /** Commit types that trigger patch bumps */
  readonly patchTypes?: readonly string[]

  /** Skip git operations */
  readonly skipGit?: boolean

  /** Skip tag creation */
  readonly skipTag?: boolean

  /** Skip changelog update */
  readonly skipChangelog?: boolean

  /** Dry run mode - preview changes without applying */
  readonly dryRun?: boolean

  /** Custom commit message template */
  readonly commitMessage?: string

  /** Custom tag format */
  readonly tagFormat?: string

  /** Track dependencies for cascade bumps */
  readonly trackDeps?: boolean

  /** Branch allowed for releases */
  readonly releaseBranch?: string

  /** Base version for first release */
  readonly firstReleaseVersion?: string

  /** Allow prerelease versions */
  readonly allowPrerelease?: boolean

  /** Prerelease identifier (e.g., 'alpha', 'beta') */
  readonly prereleaseId?: string

  /** Force a specific bump type, bypassing commit analysis */
  readonly releaseAs?: 'major' | 'minor' | 'patch'

  /**
   * Maximum commits to analyze when no base commit is available.
   * Used for first releases, history rewrites, and path-filtered queries.
   *
   * Set higher if you expect >500 commits between releases.
   *
   * @default 500
   */
  readonly maxCommitFallback?: number

  /**
   * Repository resolution configuration for compare URL generation.
   *
   * Controls how repository information is resolved:
   * - `'disabled'`: No compare URLs generated (default, backward compatible)
   * - `'inferred'`: Auto-detect from package.json or git remote
   * - `RepositoryResolution`: Fine-grained control with explicit mode and options
   * - `RepositoryConfig`: Direct repository configuration
   */
  readonly repository?: 'disabled' | 'inferred' | RepositoryResolution | RepositoryConfig

  /**
   * Commit scope filtering configuration.
   * Controls how commits are attributed to projects in changelogs.
   *
   * By default, hybrid filtering ensures commits are included based on
   * conventional commit scope OR file changes within the project.
   */
  readonly scopeFiltering?: ScopeFilteringConfig

  /**
   * Changelog file name relative to project root.
   *
   * @default 'CHANGELOG.md'
   */
  readonly changelogFileName?: string

  /**
   * Custom mapping from commit type to changelog section.
   * Merged with defaults; use `null` to exclude a type from changelog.
   */
  readonly commitTypeToSection?: Partial<Record<string, ChangelogSectionType | null>>
}

/**
 * Default flow configuration values.
 */
export const DEFAULT_FLOW_CONFIG: Required<Omit<FlowConfig, 'repository' | 'scopeFiltering' | 'commitTypeToSection'>> &
  Pick<FlowConfig, 'repository' | 'scopeFiltering' | 'commitTypeToSection'> = {
  preset: 'conventional',
  releaseTypes: ['feat', 'fix', 'perf', 'revert'],
  minorTypes: ['feat'],
  patchTypes: ['fix', 'perf', 'revert'],
  skipGit: false,
  skipTag: false,
  skipChangelog: false,
  dryRun: false,
  commitMessage: 'chore(${projectName}): release version ${version}',
  tagFormat: '${projectName}@${version}',
  trackDeps: false,
  releaseBranch: 'main',
  firstReleaseVersion: '0.1.0',
  allowPrerelease: false,
  prereleaseId: 'alpha',
  releaseAs: undefined,
  maxCommitFallback: 500,
  repository: undefined,
  scopeFiltering: DEFAULT_SCOPE_FILTERING_CONFIG,
  changelogFileName: DEFAULT_CHANGELOG_FILENAME,
  commitTypeToSection: undefined,
}

/**
 * Execution context passed to each step.
 * Contains all resources and accumulated state.
 *
 * Note: `state` is mutable within context to allow
 * accumulation, but individual FlowState objects are immutable.
 */
export interface FlowContext {
  /** Workspace root path */
  readonly workspaceRoot: string

  /** Target project name */
  readonly projectName: string

  /** Project root path */
  readonly projectRoot: string

  /** Package name from package.json */
  readonly packageName: string

  /** Virtual file system tree */
  readonly tree: Tree

  /** Registry client */
  readonly registry: Registry

  /** Git client */
  readonly git: GitClient

  /** Logger instance */
  readonly logger: Logger

  /** Flow configuration */
  readonly config: FlowConfig

  /** Accumulated state from previous steps (mutable reference) */
  state: FlowState
}

/**
 * Result of a single step execution.
 */
export interface FlowStepResult {
  /** Step outcome */
  readonly status: 'success' | 'skipped' | 'failed'

  /** State updates from this step */
  readonly stateUpdates?: Partial<FlowState>

  /** Descriptive message */
  readonly message?: string

  /** Error if failed */
  readonly error?: Error
}

/**
 * Step result with step identification.
 */
export interface FlowStepResultWithId extends FlowStepResult {
  /** Step identifier */
  readonly stepId: string

  /** Step display name */
  readonly stepName: string
}

/**
 * Overall flow execution status.
 */
export type FlowStatus = 'success' | 'partial' | 'failed' | 'skipped'

/**
 * Information about a file change.
 */
export interface FileChangeInfo {
  /** Relative path from workspace root */
  readonly path: string
  /** Type of change */
  readonly changeType: 'CREATE' | 'UPDATE' | 'DELETE'
}

/**
 * Complete result of flow execution.
 */
export interface FlowResult {
  /** Overall flow outcome */
  readonly status: FlowStatus

  /** Results for each step */
  readonly steps: readonly FlowStepResultWithId[]

  /** Final accumulated state */
  readonly state: FlowState

  /** Duration in milliseconds */
  readonly duration: number

  /** Summary message */
  readonly summary: string

  /** Files that were modified (or would be in dry-run) */
  readonly modifiedFiles?: readonly FileChangeInfo[]
}
