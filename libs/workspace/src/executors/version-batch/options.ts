import type { FlowConfig } from '@hyperfrontend/versioning/flow/models'
import type { FollowUp } from '../version/lib/run-version-for-project'

/**
 * Options of the version-batch executor.
 *
 * The executor detects affected libraries, versions each one, and creates a single batch commit.
 */
export interface VersionBatchExecutorOptions {
  /**
   * Base git ref for affected detection.
   *
   * @default "origin/main"
   */
  base?: string

  /**
   * Head git ref for affected detection.
   *
   * @default "HEAD"
   */
  head?: string

  /**
   * Preview changes without making them.
   *
   * @default false
   */
  dryRun?: boolean

  /**
   * Enable verbose logging.
   *
   * @default false
   */
  verbose?: boolean

  /**
   * Commit scope filtering applied when attributing commits to a project.
   *
   * Defaults to whatever the `version` target declares, so the batch that writes
   * versions attributes commits exactly as the single-project run and
   * `version-check` do.
   */
  scopeFiltering?: FlowConfig['scopeFiltering']
  /** Upper bound on the commit window the flow analyzes for bumps and changelogs. */
  maxCommitFallback?: FlowConfig['maxCommitFallback']
  /**
   * Force this bump on the libraries named by `libraries`, calculated from each
   * one's published version, for a release whose change is in the package
   * artifact rather than its code.
   */
  releaseAs?: FlowConfig['releaseAs']
  /** Project names to version instead of the affected set. Required with `releaseAs`, and only meaningful with it. */
  libraries?: string[]
  /** Called after each bump and before the batch commit, each answering the files the commit must also carry. No configuration sets this; an executor that wraps this one passes it. */
  followUps?: readonly FollowUp[]
}
