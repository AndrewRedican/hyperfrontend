import type { FlowConfig } from '@hyperfrontend/versioning'

export interface VersionCheckExecutorSchema {
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
  /** Skip validation if the current commit is a version/release commit. */
  skipIfVersionCommit?: boolean
  /** Enable verbose output for debugging. Shows additional details about validation. */
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
