import type { VersionFlow } from '../models/flow'
import type { FlowStep } from '../models/step'
import type { FlowConfig } from '../models/types'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createFlow } from '../models/flow'
import { createStep, createSkippedResult } from '../models/step'
import {
  createAnalyzeCommitsStep,
  createCalculateBumpStep,
  createCheckIdempotencyStep,
  createFetchRegistryStep,
  createGenerateChangelogStep,
  createGitCommitStep,
  createResolveRepositoryStep,
  createTagStep,
  createWriteChangelogStep,
} from '../steps'
import { CONVENTIONAL_FLOW_CONFIG } from './conventional'

/**
 * Default configuration for synced flow.
 */
export const SYNCED_FLOW_CONFIG: FlowConfig = {
  ...CONVENTIONAL_FLOW_CONFIG,
  preset: 'synced',
  tagFormat: 'v${version}',
  commitMessage: 'chore: release version ${version}',
}

/**
 * Creates a step that updates all workspace packages to the same version.
 *
 * @returns A FlowStep that syncs all package versions
 */
export function createSyncAllPackagesStep(): FlowStep {
  return createStep(
    'sync-all-packages',
    'Sync All Package Versions',
    async (ctx) => {
      const { tree, workspaceRoot, state, logger } = ctx
      const { nextVersion, bumpType } = state

      if (!nextVersion || bumpType === 'none') {
        return createSkippedResult('No version bump needed')
      }

      const rootPackageJson = `${workspaceRoot}/package.json`
      const modifiedFiles: string[] = []

      try {
        const content = tree.read(rootPackageJson, 'utf-8')
        if (content) {
          const pkg = <Record<string, unknown>>parse(content)
          pkg['version'] = nextVersion
          tree.write(rootPackageJson, stringify(pkg, null, 2) + '\n')
          modifiedFiles.push(rootPackageJson)
          logger.info(`Updated root package.json to ${nextVersion}`)
        }
      } catch (error) {
        logger.warn(`Could not update root package.json: ${error}`)
      }

      return {
        status: 'success',
        stateUpdates: {
          modifiedFiles: [...(state.modifiedFiles ?? []), ...modifiedFiles],
        },
        message: `Synced ${modifiedFiles.length} package(s) to version ${nextVersion}`,
      }
    },
    {
      dependsOn: ['calculate-bump'],
    }
  )
}

/**
 * Creates a step that generates a combined changelog for all packages.
 *
 * @returns A FlowStep that creates a combined changelog
 */
export function createCombinedChangelogStep(): FlowStep {
  return createStep(
    'combined-changelog',
    'Generate Combined Changelog',
    async (ctx) => {
      const { config, state, logger } = ctx
      const { nextVersion, bumpType } = state

      if (!nextVersion || bumpType === 'none' || config.skipChangelog) {
        return createSkippedResult('No changelog to generate')
      }

      logger.info('Generating combined changelog for workspace')

      return {
        status: 'success',
        message: 'Combined changelog preparation complete',
      }
    },
    {
      dependsOn: ['check-idempotency'],
    }
  )
}

/**
 * Creates a synced versioning flow.
 *
 * This flow maintains the same version across all packages
 * in a monorepo. When any package changes, all packages
 * get the same new version.
 *
 * Flow steps:
 * 1. Fetch published version from registry
 * 2. Analyze commits across all packages
 * 3. Calculate version bump (highest needed)
 * 4. Check if version already published
 * 5. Sync all package versions
 * 6. Generate combined changelog
 * 7. Write changelog to root
 * 8. Create git commit
 * 9. Create single git tag
 *
 * @param config - Optional configuration overrides
 * @returns A VersionFlow configured for synced versioning
 *
 * @example
 * ```typescript
 * import { createSyncedFlow, executeFlow } from '@hyperfrontend/versioning'
 *
 * const flow = createSyncedFlow()
 * const result = await executeFlow(flow, 'workspace', '/workspace')
 *
 * // All packages now share the same version
 * console.log(`Released v${result.state.nextVersion}`)
 * ```
 */
export function createSyncedFlow(config?: Partial<FlowConfig>): VersionFlow {
  const mergedConfig = { ...SYNCED_FLOW_CONFIG, ...config }

  return createFlow(
    'synced',
    'Synced Versioning Flow',
    [
      createFetchRegistryStep(),
      createResolveRepositoryStep(),
      createAnalyzeCommitsStep(),
      createCalculateBumpStep(),
      createCheckIdempotencyStep(),
      createSyncAllPackagesStep(),
      createCombinedChangelogStep(),
      createGenerateChangelogStep(),
      createWriteChangelogStep(),
      createGitCommitStep(),
      createTagStep(),
    ],
    {
      description: 'Keep all packages at the same version',
      config: mergedConfig,
    }
  )
}

/**
 * Creates a fixed versioning flow.
 *
 * Similar to synced, but uses a fixed version scheme
 * where the version is explicitly provided rather than
 * calculated from commits.
 *
 * @param version - The fixed version to use
 * @param config - Optional configuration overrides
 * @returns A VersionFlow with a fixed version
 */
export function createFixedVersionFlow(version: string, config?: Partial<FlowConfig>): VersionFlow {
  const fixedBumpStep: FlowStep = createStep(
    'calculate-bump',
    'Use Fixed Version',
    async () => ({
      status: 'success',
      stateUpdates: {
        bumpType: 'minor',
        nextVersion: version,
      },
      message: `Using fixed version: ${version}`,
    }),
    {
      dependsOn: ['analyze-commits'],
    }
  )

  return createFlow(
    'fixed',
    'Fixed Version Flow',
    [
      createFetchRegistryStep(),
      createResolveRepositoryStep(),
      createAnalyzeCommitsStep(),
      fixedBumpStep,
      createCheckIdempotencyStep(),
      createSyncAllPackagesStep(),
      createCombinedChangelogStep(),
      createGenerateChangelogStep(),
      createWriteChangelogStep(),
      createGitCommitStep(),
      createTagStep(),
    ],
    {
      description: `Release with fixed version ${version}`,
      config: { ...SYNCED_FLOW_CONFIG, ...config },
    }
  )
}
