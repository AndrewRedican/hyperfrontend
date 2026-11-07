/**
 * The `version` executor: runs the version flow of `@hyperfrontend/versioning` on one project.
 *
 * @module executors/version/executor
 */

import type { ExecutorContext, ExecutorResult } from '../../runner/contract'
import type { VersionExecutorOptions } from './options'
import { workspaceGraph } from '../../graph'
import { withShippedChanges } from './lib/graph-change-sources'
import { getLogger } from './lib/logger'
import { runVersion } from './lib/run-version-for-project'

/**
 * Versions a project using `@hyperfrontend/versioning`.
 *
 * Key behaviors:
 * - Uses npm registry as source of truth (not git tags)
 * - Tags as OUTPUT (created after publish), not INPUT
 *
 * This executor delegates to `runVersion()` for the core versioning logic,
 * allowing the same logic to be reused by the `version-batch` executor.
 *
 * @param options - Configuration options for the version executor
 * @param context - The workspace, the project and the target the task runs on
 * @returns Success status
 *
 * @example A `version` target attributing commits by scope and by file
 * ```json
 * {
 *   "targets": {
 *     "version": {
 *       "executor": "@hyperfrontend/workspace:version",
 *       "options": {
 *         "tagPrefix": "lib-core@",
 *         "scopeFiltering": { "strategy": "hybrid", "excludeScopes": ["ci", "docs-site"] }
 *       }
 *     }
 *   }
 * }
 * ```
 * `npx hf run lib-core:version --dryRun` says what would be bumped; without the flag the bump, the changelog entry and the pins of the dependents are committed, and no tag is made until `--skipTag=false`.
 */
export async function versionExecutor(options: VersionExecutorOptions, context: ExecutorContext): Promise<ExecutorResult> {
  const { projectName, root: workspaceRoot } = context
  const logger = getLogger()
  logger.setLogLevel(options)
  logger.setContextValue('projectName', projectName ?? 'unknown')
  logger.setContextValue('workspaceRoot', workspaceRoot)

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  const projectConfig = context.projects[projectName]
  if (!projectConfig) {
    logger.error(`Project not found in the workspace`)
    return { success: false }
  }

  logger.debug(`Executor started with log level: {logLevel}`)

  const result = await runVersion({
    projectName,
    workspaceRoot,
    projectRoot: projectConfig.root,
    projects: context.projects,
    skipCommit: options.skipCommit,
    skipTag: options.skipTag ?? true,
    dryRun: options.dryRun,
    verbose: options.verbose,
    quiet: options.quiet,
    releaseAs: options.releaseAs,
    tagPrefix: options.tagPrefix,
    scopeFiltering: withShippedChanges(options.scopeFiltering, workspaceGraph(workspaceRoot), workspaceRoot),
    maxCommitFallback: options.maxCommitFallback,
    followUps: options.followUps,
  })

  logger.debug('Executor completed successfully')
  return { success: result.success }
}

export default versionExecutor
