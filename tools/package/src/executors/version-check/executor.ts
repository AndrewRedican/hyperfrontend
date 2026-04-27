import type { ExecutorContext, PromiseExecutor } from '@nx/devkit'
import type { VersionCheckExecutorSchema } from './schema'
import { isInUnstableGitState } from '../version/lib/is-in-unstable-git-state'
import { isVersionCommit } from '../version/lib/is-version-commit'
import { getLogger } from '../version/lib/logger'
import { validateVersionState, formatValidationResult } from '../version/lib/validate-version-state'

/**
 * Nx executor that validates version state without making changes.
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
 * - CI pipeline validation (replaces version-validation job)
 * - Local verification that lefthook versioning worked
 * - Debugging version discrepancies
 *
 * @param options - Configuration options for the version-check executor
 * @param context - Nx executor context
 * @returns Success status
 */
export default async function versionCheckExecutor(
  options: VersionCheckExecutorSchema,
  context: ExecutorContext
): ReturnType<PromiseExecutor> {
  const { projectName, root: workspaceRoot, projectGraph } = context
  const logger = getLogger()
  logger.setLogLevel(options)
  logger.setContextValue('projectName', projectName ?? 'unknown')
  logger.setContextValue('workspaceRoot', workspaceRoot)

  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }

  logger.debug(`Version check executor started for {projectName}`)

  const projectConfig = projectGraph?.nodes[projectName]?.data
  if (!projectConfig) {
    logger.error(`Project not found in project graph`)
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
    scopeFiltering: options.scopeFiltering,
    repository: options.repository,
  })

  const formatted = formatValidationResult(result)

  switch (result.status) {
    case 'valid':
      logger.info(formatted)
      return { success: true }

    case 'skipped':
      logger.info(formatted)
      return { success: true }

    case 'error':
      logger.error(formatted)
      return { success: false }

    case 'invalid':
      logger.warn(formatted)
      logger.log('')
      logger.log('To fix this issue:')
      logger.log('  1. Pull latest changes: git pull origin <branch>')
      logger.log(`  2. Run versioning: npx nx version ${projectName}`)
      logger.log('  3. Commit the changes: git add . && git commit --amend --no-edit')
      logger.log('  4. Push: git push --force-with-lease')
      logger.log('')
      logger.log('Or push without --no-verify to let lefthook handle versioning automatically.')
      return { success: false }
  }
}
