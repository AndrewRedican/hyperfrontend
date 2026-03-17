import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope'

import type { ChangelogEntry } from '../../changelog/models/entry'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { RepositoryConfig, RepositoryResolution } from '../../repository/models'
import type { BumpType } from '../../semver/models/version'

// Re-export Logger from @hyperfrontend/logging for consumers
export type { Logger } from '@hyperfrontend/logging'

// ============================================================================
// Flow State
// ============================================================================

/**
 * Accumulated state during flow execution.
 * Each step can read previous state and contribute updates.
 */
export interface FlowState {
  /** Current/local version from package.json */
  readonly currentVersion?: string

  /** Published version on registry (null if never published) */
  readonly publishedVersion?: string | null

  /** Calculated next version */
  readonly nextVersion?: string

  /** Bump type (major/minor/patch/none) */
  readonly bumpType?: BumpType

  /** Analyzed commits since last release */
  readonly commits?: readonly ConventionalCommit[]

  /** Tag name that marks the last release */
  readonly lastReleaseTag?: string | null

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

  /** Additional custom state for extensibility */
  readonly [key: string]: unknown
}

// ============================================================================
// Flow Configuration
// ============================================================================

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
   * Repository resolution configuration for compare URL generation.
   *
   * Controls how repository information is resolved:
   * - `'disabled'`: No compare URLs generated (default, backward compatible)
   * - `'inferred'`: Auto-detect from package.json or git remote
   * - `RepositoryResolution`: Fine-grained control with explicit mode and options
   * - `RepositoryConfig`: Direct repository configuration
   */
  readonly repository?: 'disabled' | 'inferred' | RepositoryResolution | RepositoryConfig
}

/**
 * Default flow configuration values.
 */
export const DEFAULT_FLOW_CONFIG: Required<Omit<FlowConfig, 'repository'>> & Pick<FlowConfig, 'repository'> = {
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
  repository: undefined,
}

// ============================================================================
// Flow Context
// ============================================================================

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

// ============================================================================
// Step Results
// ============================================================================

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

// ============================================================================
// Flow Results
// ============================================================================

/**
 * Overall flow execution status.
 */
export type FlowStatus = 'success' | 'partial' | 'failed' | 'skipped'

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
}
