import type { ExecutorContext } from '@nx/devkit'
import type { VersionBatchExecutorSchema } from './schema'
import { createProjectGraphAsync } from '@nx/devkit'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { getCurrentBranch } from '@hyperfrontend/versioning/git/operations'
import { isInUnstableGitState } from '../version/lib/is-in-unstable-git-state'
import { getLogger } from '../version/lib/logger'
import { runVersionForProject } from '../version/lib/run-version-for-project'
import { createBatchCommit } from './lib/create-batch-commit'
import { getAffectedLibraries } from './lib/get-affected-libraries'
import { rollbackChanges } from './lib/rollback-changes'

/** Options declared on the `version` target. */
interface VersionTargetOptions {
  /** Commit scope filtering declared for single-project versioning. */
  scopeFiltering?: VersionBatchExecutorSchema['scopeFiltering']
  /** Commit-window bound declared for single-project versioning. */
  maxCommitFallback?: VersionBatchExecutorSchema['maxCommitFallback']
}

/** The `version` target defaults this batch inherits its commit attribution from. */
interface VersionTargetDefaults {
  /** Options declared on the target. */
  options?: VersionTargetOptions
}

/**
 * Result of version-batch executor.
 */
export interface VersionBatchResult {
  /** Whether the batch versioning operation succeeded */
  success: boolean
  /** Libraries that were actually bumped */
  bumpedLibraries: string[]
  /** Commit hash if a batch commit was created */
  commitHash?: string
  /** Error message if operation failed */
  error?: string
}

/**
 * version-batch executor
 *
 * Consolidates all batch versioning orchestration logic into TypeScript.
 * This executor:
 * 1. Detects affected libraries programmatically
 * 2. Runs versioning for each affected library
 * 3. Creates a single batch commit
 *
 * @param options - Executor options from schema
 * @param context - Nx executor context
 * @returns Executor result with success status
 */
export default async function versionBatchExecutor(
  options: VersionBatchExecutorSchema,
  context: ExecutorContext
): Promise<Pick<VersionBatchResult, 'success'>> {
  const workspaceRoot = context.root
  const { base = 'origin/main', head = 'HEAD', dryRun = false, verbose = false } = options

  const versionTargetDefaults = context.nxJsonConfiguration?.targetDefaults?.['version'] as VersionTargetDefaults | undefined
  const scopeFiltering = options.scopeFiltering ?? versionTargetDefaults?.options?.scopeFiltering
  const maxCommitFallback = options.maxCommitFallback ?? versionTargetDefaults?.options?.maxCommitFallback

  const logger = getLogger()
  logger.setLogLevel({ verbose, quiet: false })

  let interrupted = false
  const cleanupAndExit = async () => {
    interrupted = true
    logger.log('\nInterrupted, cleaning up...')
    await rollbackChanges(workspaceRoot)
    process.exit(1)
  }

  process.on('SIGINT', cleanupAndExit)
  process.on('SIGTERM', cleanupAndExit)

  try {
    const currentBranch = getCurrentBranch({ cwd: workspaceRoot })
    if (currentBranch === 'main') {
      logger.log('On main branch, skipping version-batch')
      return { success: true }
    }

    logger.debug(`Current branch: ${currentBranch ?? 'unknown'}`)
    logger.debug(`Base: ${base}, Head: ${head}`)

    if (isInUnstableGitState(workspaceRoot)) {
      logger.error('Git is in an unstable state (rebase/merge in progress). Aborting.')
      return { success: false }
    }

    const projectGraph = await createProjectGraphAsync()
    logger.debug(`Loaded project graph with ${keys(projectGraph.nodes).length} nodes`)

    const affectedLibraries = await getAffectedLibraries(workspaceRoot, projectGraph, base, head)

    if (affectedLibraries.length === 0) {
      logger.log('No affected libraries with version target found')
      return { success: true }
    }

    logger.log(`Found ${affectedLibraries.length} affected libraries: ${affectedLibraries.join(', ')}`)

    if (dryRun) {
      logger.log('[dry-run] Would version the following libraries:')
      for (const lib of affectedLibraries) {
        logger.log(`  - ${lib}`)
      }
      return { success: true }
    }

    const bumpedLibs: string[] = []
    const allModifiedFiles: string[] = []
    const failedLibs: string[] = []

    for (const lib of affectedLibraries) {
      if (interrupted) {
        break
      }

      const project = projectGraph.nodes[lib]
      if (!project) {
        logger.warn(`Project ${lib} not found in graph, skipping`)
        continue
      }

      logger.debug(`Processing ${lib}...`)

      try {
        const result = await runVersionForProject({
          projectName: lib,
          workspaceRoot,
          projectRoot: project.data.root,
          projectGraph,
          skipCommit: true,
          skipTag: true,
          dryRun: false,
          verbose,
          quiet: !verbose,
          scopeFiltering,
          maxCommitFallback,
        })

        if (result.success && result.bumped) {
          bumpedLibs.push(lib)
          allModifiedFiles.push(...result.modifiedFiles)
          logger.log(`  ✓ ${lib}: ${result.previousVersion} → ${result.newVersion}`)
        } else if (result.success) {
          logger.debug(`  - ${lib}: no version bump needed`)
        } else {
          failedLibs.push(lib)
          logger.error(`  ✗ ${lib}: ${result.error ?? 'unknown error'}`)
        }
      } catch (error) {
        failedLibs.push(lib)
        logger.error(`  ✗ ${lib}: ${error instanceof Error ? error.message : error}`)
      }
    }

    if (interrupted) {
      return { success: false }
    }

    if (bumpedLibs.length > 0) {
      logger.log(`\nCreating batch commit for ${bumpedLibs.length} libraries...`)

      const commitHash = await createBatchCommit(workspaceRoot, allModifiedFiles, bumpedLibs)

      logger.log(`Created commit: ${commitHash.slice(0, 8)}`)
      logger.log(`Bumped: ${bumpedLibs.join(', ')}`)
    } else {
      logger.log('\nNo version bumps needed')
    }

    if (failedLibs.length > 0) {
      logger.error(
        `\n${failedLibs.length} of ${affectedLibraries.length} librar${failedLibs.length === 1 ? 'y' : 'ies'} failed to version: ${failedLibs.join(', ')}. ` +
          `Anything that did version is left in place; resolve the failures and run again.`
      )
      return { success: false }
    }

    return { success: true }
  } catch (error) {
    logger.error(`version-batch failed: ${error instanceof Error ? error.message : error}`)

    if (!dryRun) {
      logger.log('Rolling back changes...')
      await rollbackChanges(workspaceRoot)
    }

    return { success: false }
  } finally {
    process.removeListener('SIGINT', cleanupAndExit)
    process.removeListener('SIGTERM', cleanupAndExit)
  }
}
