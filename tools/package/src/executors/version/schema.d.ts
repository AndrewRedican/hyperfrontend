import type { FlowConfig } from '@hyperfrontend/versioning'

export interface VersionExecutorSchema {
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
  /** Manually increment the version by that keyword (major, minor, patch). */
  releaseAs?: 'major' | 'minor' | 'patch'
  /** Version tag prefix. Default is '{projectName}@' in independent mode. */
  tagPrefix?: string
  /** Includes the project's dependencies in calculating a recommended version bump. */
  trackDeps?: boolean
  /** Allows to skip making a commit when bumping a version. */
  skipCommit?: boolean
  /** Allows to skip tagging the release. Default: true (tags created after publish). */
  skipTag?: boolean
  /** Update version references in dependent packages after version bump. */
  updateDependents?: boolean
  /** Skip versioning if the current commit is a version/release commit (recursion prevention). */
  skipIfVersionCommit?: boolean
  /** Skip versioning if git is in rebase/merge state. */
  skipIfUnstableGit?: boolean
  /**
   * Output list of modified files without staging.
   * Implies skipCommit=true and skipTag=true.
   */
  collectFiles?: boolean
  /** Enable verbose output for debugging. Shows additional details about each step. */
  verbose?: boolean
  /** Suppress all non-error output. */
  quiet?: boolean
  /**
   * Repository resolution for changelog compare URLs.
   *
   * - `'disabled'`: No compare URLs generated
   * - `'inferred'`: Auto-detect from package.json or git remote (default)
   * - Object: Fine-grained control with mode and options
   */
  repository?: FlowConfig['repository']
}
