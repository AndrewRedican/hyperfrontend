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
  skipTag: true, // Tags typically created after publish
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
 * 2. Analyze commits since last release
 * 3. Calculate version bump based on commit types
 * 4. Check if version already published (idempotency)
 * 5. Generate changelog entry
 * 6. Update package.json version
 * 7. Write changelog to file
 * 8. Create git commit (optional)
 * 9. Create git tag (optional, typically after publish)
 *
 * @param config - Optional configuration overrides
 * @returns A VersionFlow configured for conventional commits
 *
 * @example
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
