import type { FlowStep } from '../models/step'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { changeJsonFile } from '../../utils/change-json-file'
import { createStep, createSkippedResult } from '../models/step'

export const UPDATE_PACKAGES_STEP_ID = 'update-packages'

/**
 * Creates the update-packages step.
 *
 * This step:
 * 1. Updates the version field in package.json
 * 2. Tracks the modified files
 *
 * State updates:
 * - modifiedFiles: Adds package.json to list
 *
 * @returns A FlowStep that updates package.json
 */
export function createUpdatePackageStep(): FlowStep {
  return createStep(
    UPDATE_PACKAGES_STEP_ID,
    'Update Package Version',
    async (ctx) => {
      const { tree, projectRoot, state, logger } = ctx
      const { nextVersion, bumpType, currentVersion } = state

      // Skip if no bump needed
      if (!nextVersion || bumpType === 'none') {
        return createSkippedResult('No version bump needed')
      }

      const packageJsonPath = `${projectRoot}/package.json`
      logger.debug(`Updating package.json at: ${packageJsonPath}`)

      try {
        changeJsonFile<{ version: string }>(tree, packageJsonPath, (pkg) => {
          pkg.version = nextVersion
          return pkg
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error(`Failed to update package.json at ${packageJsonPath}: ${message}`)
        return {
          status: 'failed',
          error: error instanceof Error ? error : createError(String(error)),
          message: `Failed to update package.json: ${message}`,
        }
      }

      logger.info(`Updated package.json: ${currentVersion} → ${nextVersion}`)

      return {
        status: 'success',
        stateUpdates: {
          modifiedFiles: [...(state.modifiedFiles ?? []), packageJsonPath],
        },
        message: `Updated version to ${nextVersion}`,
      }
    },
    {
      dependsOn: ['calculate-bump'],
    }
  )
}

/**
 * Creates a step that updates dependent packages in a monorepo.
 *
 * This step cascades version updates to packages that depend
 * on the updated package.
 *
 * @returns A FlowStep that cascades dependency updates
 */
export function createCascadeDependenciesStep(): FlowStep {
  return createStep(
    'cascade-dependencies',
    'Cascade Dependency Updates',
    async (ctx) => {
      const { config, state, logger } = ctx
      const { nextVersion, bumpType } = state

      // Skip if dependency tracking not enabled
      if (!config.trackDeps) {
        return createSkippedResult('Dependency tracking not enabled')
      }

      // Skip if no bump needed
      if (!nextVersion || bumpType === 'none') {
        return createSkippedResult('No version bump to cascade')
      }

      // In a full implementation, this would:
      // 1. Use workspace discovery to find dependent packages
      // 2. Update their dependency references
      // 3. Track the modified files

      logger.warn('Cascade dependencies step is not fully implemented yet')

      return {
        status: 'success',
        message: 'Dependency cascade skipped (not fully implemented)',
      }
    },
    {
      dependsOn: ['update-packages'],
    }
  )
}
