import type { ClassifiedCommit, CommitWithRaw, InfrastructureMatcher } from '../../commits/classify'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { GitClient } from '../../git/factory'
import type { GitCommit } from '../../git/models/commit'
import type { FlowStep } from '../models/step'
import type { ScopeFilteringConfig, ScopeFilteringStrategy } from '../models/types'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import {
  buildInfrastructureMatcher,
  classifyCommits,
  createClassificationContext,
  createMatchContext,
  deriveProjectScopes,
  toChangelogCommit,
} from '../../commits/classify'
import { parseConventionalCommit } from '../../commits/parse/message'
import { createStep } from '../models/step'
import { DEFAULT_SCOPE_FILTERING_CONFIG } from '../models/types'

export const ANALYZE_COMMITS_STEP_ID = 'analyze-commits'

/**
 * Creates the analyze-commits step.
 *
 * This step:
 * 1. Finds the last release tag for this package
 * 2. Gets all commits since that tag (or all commits if first release)
 * 3. Parses each commit using conventional commit format
 * 4. Classifies commits based on scope filtering strategy
 * 5. Filters to only release-worthy commits that belong to this project
 *
 * State updates:
 * - lastReleaseTag: Tag name of last release (null if first release)
 * - commits: Array of parsed conventional commits (for backward compatibility)
 * - classificationResult: Full classification result with source attribution
 *
 * @returns A FlowStep that analyzes commits
 */
export function createAnalyzeCommitsStep(): FlowStep {
  return createStep(
    ANALYZE_COMMITS_STEP_ID,
    'Analyze Commits',
    async (ctx) => {
      const { git, projectName, projectRoot, packageName, workspaceRoot, config, logger, state } = ctx

      // Find the last release tag for this package
      let lastReleaseTag: string | null = null

      if (!state.isFirstRelease) {
        // Try to find a tag matching the package name pattern
        const tags = git.getTagsForPackage(packageName)
        if (tags.length > 0) {
          // Tags are returned in reverse chronological order
          lastReleaseTag = tags[0].name
          logger.debug(`Found last release tag: ${lastReleaseTag}`)
        } else {
          // Try with project name format
          const projectTags = git.getTagsForPackage(projectName)
          if (projectTags.length > 0) {
            lastReleaseTag = projectTags[0].name
            logger.debug(`Found last release tag (project format): ${lastReleaseTag}`)
          }
        }
      }

      // Get all commits
      const rawCommits = lastReleaseTag ? git.getCommitsSince(lastReleaseTag) : git.getCommitLog({ maxCount: 100 })

      logger.debug(
        lastReleaseTag
          ? `Found ${rawCommits.length} commits since ${lastReleaseTag}`
          : `First release - analyzing up to ${rawCommits.length} commits`
      )

      // Get scope filtering configuration
      const scopeFilteringConfig = {
        ...DEFAULT_SCOPE_FILTERING_CONFIG,
        ...config.scopeFiltering,
      }
      const strategy = resolveStrategy(scopeFilteringConfig.strategy ?? 'hybrid', rawCommits)

      // Parse commits with conventional commit format
      const releaseTypes = config.releaseTypes ?? ['feat', 'fix', 'perf', 'revert']
      const parsedCommits: CommitWithRaw[] = []

      for (const rawCommit of rawCommits) {
        const parsed = parseConventionalCommit(rawCommit.message)
        if (parsed.type && releaseTypes.includes(parsed.type)) {
          parsedCommits.push({
            commit: parsed,
            raw: {
              hash: rawCommit.hash,
              shortHash: rawCommit.hash.slice(0, 7),
              message: rawCommit.message,
              subject: parsed.subject ?? rawCommit.message.split('\n')[0],
              body: parsed.body ?? '',
              authorName: '',
              authorEmail: '',
              authorDate: '',
              committerName: '',
              committerEmail: '',
              commitDate: '',
              parents: [],
              refs: [],
            },
          })
        }
      }

      // Build file commit hashes for hybrid/file-only strategies
      let fileCommitHashes = createSet<string>()
      if (strategy === 'hybrid' || strategy === 'file-only') {
        // Get commits that touched project files using path filter
        const relativePath = getRelativePath(workspaceRoot, projectRoot)
        const pathFilteredCommits = lastReleaseTag
          ? git.getCommitsSince(lastReleaseTag, { path: relativePath })
          : git.getCommitLog({ maxCount: 100, path: relativePath })

        fileCommitHashes = createSet(pathFilteredCommits.map((c) => c.hash))
        logger.debug(`Found ${fileCommitHashes.size} commits touching ${relativePath}`)
      }

      // Derive project scopes
      const projectScopes = deriveProjectScopes({
        projectName,
        packageName,
        additionalScopes: scopeFilteringConfig.includeScopes,
      })
      logger.debug(`Project scopes: ${projectScopes.join(', ')}`)

      // Build infrastructure commit hashes for file-based infrastructure detection
      const infrastructureCommitHashes = buildInfrastructureCommitHashes(
        git,
        lastReleaseTag,
        rawCommits,
        parsedCommits,
        scopeFilteringConfig,
        logger
      )

      // Create classification context
      const classificationContext = createClassificationContext(projectScopes, fileCommitHashes, {
        excludeScopes: scopeFilteringConfig.excludeScopes,
        includeScopes: scopeFilteringConfig.includeScopes,
        infrastructureCommitHashes,
      })

      // Classify commits
      const classificationResult = classifyCommits(parsedCommits, classificationContext)

      // Apply strategy-specific filtering
      const includedCommits = applyStrategyFilter(classificationResult.included, strategy)

      // Extract conventional commits for backward compatibility
      // Use toChangelogCommit to properly handle scope based on classification
      const commits: ConventionalCommit[] = includedCommits.map((c) => toChangelogCommit(c))

      // Build message with classification summary
      const { summary } = classificationResult
      const message = buildSummaryMessage(commits.length, rawCommits.length, summary, strategy)

      logger.debug(
        `Classification breakdown: direct-scope=${summary.bySource['direct-scope']}, ` +
          `direct-file=${summary.bySource['direct-file']}, unscoped-file=${summary.bySource['unscoped-file']}, ` +
          `excluded=${summary.bySource['excluded']}`
      )

      return {
        status: 'success',
        stateUpdates: {
          lastReleaseTag,
          commits,
          classificationResult,
        },
        message,
      }
    },
    {
      dependsOn: ['fetch-registry'],
    }
  )
}

/**
 * Resolves the filtering strategy, handling 'inferred' by analyzing commits.
 *
 * @param strategy - The configured scope filtering strategy
 * @param commits - The commits to analyze for strategy inference
 * @returns The resolved strategy (never 'inferred')
 */
function resolveStrategy(
  strategy: ScopeFilteringStrategy,
  commits: readonly { message: string }[]
): Exclude<ScopeFilteringStrategy, 'inferred'> {
  if (strategy !== 'inferred') {
    return strategy
  }

  // Infer strategy from commit history
  // Count commits with conventional scopes
  let scopedCount = 0
  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.message)
    if (parsed.scope) {
      scopedCount++
    }
  }

  const scopeRatio = commits.length > 0 ? scopedCount / commits.length : 0

  // If >70% of commits have scopes, scope-only is viable
  // If <30% have scopes, file-only is better
  // Otherwise, use hybrid
  if (scopeRatio > 0.7) {
    return 'scope-only'
  } else if (scopeRatio < 0.3) {
    return 'file-only'
  }
  return 'hybrid'
}

/**
 * Applies strategy-specific filtering to classified commits.
 *
 * @param commits - The classified commits to filter
 * @param strategy - The resolved filtering strategy to apply
 * @returns Filtered commits based on the strategy
 */
function applyStrategyFilter(
  commits: readonly ClassifiedCommit[],
  strategy: Exclude<ScopeFilteringStrategy, 'inferred'>
): readonly ClassifiedCommit[] {
  switch (strategy) {
    case 'scope-only':
      // Only include direct-scope commits
      return commits.filter((c) => c.source === 'direct-scope')

    case 'file-only':
      // Only include file-based commits (direct-file, unscoped-file)
      return commits.filter((c) => c.source === 'direct-file' || c.source === 'unscoped-file')

    case 'hybrid':
    default:
      // Include all non-excluded commits (already filtered in classifyCommits)
      return commits
  }
}

/**
 * Gets the relative path from workspace root to project root.
 *
 * @param workspaceRoot - The absolute path to the workspace root
 * @param projectRoot - The absolute path to the project root
 * @returns The relative path from workspace to project
 */
function getRelativePath(workspaceRoot: string, projectRoot: string): string {
  if (projectRoot.startsWith(workspaceRoot)) {
    return projectRoot.slice(workspaceRoot.length).replace(/^\//, '')
  }
  return projectRoot
}

/**
 * Builds a summary message for the step result.
 *
 * @param includedCount - Number of commits included in the release
 * @param totalCount - Total number of commits analyzed
 * @param summary - Classification summary object
 * @param summary.bySource - Count of commits by source type
 * @param strategy - The filtering strategy used
 * @returns A human-readable summary message
 */
function buildSummaryMessage(
  includedCount: number,
  totalCount: number,
  summary: { bySource: Record<string, number> },
  strategy: string
): string {
  if (includedCount === 0) {
    return `No releasable commits found for this project (${totalCount} total, strategy: ${strategy})`
  }

  const parts = [`Found ${includedCount} releasable commits`, `(${totalCount} total`, `strategy: ${strategy})`]

  return parts.join(' ')
}

/**
 * Builds a set of commit hashes that touched infrastructure paths or match infrastructure criteria.
 *
 * Supports multiple detection methods combined with OR logic:
 * 1. Path-based: Commits touching configured infrastructure paths (via git)
 * 2. Scope-based: Commits with scopes matching infrastructure.scopes
 * 3. Custom matcher: User-provided matching logic
 *
 * @param git - Git client for querying commits by path
 * @param lastReleaseTag - Last release tag (null for first release)
 * @param rawCommits - All raw commits being analyzed
 * @param parsedCommits - Parsed commits with conventional commit data
 * @param config - Scope filtering configuration
 * @param logger - Logger with debug method for output
 * @param logger.debug - Debug logging function
 * @returns Set of commit hashes classified as infrastructure
 */
function buildInfrastructureCommitHashes(
  git: GitClient,
  lastReleaseTag: string | null,
  rawCommits: readonly GitCommit[],
  parsedCommits: readonly CommitWithRaw[],
  config: ScopeFilteringConfig,
  logger: { debug: (msg: string) => void }
): ReadonlySet<string> | undefined {
  // Collect all infrastructure commit hashes
  let infraHashes = createSet<string>()

  // Method 1: Path-based detection (query git for commits touching infra paths)
  const infraPaths = config.infrastructure?.paths ?? []
  if (infraPaths.length > 0) {
    for (const infraPath of infraPaths) {
      const pathCommits = lastReleaseTag
        ? git.getCommitsSince(lastReleaseTag, { path: infraPath })
        : git.getCommitLog({ maxCount: 100, path: infraPath })

      for (const commit of pathCommits) {
        infraHashes = infraHashes.add(commit.hash)
      }
    }
    logger.debug(`Found ${infraHashes.size} commits touching infrastructure paths: ${infraPaths.join(', ')}`)
  }

  // Method 2 & 3: Scope-based and custom matcher detection
  // Build a combined matcher from infrastructure config and/or custom matcher
  const configMatcher = config.infrastructure ? buildInfrastructureMatcher(config.infrastructure) : null
  const customMatcher = config.infrastructureMatcher
  const combinedMatcher = combineMatcher(configMatcher, customMatcher)

  if (combinedMatcher) {
    // Build a lookup for parsed commits by hash
    let parsedByHash = createMap<string, CommitWithRaw>()
    for (const parsed of parsedCommits) {
      parsedByHash = parsedByHash.set(parsed.raw.hash, parsed)
    }

    // Evaluate each raw commit against the matcher
    for (const rawCommit of rawCommits) {
      // Skip if already matched by path
      if (infraHashes.has(rawCommit.hash)) continue

      // Get parsed scope if available
      const parsed = parsedByHash.get(rawCommit.hash)
      const scope = parsed?.commit.scope

      // Create match context and evaluate
      const context = createMatchContext(rawCommit, scope)
      if (combinedMatcher(context)) {
        infraHashes = infraHashes.add(rawCommit.hash)
      }
    }
    logger.debug(`Infrastructure matcher found ${infraHashes.size} total commits`)
  }

  // Return undefined if no infrastructure detection configured
  if (infraHashes.size === 0 && infraPaths.length === 0 && !combinedMatcher) {
    return undefined
  }

  return infraHashes
}

/**
 * Combines two optional matchers into one using OR logic.
 *
 * @param a - First matcher (may be null)
 * @param b - Second matcher (may be undefined)
 * @returns Combined matcher or null if neither provided
 */
function combineMatcher(a: InfrastructureMatcher | null, b: InfrastructureMatcher | undefined): InfrastructureMatcher | null {
  if (a && b) {
    return (ctx) => a(ctx) || b(ctx)
  }
  return a ?? b ?? null
}
