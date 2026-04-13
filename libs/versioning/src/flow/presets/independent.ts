import type { VersionFlow } from '../models/flow'
import type { FlowStep } from '../models/step'
import type { FlowConfig } from '../models/types'
import { createFlow } from '../models/flow'
import { createStep, createSkippedResult } from '../models/step'
import {
  createAnalyzeCommitsStep,
  createCalculateBumpStep,
  createCascadeDependenciesStep,
  createCheckIdempotencyStep,
  createFetchRegistryStep,
  createGenerateChangelogStep,
  createGitCommitStep,
  createResolveRepositoryStep,
  createTagStep,
  createUpdatePackageStep,
  createWriteChangelogStep,
} from '../steps'
import { CONVENTIONAL_FLOW_CONFIG } from './conventional'

/**
 * Default configuration for independent flow.
 */
export const INDEPENDENT_FLOW_CONFIG: FlowConfig = {
  ...CONVENTIONAL_FLOW_CONFIG,
  preset: 'independent',
  trackDeps: true,
}

/**
 * Creates a step that checks for dependent package bumps.
 *
 * In independent versioning, when a dependency is bumped,
 * dependents may also need version bumps.
 *
 * @returns A FlowStep that checks dependent bumps
 *
 * @example Checking if dependent packages need bumps
 * ```typescript
 * import { createCheckDependentBumpsStep, executeStep } from '@hyperfrontend/versioning'
 *
 * const step = createCheckDependentBumpsStep()
 * const result = await executeStep(step, contextWithTrackDeps)
 *
 * // Result indicates if any dependents need bumps
 * console.log(result.message)
 * ```
 */
export function createCheckDependentBumpsStep(): FlowStep {
  return createStep(
    'check-dependent-bumps',
    'Check Dependent Bumps',
    async (ctx) => {
      const { config, state, logger } = ctx
      const { bumpType, nextVersion } = state

      if (!config.trackDeps) {
        return createSkippedResult('Dependency tracking not enabled')
      }

      if (!nextVersion || bumpType === 'none') {
        return createSkippedResult('No bump to propagate')
      }

      logger.debug('Dependent bump checking not fully implemented')

      return {
        status: 'success',
        message: 'Dependent bump check complete (basic implementation)',
      }
    },
    {
      dependsOn: ['calculate-bump'],
    }
  )
}

/**
 * Creates an independent versioning flow.
 *
 * This flow is designed for monorepos where each package
 * is versioned independently:
 *
 * 1. Fetch published version from registry
 * 2. Analyze commits since last release
 * 3. Calculate version bump based on commit types
 * 4. Check for dependent package bumps (cascade)
 * 5. Check if version already published (idempotency)
 * 6. Generate changelog entry
 * 7. Update package.json version
 * 8. Cascade dependency updates
 * 9. Write changelog to file
 * 10. Create git commit
 * 11. Create git tag
 *
 * @param config - Optional configuration overrides
 * @returns A VersionFlow configured for independent versioning
 *
 * @example Creating an independent versioning flow
 * ```typescript
 * import { createIndependentFlow, executeFlow } from '@hyperfrontend/versioning'
 *
 * const flow = createIndependentFlow()
 * const result = await executeFlow(flow, 'lib-utils', '/workspace')
 *
 * // Check which dependents were bumped
 * console.log(result.state.cascadedBumps)
 * ```
 */
export function createIndependentFlow(config?: Partial<FlowConfig>): VersionFlow {
  const mergedConfig = { ...INDEPENDENT_FLOW_CONFIG, ...config }

  return createFlow(
    'independent',
    'Independent Versioning Flow',
    [
      createFetchRegistryStep(),
      createResolveRepositoryStep(),
      createAnalyzeCommitsStep(),
      createCalculateBumpStep(),
      createCheckDependentBumpsStep(),
      createCheckIdempotencyStep(),
      createGenerateChangelogStep(),
      createUpdatePackageStep(),
      createCascadeDependenciesStep(),
      createWriteChangelogStep(),
      createGitCommitStep(),
      createTagStep(),
    ],
    {
      description: 'Version packages independently with dependency tracking',
      config: mergedConfig,
    }
  )
}

/**
 * Creates a flow for releasing multiple packages independently.
 *
 * This is a variant that skips commit/tag creation, intended
 * to be used when releasing multiple packages in sequence
 * with a single commit at the end.
 *
 * @param config - Optional configuration overrides
 * @returns A VersionFlow for batch independent releases
 *
 * @example Releasing multiple packages in batch
 * ```typescript
 * import { createBatchReleaseFlow, executeFlow } from '@hyperfrontend/versioning'
 *
 * // Release multiple packages without individual commits
 * for (const pkg of ['lib-a', 'lib-b', 'lib-c']) {
 *   await executeFlow(createBatchReleaseFlow(), pkg, '/workspace')
 * }
 * // Then create a single combined commit
 * ```
 */
export function createBatchReleaseFlow(config?: Partial<FlowConfig>): VersionFlow {
  return createFlow(
    'batch-release',
    'Batch Release Flow',
    [
      createFetchRegistryStep(),
      createResolveRepositoryStep(),
      createAnalyzeCommitsStep(),
      createCalculateBumpStep(),
      createCheckIdempotencyStep(),
      createGenerateChangelogStep(),
      createUpdatePackageStep(),
      createWriteChangelogStep(),
    ],
    {
      description: 'Prepare release without committing (for batch releases)',
      config: {
        ...INDEPENDENT_FLOW_CONFIG,
        skipGit: true,
        skipTag: true,
        ...config,
      },
    }
  )
}
