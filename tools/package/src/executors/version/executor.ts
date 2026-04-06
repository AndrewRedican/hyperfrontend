import type { ExecutorContext } from '@nx/devkit'
import { getLogger } from './lib/logger'
import { runVersionForProject } from './lib/run-version-for-project'
import { VersionExecutorSchema } from './schema'

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
 * @param context - Nx executor context
 * @returns Success status
 */
export default async function versionExecutor(
  options: VersionExecutorSchema,
  context: ExecutorContext
): Promise<{
  /** Whether the version operation completed successfully. */
  success: boolean
}> {
  const { projectName, root: workspaceRoot, projectGraph } = context
  const logger = getLogger()
  logger.setLogLevel(options)
  logger.setContextValue('projectName', projectName ?? 'unknown')
  logger.setContextValue('workspaceRoot', workspaceRoot)

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  if (!projectGraph) {
    logger.error('Project graph is required')
    return { success: false }
  }

  const projectConfig = projectGraph.nodes[projectName]?.data
  if (!projectConfig) {
    logger.error(`Project not found in project graph`)
    return { success: false }
  }

  logger.debug(`Executor started with log level: {logLevel}`)

  const result = await runVersionForProject({
    projectName,
    workspaceRoot,
    projectRoot: projectConfig.root,
    projectGraph,
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
    scopeFiltering: options.scopeFiltering,
    backupChangelog: options.backupChangelog,
  })

  logger.debug('Executor completed successfully')
  return { success: result.success }
}
