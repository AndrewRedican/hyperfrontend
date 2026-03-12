import type { FlowStep } from '../models/step'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createStep, createSkippedResult } from '../models/step'
import { interpolate } from '../utils/interpolate'

export const CREATE_COMMIT_STEP_ID = 'create-commit'

/**
 * Creates the create-commit step.
 *
 * This step:
 * 1. Stages modified files
 * 2. Creates a commit with the configured message
 *
 * State updates:
 * - commitHash: Hash of the created commit
 *
 * @returns A FlowStep that creates a git commit
 */
export function createGitCommitStep(): FlowStep {
  return createStep(
    CREATE_COMMIT_STEP_ID,
    'Create Version Commit',
    async (ctx) => {
      const { git, config, state, projectName, packageName, logger } = ctx
      const { nextVersion, bumpType, modifiedFiles } = state

      // Skip if git operations disabled
      if (config.skipGit) {
        return createSkippedResult('Git operations disabled')
      }

      // Skip if no bump needed
      if (!nextVersion || bumpType === 'none') {
        return createSkippedResult('No version bump, no commit needed')
      }

      // Skip if dry run
      if (config.dryRun) {
        const message = interpolate(config.commitMessage ?? 'chore(${projectName}): release version ${version}', {
          projectName,
          packageName,
          version: nextVersion,
        })
        return {
          status: 'success',
          message: `[DRY RUN] Would commit: "${message}"`,
        }
      }

      // Stage files
      if (modifiedFiles && modifiedFiles.length > 0) {
        try {
          git.stage(modifiedFiles)
          logger.debug(`Staged ${modifiedFiles.length} file(s)`)
        } catch (error) {
          return {
            status: 'failed',
            error: error instanceof Error ? error : createError(String(error)),
            message: 'Failed to stage files',
          }
        }
      } else {
        // Stage all changes
        try {
          git.stageAll()
          logger.debug('Staged all changes')
        } catch (error) {
          return {
            status: 'failed',
            error: error instanceof Error ? error : createError(String(error)),
            message: 'Failed to stage files',
          }
        }
      }

      // Create commit message
      const message = interpolate(config.commitMessage ?? 'chore(${projectName}): release version ${version}', {
        projectName,
        packageName,
        version: nextVersion,
      })

      // Create commit
      try {
        const commit = git.createCommit(message)
        logger.info(`Created commit: ${commit.hash.slice(0, 7)}`)

        return {
          status: 'success',
          stateUpdates: {
            commitHash: commit.hash,
          },
          message: `Created commit ${commit.hash.slice(0, 7)}: ${message}`,
        }
      } catch (error) {
        return {
          status: 'failed',
          error: error instanceof Error ? error : createError(String(error)),
          message: 'Failed to create commit',
        }
      }
    },
    {
      dependsOn: ['update-packages', 'write-changelog'],
    }
  )
}
