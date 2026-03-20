import type { ConventionalCommit } from '../models/conventional'
import type { ClassificationContext, ClassificationResult, ClassifiedCommit, CommitSource, CommitWithRaw } from './models'
import { createClassifiedCommit, createEmptyClassificationSummary } from './models'
import { scopeIsExcluded, scopeMatchesProject, DEFAULT_EXCLUDE_SCOPES } from './project-scopes'

/**
 * Classifies a single commit against a project.
 *
 * Implements the hybrid classification strategy:
 * 1. Check scope match (fast path)
 * 2. Check file touch (validation/catch-all)
 * 3. Check dependency touch (indirect)
 * 4. Fallback to excluded
 *
 * @param input - The commit to classify
 * @param context - Classification context with project info
 * @returns Classified commit with source attribution
 *
 * @example
 * const classified = classifyCommit(
 *   { commit: parsedCommit, raw: gitCommit },
 *   { projectScopes: ['versioning'], fileCommitHashes: new Set(['abc123']) }
 * )
 */
export function classifyCommit(input: CommitWithRaw, context: ClassificationContext): ClassifiedCommit {
  const { commit, raw } = input
  const {
    projectScopes,
    fileCommitHashes,
    dependencyCommitMap,
    infrastructureCommitHashes,
    excludeScopes = DEFAULT_EXCLUDE_SCOPES,
    includeScopes = [],
  } = context

  const scope = commit.scope
  const hasScope = !!scope
  const allProjectScopes = [...projectScopes, ...includeScopes]

  // First check: Is this scope explicitly excluded?
  if (hasScope && scopeIsExcluded(scope, excludeScopes)) {
    return createClassifiedCommit(commit, raw, 'excluded')
  }

  // Priority 1: Scope-based direct match (fast path)
  if (hasScope && scopeMatchesProject(scope, allProjectScopes)) {
    return createClassifiedCommit(commit, raw, 'direct-scope')
  }

  // Priority 2: File-based direct match (validation/catch-all)
  if (fileCommitHashes.has(raw.hash)) {
    // Commit touched project files
    if (hasScope) {
      // Has a scope but it's different - likely a typo or cross-cutting change
      return createClassifiedCommit(commit, raw, 'direct-file')
    }
    // No scope but touched project files
    return createClassifiedCommit(commit, raw, 'unscoped-file')
  }

  // Priority 3: Indirect dependency match
  if (hasScope && dependencyCommitMap) {
    const dependencyPath = findDependencyPath(scope, raw.hash, dependencyCommitMap)
    if (dependencyPath) {
      return createClassifiedCommit(commit, raw, 'indirect-dependency', { dependencyPath })
    }
  }

  // File-based infrastructure match
  if (infrastructureCommitHashes?.has(raw.hash)) {
    return createClassifiedCommit(commit, raw, 'indirect-infra')
  }

  // Fallback: No match found
  if (!hasScope) {
    // Unscoped commit that didn't touch any project files
    return createClassifiedCommit(commit, raw, 'unscoped-global')
  }

  // Scoped commit that doesn't match anything
  return createClassifiedCommit(commit, raw, 'excluded')
}

/**
 * Classifies multiple commits against a project.
 *
 * @param commits - Array of commits to classify
 * @param context - Classification context with project info
 * @returns Classification result with all commits and summary
 */
export function classifyCommits(commits: readonly CommitWithRaw[], context: ClassificationContext): ClassificationResult {
  const classified: ClassifiedCommit[] = []
  const included: ClassifiedCommit[] = []
  const excluded: ClassifiedCommit[] = []
  const summary = createEmptyClassificationSummary()
  const bySource = <Record<CommitSource, number>>{ ...summary.bySource }

  for (const input of commits) {
    const result = classifyCommit(input, context)
    classified.push(result)

    // Update summary
    bySource[result.source]++

    if (result.include) {
      included.push(result)
    } else {
      excluded.push(result)
    }
  }

  return {
    commits: classified,
    included,
    excluded,
    summary: {
      total: classified.length,
      included: included.length,
      excluded: excluded.length,
      bySource,
    },
  }
}

/**
 * Finds a dependency path for a given scope and commit hash.
 *
 * Verifies both:
 * 1. The scope matches a dependency name (or variation)
 * 2. The commit hash is in that dependency's commit set
 *
 * This prevents false positives from mislabeled commits.
 *
 * @param scope - The commit scope
 * @param hash - The commit hash to verify
 * @param dependencyCommitMap - Map of dependencies to their commit hashes
 * @returns Dependency path if found and hash verified, undefined otherwise
 */
function findDependencyPath(
  scope: string,
  hash: string,
  dependencyCommitMap: ReadonlyMap<string, ReadonlySet<string>>
): readonly string[] | undefined {
  const normalizedScope = scope.toLowerCase()

  for (const [depName, depHashes] of dependencyCommitMap) {
    // Check if scope matches dependency name or variations
    const depVariations = getDependencyVariations(depName)
    if (depVariations.some((v) => v.toLowerCase() === normalizedScope)) {
      // CRITICAL: Verify the commit actually touched this dependency's files
      // This prevents false positives from mislabeled commits
      if (depHashes.has(hash)) {
        return [depName]
      }
    }
  }

  return undefined
}

/**
 * Generates name variations for a dependency to enable flexible scope matching.
 *
 * @param depName - The dependency project or package name
 * @returns Array of name variations including stripped prefixes
 */
function getDependencyVariations(depName: string): readonly string[] {
  const variations: string[] = [depName]

  // Handle lib- prefix
  if (depName.startsWith('lib-')) {
    variations.push(depName.slice(4))
  }

  // Handle @scope/name
  if (depName.startsWith('@')) {
    const slashIndex = depName.indexOf('/')
    if (slashIndex !== -1) {
      variations.push(depName.slice(slashIndex + 1))
    }
  }

  return variations
}

/**
 * Creates a classification context from common inputs.
 *
 * @param projectScopes - Scopes that match the project
 * @param fileCommitHashes - Set of commit hashes that touched project files
 * @param options - Additional context options
 * @param options.dependencyCommitMap - Map of dependency names to commit hashes touching them
 * @param options.infrastructureCommitHashes - Set of commit hashes touching infrastructure paths
 * @param options.excludeScopes - Scopes to explicitly exclude from classification
 * @param options.includeScopes - Additional scopes to include as direct matches
 * @returns A ClassificationContext object
 */
export function createClassificationContext(
  projectScopes: readonly string[],
  fileCommitHashes: ReadonlySet<string>,
  options?: {
    readonly dependencyCommitMap?: ReadonlyMap<string, ReadonlySet<string>>
    readonly infrastructureCommitHashes?: ReadonlySet<string>
    readonly excludeScopes?: readonly string[]
    readonly includeScopes?: readonly string[]
  }
): ClassificationContext {
  return {
    projectScopes,
    fileCommitHashes,
    dependencyCommitMap: options?.dependencyCommitMap,
    infrastructureCommitHashes: options?.infrastructureCommitHashes,
    excludeScopes: options?.excludeScopes ?? DEFAULT_EXCLUDE_SCOPES,
    includeScopes: options?.includeScopes,
  }
}

/**
 * Filters an array of classified commits to only included ones.
 *
 * @param commits - Array of classified commits
 * @returns Only commits marked for inclusion
 */
export function filterIncluded(commits: readonly ClassifiedCommit[]): readonly ClassifiedCommit[] {
  return commits.filter((c) => c.include)
}

/**
 * Extracts conventional commits from classified commits for changelog generation.
 *
 * @param commits - Array of classified commits
 * @returns Array of conventional commits
 */
export function extractConventionalCommits(commits: readonly ClassifiedCommit[]): readonly ConventionalCommit[] {
  return commits.map((c) => c.commit)
}

/**
 * Creates a modified conventional commit with scope handling based on classification.
 *
 * For direct commits, the scope is removed (redundant in project changelog).
 * For indirect commits, the scope is preserved (provides context).
 *
 * @param classified - Commit with classification metadata determining scope display
 * @returns A conventional commit with appropriate scope handling
 */
export function toChangelogCommit(classified: ClassifiedCommit): ConventionalCommit {
  const { commit, preserveScope } = classified

  if (!preserveScope && commit.scope) {
    // Remove the scope for direct commits
    return {
      ...commit,
      scope: undefined,
      // Rebuild raw to reflect removed scope
      raw: rebuildRawWithoutScope(commit),
    }
  }

  return commit
}

/**
 * Reconstructs a conventional commit message string without the scope portion.
 *
 * @param commit - The conventional commit to rebuild
 * @returns Reconstructed raw message with scope removed
 */
function rebuildRawWithoutScope(commit: ConventionalCommit): string {
  const breaking = commit.breaking && !commit.breakingDescription ? '!' : ''
  const header = `${commit.type}${breaking}: ${commit.subject}`

  if (!commit.body && commit.footers.length === 0) {
    return header
  }

  let raw = header
  if (commit.body) {
    raw += `\n\n${commit.body}`
  }

  for (const footer of commit.footers) {
    raw += `\n${footer.key}${footer.separator}${footer.value}`
  }

  return raw
}
