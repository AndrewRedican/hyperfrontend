import type { ProjectGraph } from '@nx/devkit'
import type { FlowConfig, FlowResult } from '@hyperfrontend/versioning/flow/models'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { readPackageJsonIfExists } from '@hyperfrontend/project-scope/project/package'
import { createVersionFlow } from '@hyperfrontend/versioning/flow'
import { executeFlow } from '@hyperfrontend/versioning/flow/executor'
import { stage, amendCommitNoEdit } from '@hyperfrontend/versioning/git/operations'
import { isInUnstableGitState } from './is-in-unstable-git-state'
import { isVersionCommit } from './is-version-commit'
import { getLogger } from './logger'
import { updateDependentVersions } from './update-dependent-versions'
import { updateE2eDependencies } from './update-e2e-dependencies'

/**
 * Options for running version logic on a single project.
 */
export interface RunVersionOptions {
  /** Name of the project to version */
  projectName: string
  /** Absolute path to workspace root */
  workspaceRoot: string
  /** Project root relative to workspace root */
  projectRoot: string
  /** Nx project graph for dependency resolution */
  projectGraph: ProjectGraph
  /** Skip creating a git commit */
  skipCommit?: boolean
  /** Skip creating a git tag */
  skipTag?: boolean
  /** Preview changes without applying */
  dryRun?: boolean
  /** Enable verbose logging */
  verbose?: boolean
  /** Suppress non-error output */
  quiet?: boolean
  /** Force a specific bump type */
  releaseAs?: 'major' | 'minor' | 'patch'
  /** Version tag prefix */
  tagPrefix?: string
  /** Include dependencies in bump calculation */
  trackDeps?: boolean
  /** Update version references in dependent packages */
  updateDependents?: boolean
  /** Skip if current commit is a version commit */
  skipIfVersionCommit?: boolean
  /** Skip if git is in unstable state */
  skipIfUnstableGit?: boolean
  /** Show diff preview */
  showDiff?: boolean
  /** Diff output format */
  diffFormat?: 'unified' | 'summary'
  /** Rollback on failure */
  rollbackOnFailure?: boolean
  /** Repository config for changelog URLs */
  repository?: FlowConfig['repository']
  /** Scope filtering configuration */
  scopeFiltering?: FlowConfig['scopeFiltering']
  /** Backup changelog before modification */
  backupChangelog?: boolean
}

/**
 * Result of running version logic on a single project.
 */
export interface RunVersionResult {
  /** Whether the operation completed successfully */
  success: boolean
  /** Whether a version bump actually occurred */
  bumped: boolean
  /** Previous version (null if first release or skipped) */
  previousVersion: string | null
  /** New version (null if skipped) */
  newVersion: string | null
  /** All files modified during the operation */
  modifiedFiles: string[]
  /** Error message if operation failed */
  error?: string
  /** The underlying flow result for advanced use cases */
  flowResult?: FlowResult
}

/**
 * Runs versioning logic for a single project.
 *
 * This function contains the core versioning logic extracted from the Nx executor,
 * allowing it to be called directly by the version-batch executor without going
 * through the Nx executor interface.
 *
 * Key behaviors:
 * - Uses npm registry as source of truth (not git tags)
 * - Performs safety checks (version commit detection, unstable git state)
 * - Executes the versioning flow via `@hyperfrontend/versioning`
 * - Updates dependent package versions
 * - Tracks all modified files
 *
 * @param options - Configuration options for versioning
 * @returns Result containing success status, version info, and modified files
 *
 * @example
 * ```typescript
 * const result = await runVersionForProject({
 *   projectName: 'my-lib',
 *   workspaceRoot: '/path/to/workspace',
 *   projectRoot: 'libs/my-lib',
 *   projectGraph,
 *   skipCommit: true,
 *   skipTag: true,
 * })
 *
 * if (result.bumped) {
 *   console.log(`Bumped from ${result.previousVersion} to ${result.newVersion}`)
 *   console.log(`Modified files: ${result.modifiedFiles.join(', ')}`)
 * }
 * ```
 */
export async function runVersionForProject(options: RunVersionOptions): Promise<RunVersionResult> {
  const {
    projectName,
    workspaceRoot,
    projectRoot,
    skipCommit = false,
    skipTag = true,
    dryRun = false,
    verbose = false,
    quiet = false,
    releaseAs,
    tagPrefix = `${projectName}@`,
    trackDeps = false,
    updateDependents = true,
    skipIfVersionCommit = true,
    skipIfUnstableGit = true,
    showDiff = false,
    diffFormat,
    rollbackOnFailure,
    repository = 'inferred',
    scopeFiltering,
    backupChangelog = false,
  } = options

  const logger = getLogger()
  logger.setLogLevel({ verbose, quiet })
  logger.setContextValue('projectName', projectName)
  logger.setContextValue('workspaceRoot', workspaceRoot)
  logger.setContextValue('projectRoot', projectRoot)

  const modifiedFiles: string[] = []

  // === SAFETY CHECKS ===
  if (skipIfVersionCommit) {
    logger.debug('Checking if current commit is a version/release commit')
    if (isVersionCommit(workspaceRoot, projectName)) {
      logger.info('Skipping - current commit is a version/release commit for this project')
      return {
        success: true,
        bumped: false,
        previousVersion: null,
        newVersion: null,
        modifiedFiles: [],
      }
    }
  }

  if (skipIfUnstableGit) {
    logger.debug('Checking if git is in an unstable state (rebase/merge)')
    if (isInUnstableGitState(workspaceRoot)) {
      logger.info('Skipping - git is in rebase/merge state')
      return {
        success: true,
        bumped: false,
        previousVersion: null,
        newVersion: null,
        modifiedFiles: [],
      }
    }
  }

  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json')
  logger.setContextValue('packageJsonPath', packageJsonPath)
  logger.setContextValue('tagPrefix', tagPrefix)

  logger.debug(`Project root: {projectRoot}`)
  logger.debug(`Package.json path: {packageJsonPath}`)
  logger.debug(`Tag prefix: {tagPrefix}`)

  // === BUILD FLOW CONFIG ===
  const flowConfig: Partial<FlowConfig> = {
    dryRun,
    skipGit: skipCommit,
    skipTag,
    skipChangelog: false,
    trackDeps,
    tagFormat: `${tagPrefix}\${version}`,
    releaseAs,
    repository,
    scopeFiltering,
    backupChangelog,
  }

  logger.debug(
    `Flow config: dryRun=${flowConfig.dryRun}, skipGit=${flowConfig.skipGit}, skipTag=${flowConfig.skipTag}${flowConfig.releaseAs ? `, releaseAs=${flowConfig.releaseAs}` : ''}`
  )
  logger.info('Starting version flow using @hyperfrontend/versioning')

  // === EXECUTE FLOW ===
  const flow = createVersionFlow('conventional', flowConfig)
  const flowResult = await executeFlow(flow, projectName, workspaceRoot, {
    dryRun,
    verbose,
    showDiff,
    diffFormat,
    rollbackOnFailure,
    projectRoot,
  })

  // === PROCESS RESULT ===
  const success = flowResult.status === 'success' || flowResult.status === 'skipped'
  // A bump only occurred if the flow succeeded AND there's actually a next version
  const bumped = flowResult.status === 'success' && flowResult.state.nextVersion != null

  if (flowResult.status === 'success') {
    logger.info(flowResult.summary)

    // If no nextVersion, flow succeeded but no bump was needed (e.g., no releasable commits)
    if (!flowResult.state.nextVersion) {
      logger.debug('No version bump needed (no releasable commits)')
      return {
        success: true,
        bumped: false,
        previousVersion: flowResult.state.currentVersion ?? null,
        newVersion: null,
        modifiedFiles: [],
        flowResult,
      }
    }
  } else if (flowResult.status === 'skipped') {
    logger.info('No release needed or already published')
    return {
      success: true,
      bumped: false,
      previousVersion: flowResult.state.currentVersion ?? null,
      newVersion: null,
      modifiedFiles: [],
      flowResult,
    }
  } else {
    logger.error(flowResult.summary)
    return {
      success: false,
      bumped: false,
      previousVersion: null,
      newVersion: null,
      modifiedFiles: [],
      error: flowResult.summary,
      flowResult,
    }
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
  if (updateDependents) {
    const pkg = readPackageJsonIfExists(packageJsonPath)
    const packageName = pkg?.name ?? null
    // Use nextVersion from flow result (works in dry run), fallback to package.json
    const newVersion = flowResult.state.nextVersion ?? pkg?.version ?? '0.0.0'

    logger.debug(`Package: ${packageName}, Version: ${newVersion}`)
    if (packageName && newVersion !== '0.0.0') {
      const updatedFiles = updateDependentVersions(packageName, newVersion, workspaceRoot, packageJsonPath, dryRun)
      const e2eUpdatedFiles = updateE2eDependencies(packageName, newVersion, workspaceRoot, dryRun)
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
        if (!dryRun && !skipCommit) {
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

  logger.debug('Version operation completed successfully')

  return {
    success,
    bumped,
    previousVersion: flowResult.state.currentVersion ?? null,
    newVersion: flowResult.state.nextVersion ?? null,
    modifiedFiles,
    flowResult,
  }
}
