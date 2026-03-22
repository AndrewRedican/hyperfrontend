import type { ExecutorContext } from '@nx/devkit'
import type { FlowConfig } from '@hyperfrontend/versioning'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readPackageJsonIfExists } from '@hyperfrontend/project-scope/project/package'
import { createVersionFlow } from '@hyperfrontend/versioning/flow'
import { executeFlow } from '@hyperfrontend/versioning/flow/executor'
import { stage, amendCommitNoEdit } from '@hyperfrontend/versioning/git/operations'
import { isInUnstableGitState } from './lib/is-in-unstable-git-state'
import { isVersionCommit } from './lib/is-version-commit'
import { getLogger } from './lib/logger'
import { updateDependentVersions } from './lib/update-dependent-versions'
import { updateE2eDependencies } from './lib/update-e2e-dependencies'
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
 * @param options - Configuration options for the version executor
 * @param context - Nx executor context
 * @returns Success status
 */
export default async function versionExecutor(options: VersionExecutorSchema, context: ExecutorContext): Promise<{ success: boolean }> {
  const { projectName, root: workspaceRoot, projectGraph } = context
  const logger = getLogger()
  logger.setLogLevel(options)
  logger.setContextValue('projectName', projectName ?? 'unknown')
  logger.setContextValue('workspaceRoot', workspaceRoot)
  if (!projectName) {
    logger.error('Project name is required')
    return { success: false }
  }
  logger.debug(`Executor started with log level: {logLevel}`)

  if (options.collectFiles) {
    logger.debug('CollectFiles mode enabled - normalizing options for version flow')
    options.skipCommit = true
    options.skipTag = true
    logger.info('collectFiles mode enabled, skipCommit and skipTag set to true')
  }

  const modifiedFiles: string[] = []

  const projectConfig = projectGraph?.nodes[projectName]?.data
  if (!projectConfig) {
    logger.error(`Project not found in project graph`)
    return { success: false }
  }

  logger.debug('Performing safety checks')

  if (options.skipIfVersionCommit !== false) {
    logger.debug('Checking if current commit is a version/release commit')
    if (isVersionCommit(workspaceRoot, projectName)) {
      logger.info('Skipping - current commit is a version/release commit for this project')
      return { success: true }
    }
  }
  if (options.skipIfUnstableGit !== false) {
    logger.debug('Checking if git is in an unstable state (rebase/merge)')
    if (isInUnstableGitState(workspaceRoot)) {
      logger.info('Skipping - git is in rebase/merge state')
      return { success: true }
    }
  }

  const projectRoot = projectConfig.root
  logger.setContextValue('projectRoot', projectRoot)
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json')
  logger.setContextValue('packageJsonPath', packageJsonPath)
  const tagPrefix = options.tagPrefix || `${projectName}@`
  logger.setContextValue('tagPrefix', tagPrefix)

  logger.debug(`Project root: {projectRoot}`)
  logger.debug(`Package.json path: {packageJsonPath}`)
  logger.debug(`Tag prefix: {tagPrefix}`)

  // === BUILD FLOW CONFIG ===
  const flowConfig: Partial<FlowConfig> = {
    dryRun: options.dryRun,
    skipGit: options.skipCommit,
    skipTag: options.skipTag ?? true, // Default to true - tags created after publish
    skipChangelog: false,
    trackDeps: options.trackDeps,
    tagFormat: `${tagPrefix}\${version}`,
    releaseAs: options.releaseAs,
    repository: options.repository ?? 'inferred', // Default to auto-detect for compare URLs
    scopeFiltering: options.scopeFiltering,
    backupChangelog: options.backupChangelog,
  }

  logger.debug(
    `Flow config: dryRun=${flowConfig.dryRun}, skipGit=${flowConfig.skipGit}, skipTag=${flowConfig.skipTag}${flowConfig.releaseAs ? `, releaseAs=${flowConfig.releaseAs}` : ''}`
  )
  logger.info('Starting version flow using @hyperfrontend/versioning')

  // === EXECUTE FLOW ===
  const flow = createVersionFlow('conventional', flowConfig)
  const flowResult = await executeFlow(flow, projectName, workspaceRoot, {
    dryRun: options.dryRun,
    verbose: options.verbose ?? false,
    showDiff: options.showDiff,
    diffFormat: options.diffFormat,
    rollbackOnFailure: options.rollbackOnFailure,
    projectRoot,
  })

  // === PROCESS RESULT ===
  const success = flowResult.status === 'success' || flowResult.status === 'skipped'

  if (flowResult.status === 'success') {
    logger.info(flowResult.summary)
  } else if (flowResult.status === 'skipped') {
    logger.info('No release needed or already published')
    return { success: true }
  } else {
    logger.error(flowResult.summary)
    return { success: false }
  }

  // === COLLECT MODIFIED FILES ===
  logger.debug('Collecting modified files')
  if (flowResult.state.modifiedFiles) {
    for (const file of flowResult.state.modifiedFiles) {
      const relPath = file.startsWith(workspaceRoot) ? file.slice(workspaceRoot.length + 1) : file
      modifiedFiles.push(relPath)
      logger.debug(`Modified file: ${relPath}`)
    }
  } else {
    // Fallback
    logger.debug('No modified files in flow result, using fallback')
    modifiedFiles.push(join(projectRoot, 'package.json'))
    const changelogPath = join(workspaceRoot, projectRoot, 'CHANGELOG.md')
    if (existsSync(changelogPath)) {
      modifiedFiles.push(join(projectRoot, 'CHANGELOG.md'))
    }
  }

  // === POST-PROCESSING: Update dependent packages ===
  const shouldUpdateDependents = options.updateDependents !== false
  logger.debug(`Update dependents: ${shouldUpdateDependents}`)
  if (shouldUpdateDependents) {
    const pkg = readPackageJsonIfExists(packageJsonPath)
    const packageName = pkg?.name ?? null
    // Use nextVersion from flow result (works in dry run), fallback to package.json
    const newVersion = flowResult.state.nextVersion ?? pkg?.version ?? '0.0.0'

    logger.debug(`Package: ${packageName}, Version: ${newVersion}`)
    if (packageName && newVersion !== '0.0.0') {
      const updatedFiles = updateDependentVersions(packageName, newVersion, workspaceRoot, packageJsonPath, options.dryRun ?? false)
      const e2eUpdatedFiles = updateE2eDependencies(packageName, newVersion, workspaceRoot, options.dryRun ?? false)
      const allUpdatedFiles = [...updatedFiles, ...e2eUpdatedFiles]

      if (updatedFiles.length > 0) {
        logger.info(`Updated dependency version in ${updatedFiles.length} library package(s):`)
        for (const file of updatedFiles) {
          logger.debug(`  - ${file}`)
        }
      }

      if (e2eUpdatedFiles.length > 0) {
        logger.info(`Updated e2e app dependency in ${e2eUpdatedFiles.length} package(s):`)
        for (const file of e2eUpdatedFiles) {
          logger.debug(`  - ${file}`)
        }
      }

      if (allUpdatedFiles.length > 0) {
        modifiedFiles.push(...allUpdatedFiles)

        // Stage and amend the version commit (if not dry run and not skipping commit)
        if (!options.dryRun && !options.skipCommit) {
          logger.debug('Staging and amending commit with dependency updates')
          try {
            stage(allUpdatedFiles, { cwd: workspaceRoot })
            amendCommitNoEdit({ cwd: workspaceRoot })
            logger.info('Amended commit to include dependency updates')
          } catch (error) {
            logger.warn(`Could not amend commit with dependency updates: ${error}`)
          }
        }
      }
    }
  }

  // === OUTPUT MODIFIED FILES (collectFiles mode) ===
  if (options.collectFiles) {
    logger.debug('Outputting modified files list')
    for (const file of modifiedFiles) {
      process.stdout.write(`MODIFIED:${file}\n`)
    }
  }

  logger.debug('Executor completed successfully')
  return { success }
}
