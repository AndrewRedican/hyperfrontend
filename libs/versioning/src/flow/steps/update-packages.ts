import type { FlowStep } from '../models/step'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
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
      logger.debug(`Reading package.json from: ${packageJsonPath}`)

      // Read package.json
      let content: string
      try {
        content = tree.read(packageJsonPath, 'utf-8') ?? ''
        if (!content) {
          logger.error(`package.json not found at ${packageJsonPath}`)
          return {
            status: 'failed',
            error: createError(`package.json not found at ${packageJsonPath}`),
            message: `Could not read package.json at ${packageJsonPath}`,
          }
        }
      } catch (error) {
        logger.error(`Failed to read package.json at ${packageJsonPath}: ${error}`)
        return {
          status: 'failed',
          error: error instanceof Error ? error : createError(String(error)),
          message: `Failed to read package.json at ${packageJsonPath}`,
        }
      }

      // Parse and update version
      let pkg: Record<string, unknown>
      try {
        pkg = <Record<string, unknown>>parse(content)
      } catch (error) {
        return {
          status: 'failed',
          error: error instanceof Error ? error : createError(String(error)),
          message: 'Failed to parse package.json',
        }
      }

      pkg['version'] = nextVersion

      // Write back with preserved formatting
      const updated = stringify(pkg, null, 2) + '\n'
      tree.write(packageJsonPath, updated)

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
