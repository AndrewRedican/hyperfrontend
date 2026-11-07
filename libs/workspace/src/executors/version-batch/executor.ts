/**
 * The `version-batch` executor: finds the libraries a change makes due a release, versions each
 * of them, and records every bump in one commit.
 *
 * @module executors/version-batch/executor
 */

import type { ExecutorContext, ExecutorResult } from '../../runner/contract'
import type { VersionBatchExecutorOptions } from './options'
import { getCurrentBranch } from '@hyperfrontend/versioning/git/operations'
import { workspaceGraph } from '../../graph'
import { withShippedChanges } from '../version/lib/graph-change-sources'
import { isInUnstableGitState } from '../version/lib/is-in-unstable-git-state'
import { getLogger } from '../version/lib/logger'
import { runVersion } from '../version/lib/run-version-for-project'
import { baseBranches, listRemotes } from './lib/base-branch'
import { createBatchCommit } from './lib/create-batch-commit'
import { getAffectedLibraries, hasVersionTarget } from './lib/get-affected-libraries'
import { selectLibraries } from './lib/select-libraries'
import { withRollback } from './lib/working-tree'

/** Options declared on the `version` target. */
interface VersionTargetOptions {
  /** Commit scope filtering declared for single-project versioning. */
  scopeFiltering?: VersionBatchExecutorOptions['scopeFiltering']
  /** Commit-window bound declared for single-project versioning. */
  maxCommitFallback?: VersionBatchExecutorOptions['maxCommitFallback']
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
 * Versions every library a change makes due a release and records the bumps in one commit.
 *
 * This executor:
 * 1. Detects affected libraries programmatically
 * 2. Runs versioning for each affected library
 * 3. Creates a single batch commit
 *
 * It stands down on the base branch itself: the releases of that branch are made from the
 * branches merged into it.
 *
 * @param options - Executor options from schema
 * @param context - The workspace, the project and the target the task runs on
 * @returns Executor result with success status
 */
export async function versionBatchExecutor(options: VersionBatchExecutorOptions, context: ExecutorContext): Promise<ExecutorResult> {
  const workspaceRoot = context.root
  const { base = 'origin/main', head = 'HEAD', dryRun = false, verbose = false, releaseAs, libraries, followUps } = options

  const versionTargetDefaults = context.configuration.targetDefaults?.['version'] as VersionTargetDefaults | undefined
  const scopeFiltering = options.scopeFiltering ?? versionTargetDefaults?.options?.scopeFiltering
  const maxCommitFallback = options.maxCommitFallback ?? versionTargetDefaults?.options?.maxCommitFallback

  const logger = getLogger()
  logger.setLogLevel({ verbose, quiet: false })

  try {
    const currentBranch = getCurrentBranch({ cwd: workspaceRoot })
    if (currentBranch !== null && baseBranches(base, listRemotes(workspaceRoot)).includes(currentBranch)) {
      logger.log(`On the base branch ${currentBranch}, skipping version-batch`)
      return { success: true }
    }

    logger.debug(`Current branch: ${currentBranch ?? 'unknown'}`)
    logger.debug(`Base: ${base}, Head: ${head}`)

    if (isInUnstableGitState(workspaceRoot)) {
      logger.error('Git is in an unstable state (rebase/merge in progress). Aborting.')
      return { success: false }
    }

    const graph = workspaceGraph(workspaceRoot)
    logger.debug(`Loaded workspace graph with ${graph.projects.size} projects`)
    // why: one resolver for the batch, so libraries released from the same commit share one reading of the graph and of the history
    const tracked = withShippedChanges(scopeFiltering, graph, workspaceRoot)

    // why: a forced bump names its libraries, so affected detection is not consulted for it
    const affected = releaseAs === undefined ? await getAffectedLibraries(workspaceRoot, graph, base, head) : []
    const selection = selectLibraries(libraries, releaseAs, affected, (name) => hasVersionTarget(graph, name))
    if (selection.ok === false) {
      logger.error(selection.reason)
      return { success: false }
    }
    const affectedLibraries = selection.libraries

    if (affectedLibraries.length === 0) {
      logger.log('No affected libraries with version target found')
      return { success: true }
    }

    logger.log(
      releaseAs === undefined
        ? `Found ${affectedLibraries.length} affected libraries: ${affectedLibraries.join(', ')}`
        : `Forcing a ${releaseAs} bump on ${affectedLibraries.length} libraries: ${affectedLibraries.join(', ')}`
    )

    if (dryRun) {
      logger.log(`[dry-run] Would version the following libraries${releaseAs === undefined ? '' : ` with a forced ${releaseAs} bump`}:`)
      for (const lib of affectedLibraries) {
        logger.log(`  - ${lib}`)
      }
      return { success: true }
    }

    // why: only from here on does the batch write to the working tree; everything before, a dry run included, reads, and so needs nothing put back
    return await withRollback(
      workspaceRoot,
      async (keep) => {
        const bumpedLibs: string[] = []
        const allModifiedFiles: string[] = []
        const failedLibs: string[] = []

        for (const lib of affectedLibraries) {
          const project = graph.projects.get(lib)
          if (project === undefined) {
            logger.warn(`Project ${lib} not found in graph, skipping`)
            continue
          }

          logger.debug(`Processing ${lib}...`)

          try {
            const result = await runVersion({
              projectName: lib,
              workspaceRoot,
              projectRoot: project.root,
              projects: context.projects,
              skipCommit: true,
              skipTag: true,
              dryRun: false,
              verbose,
              quiet: !verbose,
              scopeFiltering: tracked,
              maxCommitFallback,
              releaseAs,
              followUps,
            })
            // why: each library's run quietens the shared logger; the batch reports its own lines at its own level
            logger.setLogLevel({ verbose, quiet: false })

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

        if (bumpedLibs.length > 0) {
          logger.log(`\nCreating batch commit for ${bumpedLibs.length} libraries...`)

          const commitHash = await createBatchCommit(workspaceRoot, allModifiedFiles, bumpedLibs)
          // why: the bumps are committed, so an interrupt from here on has nothing to put back
          keep()

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
      },
      (line) => logger.log(line)
    )
  } catch (error) {
    logger.error(`version-batch failed: ${error instanceof Error ? error.message : error}`)
    return { success: false }
  }
}

export default versionBatchExecutor
