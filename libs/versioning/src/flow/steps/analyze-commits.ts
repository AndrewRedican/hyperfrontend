import type { ClassifiedCommit, CommitWithRaw, InfrastructureMatcher } from '../../commits/classify'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { GitClient } from '../../git/factory'
import type { GitCommit } from '../../git/models/commit'
import type { FlowStep } from '../models/step'
import type { FlowContext, ScopeFilteringConfig, ScopeFilteringStrategy } from '../models/types'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { buildSimpleProjectGraph, discoverNxProjects } from '@hyperfrontend/project-scope/nx'
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
 * Reads a commit range under a configured ceiling, and says so when it bites.
 *
 * One commit beyond the ceiling is requested so that a truncated range is
 * detectable rather than merely suspected. Truncation is reported because a
 * silently shortened range understates the version bump and drops the oldest
 * entries from the changelog: raise `maxCommitFallback` to take in more.
 *
 * @param read - Reads the range, bounded to the given number of commits
 * @param limit - Greatest number of commits to analyse
 * @param description - How to name the range in the warning
 * @param logger - Receives the truncation warning
 * @returns The commits, at most `limit` of them, newest first
 */
function readBoundedRange(
  read: (limit: number) => readonly GitCommit[],
  limit: number,
  description: string,
  logger: FlowContext['logger']
): readonly GitCommit[] {
  const fetched = read(limit + 1)

  if (fetched.length <= limit) {
    return fetched
  }

  logger.warn(
    `More than ${limit} ${description}: analysing the most recent ${limit}. ` +
      `The version bump and changelog are computed from that window only, so raise maxCommitFallback to widen it.`
  )

  return fetched.slice(0, limit)
}

/**
 * Creates the analyze-commits step.
 *
 * This step:
 * 1. Uses publishedCommit from npm registry (set by fetch-registry step)
 * 2. Verifies the commit is reachable from current HEAD
 * 3. Gets all commits since that commit (or recent commits if first release/fallback)
 * 4. Parses each commit using conventional commit format
 * 5. Classifies commits based on scope filtering strategy
 * 6. Filters to only release-worthy commits that belong to this project
 *
 * State updates:
 * - effectiveBaseCommit: The verified base commit (null if fallback was used)
 * - commits: Array of parsed conventional commits (for backward compatibility)
 * - classificationResult: Full classification result with source attribution
 *
 * @returns A FlowStep that analyzes commits
 *
 * @example Analyzing commits since last release
 * ```typescript
 * import { createAnalyzeCommitsStep, executeStep } from '@hyperfrontend/versioning'
 *
 * const step = createAnalyzeCommitsStep()
 * const result = await executeStep(step, context)
 *
 * // Access analyzed commits
 * console.log(result.stateUpdates?.commits)
 * // => [{ type: 'feat', subject: 'add feature' }, ...]
 * ```
 */
export function createAnalyzeCommitsStep(): FlowStep {
  return createStep(
    ANALYZE_COMMITS_STEP_ID,
    'Analyze Commits',
    async (ctx) => {
      const { git, projectName, projectRoot, packageName, workspaceRoot, config, logger, state } = ctx
      const maxFallback = config.maxCommitFallback ?? 500

      const { publishedCommit, isFirstRelease } = state

      let rawCommits: readonly GitCommit[]
      let effectiveBaseCommit: string | null = null

      if (publishedCommit && !isFirstRelease) {
        if (git.commitReachableFromHead(publishedCommit)) {
          rawCommits = readBoundedRange(
            (limit) => git.getCommitsSince(publishedCommit, { maxCount: limit }),
            maxFallback,
            `commits since ${publishedCommit.slice(0, 7)}`,
            logger
          )
          effectiveBaseCommit = publishedCommit
          logger.debug(`Found ${rawCommits.length} commits since ${publishedCommit.slice(0, 7)}`)
        } else {
          logger.warn(
            `Published commit ${publishedCommit.slice(0, 7)} not found in history. ` +
              `This may indicate a rebase or force push occurred after publishing v${state.publishedVersion}. ` +
              `Falling back to recent commit analysis.`
          )
          rawCommits = git.getCommitLog({ maxCount: maxFallback })
        }
      } else {
        rawCommits = git.getCommitLog({ maxCount: maxFallback })
        logger.debug(`First release - analyzing up to ${rawCommits.length} commits`)
      }

      const scopeFilteringConfig = {
        ...DEFAULT_SCOPE_FILTERING_CONFIG,
        ...config.scopeFiltering,
      }
      const strategy = resolveStrategy(scopeFilteringConfig.strategy ?? 'hybrid', rawCommits)

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

      let fileCommitHashes = createSet<string>()
      if (strategy === 'hybrid' || strategy === 'file-only') {
        const relativePath = getRelativePath(workspaceRoot, projectRoot)
        const pathFilteredCommits = effectiveBaseCommit
          ? readBoundedRange(
              (limit) => git.getCommitsSince(effectiveBaseCommit, { maxCount: limit, path: relativePath }),
              maxFallback,
              `commits touching ${relativePath}`,
              logger
            )
          : git.getCommitLog({ maxCount: maxFallback, path: relativePath })

        fileCommitHashes = createSet(pathFilteredCommits.map((c) => c.hash))
        logger.debug(`Found ${fileCommitHashes.size} commits touching ${relativePath}`)
      }

      const projectScopes = deriveProjectScopes({
        projectName,
        packageName,
        additionalScopes: scopeFilteringConfig.includeScopes,
        prefixes: scopeFilteringConfig.projectPrefixes,
      })
      logger.debug(`Project scopes: ${projectScopes.join(', ')}`)

      const infrastructureCommitHashes = buildInfrastructureCommitHashes(
        git,
        effectiveBaseCommit,
        rawCommits,
        parsedCommits,
        scopeFilteringConfig,
        logger,
        maxFallback
      )

      let dependencyCommitMap: ReadonlyMap<string, ReadonlySet<string>> | undefined
      if (scopeFilteringConfig.trackDependencyChanges) {
        dependencyCommitMap = buildDependencyCommitMap(git, workspaceRoot, projectName, effectiveBaseCommit, logger, maxFallback)
      }

      const classificationContext = createClassificationContext(projectScopes, fileCommitHashes, {
        excludeScopes: scopeFilteringConfig.excludeScopes,
        includeScopes: scopeFilteringConfig.includeScopes,
        infrastructureCommitHashes,
        dependencyCommitMap,
      })

      const classificationResult = classifyCommits(parsedCommits, classificationContext)

      const includedCommits = applyStrategyFilter(classificationResult.included, strategy)

      const commits: ConventionalCommit[] = includedCommits.map((c) => toChangelogCommit(c))

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
          effectiveBaseCommit,
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
 * Minimal commit shape consumed by {@link resolveStrategy} when inferring the
 * filtering strategy from existing commit messages.
 */
type CommitMessage = {
  /** Commit message to analyze */
  message: string
}

/**
 * Resolves the filtering strategy, handling 'inferred' by analyzing commits.
 *
 * @param strategy - The configured scope filtering strategy
 * @param commits - The commits to analyze for strategy inference
 * @returns The resolved strategy (never 'inferred')
 */
function resolveStrategy(strategy: ScopeFilteringStrategy, commits: readonly CommitMessage[]): Exclude<ScopeFilteringStrategy, 'inferred'> {
  if (strategy !== 'inferred') {
    return strategy
  }

  let scopedCount = 0
  for (const commit of commits) {
    const parsed = parseConventionalCommit(commit.message)
    if (parsed.scope.length > 0) {
      scopedCount++
    }
  }

  const scopeRatio = commits.length > 0 ? scopedCount / commits.length : 0

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
      return commits.filter((c) => c.source === 'direct-scope')

    case 'file-only':
      return commits.filter((c) => c.source === 'direct-file' || c.source === 'unscoped-file')

    case 'hybrid':
    default:
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
 * Slice of a classification summary needed by {@link buildSummaryMessage}.
 */
type ClassificationSummary = {
  /** Count of commits by source type */
  bySource: Record<string, number>
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
function buildSummaryMessage(includedCount: number, totalCount: number, summary: ClassificationSummary, strategy: string): string {
  if (includedCount === 0) {
    return `No releasable commits found for this project (${totalCount} total, strategy: ${strategy})`
  }

  const parts = [`Found ${includedCount} releasable commits`, `(${totalCount} total`, `strategy: ${strategy})`]

  return parts.join(' ')
}

/**
 * Minimal logger interface accepted by analyze-commits helpers.
 * Only `debug` is required; consumers may pass a richer logger.
 */
type DebugLogger = {
  /** Debug logging function */
  debug: (msg: string) => void
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
 * @param baseCommit - Base commit hash for commit range (null for first release/fallback)
 * @param rawCommits - All raw commits being analyzed
 * @param parsedCommits - Parsed commits with conventional commit data
 * @param config - Scope filtering configuration
 * @param logger - Logger with debug method for output
 * @param logger.debug - Debug logging function
 * @param maxFallback - Maximum commits to query when baseCommit is null
 * @returns Set of commit hashes classified as infrastructure
 */
function buildInfrastructureCommitHashes(
  git: GitClient,
  baseCommit: string | null,
  rawCommits: readonly GitCommit[],
  parsedCommits: readonly CommitWithRaw[],
  config: ScopeFilteringConfig,
  logger: DebugLogger,
  maxFallback: number
): ReadonlySet<string> | undefined {
  let infraHashes = createSet<string>()

  const infraPaths = config.infrastructure?.paths ?? []
  if (infraPaths.length > 0) {
    for (const infraPath of infraPaths) {
      const pathCommits = baseCommit
        ? git.getCommitsSince(baseCommit, { path: infraPath })
        : git.getCommitLog({ maxCount: maxFallback, path: infraPath })

      for (const commit of pathCommits) {
        infraHashes = infraHashes.add(commit.hash)
      }
    }
    logger.debug(`Found ${infraHashes.size} commits touching infrastructure paths: ${infraPaths.join(', ')}`)
  }

  const configMatcher = config.infrastructure ? buildInfrastructureMatcher(config.infrastructure) : null
  const customMatcher = config.infrastructureMatcher
  const combinedMatcher = combineMatcher(configMatcher, customMatcher)

  if (combinedMatcher) {
    let parsedByHash = createMap<string, CommitWithRaw>()
    for (const parsed of parsedCommits) {
      parsedByHash = parsedByHash.set(parsed.raw.hash, parsed)
    }

    for (const rawCommit of rawCommits) {
      if (infraHashes.has(rawCommit.hash)) continue

      const parsed = parsedByHash.get(rawCommit.hash)
      const scope = parsed?.commit.scope

      const context = createMatchContext(rawCommit, scope)
      if (combinedMatcher(context)) {
        infraHashes = infraHashes.add(rawCommit.hash)
      }
    }
    logger.debug(`Infrastructure matcher found ${infraHashes.size} total commits`)
  }

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

/**
 * Builds a map of dependency project names to the commit hashes that touched them.
 *
 * This enables accurate indirect-dependency classification by verifying that:
 * 1. A commit's scope matches a dependency name
 * 2. The commit actually touched that dependency's files (hash in set)
 *
 * Uses lib-project-scope for dependency discovery, avoiding hard NX dependency.
 *
 * @param git - Git client for querying commits by path
 * @param workspaceRoot - Absolute path to workspace root
 * @param projectName - Name of the project being versioned
 * @param baseCommit - Base commit hash for commit range (null for first release/fallback)
 * @param logger - Logger with debug method for output
 * @param logger.debug - Debug logging function
 * @param maxFallback - Maximum commits to query when baseCommit is null
 * @returns Map of dependency names to commit hashes touching that dependency
 */
function buildDependencyCommitMap(
  git: GitClient,
  workspaceRoot: string,
  projectName: string,
  baseCommit: string | null,
  logger: DebugLogger,
  maxFallback: number
): ReadonlyMap<string, ReadonlySet<string>> {
  let dependencyMap = createMap<string, ReadonlySet<string>>()

  try {
    const projects = discoverNxProjects(workspaceRoot)
    const projectGraph = buildSimpleProjectGraph(workspaceRoot, projects)

    const projectDeps = projectGraph.dependencies[projectName] ?? []

    if (projectDeps.length === 0) {
      logger.debug(`No dependencies found for project: ${projectName}`)
      return dependencyMap
    }

    logger.debug(`Found ${projectDeps.length} dependencies for ${projectName}: ${projectDeps.map((d) => d.target).join(', ')}`)

    for (const dep of projectDeps) {
      const depNode = projectGraph.nodes[dep.target]
      if (!depNode?.data?.root) {
        logger.debug(`Skipping dependency ${dep.target}: no root path found`)
        continue
      }

      const depRoot = depNode.data.root

      const depCommits = baseCommit
        ? git.getCommitsSince(baseCommit, { path: depRoot })
        : git.getCommitLog({ maxCount: maxFallback, path: depRoot })

      if (depCommits.length > 0) {
        const hashSet = createSet(depCommits.map((c) => c.hash))
        dependencyMap = dependencyMap.set(dep.target, hashSet)
        logger.debug(`Dependency ${dep.target}: ${depCommits.length} commits at ${depRoot}`)
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.debug(`Failed to build dependency map: ${message}`)
  }

  return dependencyMap
}
