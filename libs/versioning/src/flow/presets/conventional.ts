import type { VersionFlow } from '../models/flow'
import type { FlowConfig } from '../models/types'
import { createFlow } from '../models/flow'
import {
  createAnalyzeCommitsStep,
  createCalculateBumpStep,
  createCheckIdempotencyStep,
  createFetchRegistryStep,
  createGenerateChangelogStep,
  createGitCommitStep,
  createResolveRepositoryStep,
  createTagStep,
  createUpdatePackageStep,
  createWriteChangelogStep,
} from '../steps'

/**
 * Default configuration for conventional flow.
 */
export const CONVENTIONAL_FLOW_CONFIG: FlowConfig = {
  preset: 'conventional',
  releaseTypes: ['feat', 'fix', 'perf', 'revert'],
  minorTypes: ['feat'],
  patchTypes: ['fix', 'perf', 'revert'],
  skipGit: false,
  skipTag: true,
  skipChangelog: false,
  dryRun: false,
  commitMessage: 'chore(${projectName}): release version ${version}',
  tagFormat: '${projectName}@${version}',
  trackDeps: false,
  firstReleaseVersion: '0.1.0',
}

/**
 * Creates a conventional flow.
 *
 * This flow follows the standard conventional commits workflow:
 * 1. Fetch published version from registry
 * 2. Resolve repository configuration (for compare URLs)
 * 3. Analyze commits since last release
 * 4. Calculate version bump based on commit types
 * 5. Check if version already published (idempotency)
 * 6. Generate changelog entry (with compare URL if repository resolved)
 * 7. Update package.json version
 * 8. Write changelog to file
 * 9. Create git commit (optional)
 * 10. Create git tag (optional, typically after publish)
 *
 * @param config - Optional configuration overrides
 * @returns A VersionFlow configured for conventional commits
 *
 * @example Creating a conventional versioning flow
 * ```typescript
 * import { createConventionalFlow, executeFlow } from '@hyperfrontend/versioning'
 *
 * // Use defaults
 * const flow = createConventionalFlow()
 *
 * // With overrides
 * const customFlow = createConventionalFlow({
 *   skipTag: false,
 *   releaseTypes: ['feat', 'fix'],
 * })
 *
 * const result = await executeFlow(flow, 'lib-utils', '/workspace')
 * ```
 */
export function createConventionalFlow(config?: Partial<FlowConfig>): VersionFlow {
  const mergedConfig = { ...CONVENTIONAL_FLOW_CONFIG, ...config }

  return createFlow(
    'conventional',
    'Conventional Commits Flow',
    [
      createFetchRegistryStep(),
      createResolveRepositoryStep(),
      createAnalyzeCommitsStep(),
      createCalculateBumpStep(),
      createCheckIdempotencyStep(),
      createGenerateChangelogStep(),
      createUpdatePackageStep(),
      createWriteChangelogStep(),
      createGitCommitStep(),
      createTagStep(),
    ],
    {
      description: 'Standard versioning using conventional commits specification',
      config: mergedConfig,
    }
  )
}

/**
 * Creates a minimal flow for quick releases.
 *
 * Skips changelog and tag creation.
 *
 * @param config - Optional configuration overrides
 * @returns A minimal VersionFlow
 *
 * @example Creating a minimal release flow
 * ```typescript
 * import { createMinimalFlow, executeFlow } from '@hyperfrontend/versioning'
 *
 * const flow = createMinimalFlow()
 * const result = await executeFlow(flow, 'my-lib', '/workspace')
 *
 * // Quick release without changelog or tags
 * console.log('Released:', result.state.nextVersion)
 * ```
 */
export function createMinimalFlow(config?: Partial<FlowConfig>): VersionFlow {
  return createConventionalFlow({
    skipChangelog: true,
    skipTag: true,
    ...config,
  })
}

/**
 * Creates a changelog-only flow.
 *
 * Only generates changelog, no version bumps or git operations.
 *
 * @param config - Optional configuration overrides
 * @returns A VersionFlow that only updates changelog
 *
 * @example Creating a changelog-only flow
 * ```typescript
 * import { createChangelogOnlyFlow, executeFlow } from '@hyperfrontend/versioning'
 *
 * const flow = createChangelogOnlyFlow()
 * const result = await executeFlow(flow, 'my-lib', '/workspace')
 *
 * // Only changelog is updated, no version bump
 * console.log(result.state.changelogEntry)
 * ```
 */
export function createChangelogOnlyFlow(config?: Partial<FlowConfig>): VersionFlow {
  return createFlow(
    'changelog-only',
    'Changelog Only Flow',
    [
      createFetchRegistryStep(),
      createAnalyzeCommitsStep(),
      createCalculateBumpStep(),
      createGenerateChangelogStep(),
      createWriteChangelogStep(),
    ],
    {
      description: 'Generate changelog without version bump or git operations',
      config: {
        ...CONVENTIONAL_FLOW_CONFIG,
        skipGit: true,
        skipTag: true,
        ...config,
      },
    }
  )
}
