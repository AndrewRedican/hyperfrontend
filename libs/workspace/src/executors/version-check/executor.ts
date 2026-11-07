/**
 * The `version-check` executor: a read-only comparison of a project's version state with the one its commits call for.
 *
 * @module executors/version-check/executor
 */

import type { ExecutorContext, ExecutorResult } from '../../runner/contract'
import type { VersionCheckExecutorOptions } from './options'
import { workspaceGraph } from '../../graph'
import { withShippedChanges } from '../version/lib/graph-change-sources'
import { isInUnstableGitState } from '../version/lib/is-in-unstable-git-state'
import { isVersionCommit } from '../version/lib/is-version-commit'
import { getLogger } from '../version/lib/logger'
import { validateVersionState, formatValidationResult } from '../version/lib/validate-version-state'

/**
 * Validates version state without making changes.
 *
 * This executor is designed for CI validation to verify that:
 * 1. The expected version bump (based on conventional commits) has been applied
 * 2. The package.json version matches the expected version
 * 3. The CHANGELOG.md contains the correct entry for the version
 *
 * Unlike the version executor, this makes NO changes to the repository.
 * It's a read-only check that provides clear failure messages for remediation.
 *
 * Use cases:
 * - CI pipeline validation
 * - Local verification that a version run did what the commits call for
 * - Debugging version discrepancies
 *
 * @param options - Configuration options for the version-check executor
 * @param context - The workspace, the project and the target the task runs on
 * @returns Success status
 */
export async function versionCheckExecutor(options: VersionCheckExecutorOptions, context: ExecutorContext): Promise<ExecutorResult> {
  const { projectName, root: workspaceRoot } = context
  const logger = getLogger()
  logger.setLogLevel(options)
  logger.setContextValue('projectName', projectName ?? 'unknown')
  logger.setContextValue('workspaceRoot', workspaceRoot)

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  logger.debug(`Version check executor started for {projectName}`)

  const projectConfig = context.projects[projectName]
  if (!projectConfig) {
    logger.error(`Project not found in the workspace`)
    return { success: false }
  }

  if (options.skipIfVersionCommit !== false) {
    logger.debug('Checking if current commit is a version/release commit')
    if (isVersionCommit(workspaceRoot, projectName)) {
      logger.info('Skipping - current commit is a version/release commit for this project')
      return { success: true }
    }
  }

  if (isInUnstableGitState(workspaceRoot)) {
    logger.info('Skipping - git is in rebase/merge state')
    return { success: true }
  }

  const projectRoot = projectConfig.root
  logger.setContextValue('projectRoot', projectRoot)

  logger.info('Validating version state...')

  const result = await validateVersionState({
    workspaceRoot,
    projectName,
    projectRoot,
    verbose: options.verbose,
    scopeFiltering: withShippedChanges(options.scopeFiltering, workspaceGraph(workspaceRoot), workspaceRoot),
    maxCommitFallback: options.maxCommitFallback,
    repository: options.repository,
  })

  // why: the flow sets the shared logger to its own level while it runs, so the verdict is printed at the level the task asked for
  logger.setLogLevel(options)
  const formatted = formatValidationResult(result)

  switch (result.status) {
    case 'valid':
      logger.log(formatted)
      return { success: true }

    case 'skipped':
      logger.log(formatted)
      return { success: true }

    case 'error':
      logger.error(formatted)
      return { success: false }

    case 'invalid':
      logger.warn(formatted)
      logger.log('')
      logger.log('To fix this issue:')
      logger.log('  1. Pull latest changes: git pull origin <branch>')
      logger.log(`  2. Run versioning: npx hf run ${projectName}:version`)
      logger.log('  3. Push the version commit')
      return { success: false }
  }
}

export default versionCheckExecutor
