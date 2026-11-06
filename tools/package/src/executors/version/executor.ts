import type { ExecutorContext, ExecutorResult } from '@hyperfrontend/workspace/runner'
import type { VersionExecutorSchema } from './schema'
import { workspaceGraph } from '@hyperfrontend/workspace/graph'
import { withShippedChanges } from './lib/graph-change-sources'
import { getLogger } from './lib/logger'
import { runVersionForProject } from './lib/run-version-for-project'

/**
 * Nx executor that versions a project using `@hyperfrontend/versioning`.
 *
 * Key behaviors:
 * - Uses npm registry as source of truth (not git tags)
 * - Zero transitive dependencies
 * - Full control over versioning behavior
 * - Tags as OUTPUT (created after publish), not INPUT
 *
 * This executor delegates to `runVersionForProject()` for the core versioning logic,
 * allowing the same logic to be reused by the `version-batch` executor.
 *
 * @param options - Configuration options for the version executor
 * @param context - The workspace, the project and the target the task runs on
 * @returns Success status
 */
export default async function versionExecutor(options: VersionExecutorSchema, context: ExecutorContext): Promise<ExecutorResult> {
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

  const result = await runVersionForProject({
    projectName,
    workspaceRoot,
    projectRoot: projectConfig.root,
    skipCommit: options.skipCommit,
    skipTag: options.skipTag ?? true,
    dryRun: options.dryRun,
    verbose: options.verbose,
    quiet: options.quiet,
    releaseAs: options.releaseAs,
    tagPrefix: options.tagPrefix,
    trackDeps: options.trackDeps,
    updateDependents: options.updateDependents,
    skipIfVersionCommit: options.skipIfVersionCommit,
    skipIfUnstableGit: options.skipIfUnstableGit,
    showDiff: options.showDiff,
    diffFormat: options.diffFormat,
    rollbackOnFailure: options.rollbackOnFailure,
    repository: options.repository,
    scopeFiltering: withShippedChanges(options.scopeFiltering, workspaceGraph(workspaceRoot), workspaceRoot),
    maxCommitFallback: options.maxCommitFallback,
    backupChangelog: options.backupChangelog,
  })

  logger.debug('Executor completed successfully')
  return { success: result.success }
}
