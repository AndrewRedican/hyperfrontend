import type { FlowConfig } from '@hyperfrontend/versioning/flow/models'

/**
 * Schema for the version-batch executor.
 *
 * This executor consolidates batch versioning orchestration logic
 * into TypeScript. It detects affected libraries, versions each one,
 * and creates a single batch commit.
 */
export interface VersionBatchExecutorSchema {
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
}
