import type { FlowConfig } from '@hyperfrontend/versioning/flow/models'
import type { FollowUp } from './lib/run-version-for-project'

/** What a `version` target configures: the bump, the commit and the tag, and how commits are attributed to the project. */
export interface VersionExecutorOptions {
  /** See what commands would be run, without committing to git or updating files. */
  dryRun?: boolean
  /**
   * Scope filtering configuration for commit classification and changelog generation.
   *
   * Controls how commits are filtered and classified for this project:
   * - `strategy`: Filtering strategy ('hybrid', 'scope-only', 'file-only', 'inferred')
   * - `includeScopes`: Additional scopes to always include
   * - `excludeScopes`: Scopes to exclude even if files match
   * - `trackDependencyChanges`: Include dependency commits as indirect
   * - `infrastructure`: Infrastructure path and scope tracking
   */
  scopeFiltering?: FlowConfig['scopeFiltering']
  /** Upper bound on the commit window the flow analyzes for bumps and changelogs. */
  maxCommitFallback?: FlowConfig['maxCommitFallback']
  /** Manually increment the version by that keyword (major, minor, patch). */
  releaseAs?: 'major' | 'minor' | 'patch'
  /** Version tag prefix. Default is '{projectName}@' in independent mode. */
  tagPrefix?: string
  /** Allows to skip making a commit when bumping a version. */
  skipCommit?: boolean
  /** Allows to skip tagging the release. Default: true (tags created after publish). */
  skipTag?: boolean
  /** Enable verbose output for debugging. Shows additional details about each step. */
  verbose?: boolean
  /** Suppress all non-error output. */
  quiet?: boolean
  /** Called after the bump and before the commit that records it, each answering the files the commit must also carry. No configuration sets this; an executor that wraps this one passes it. */
  followUps?: readonly FollowUp[]
}
