import type { ChangelogItem, ChangelogSection } from '../../changelog/models/entry'
import type { ChangelogSectionType } from '../../changelog/models/section'
import type { ClassifiedCommit } from '../../commits/classify'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { FlowStep } from '../models/step'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { serializeChangelog, parseChangelog, addEntry } from '../../changelog'
import { createChangelogEntry, createChangelogItem, createChangelogSection } from '../../changelog/models/entry'
import { toChangelogCommit } from '../../commits/classify'
import { createCompareUrl } from '../../repository/url'
import { createStep, createSkippedResult } from '../models/step'

export const GENERATE_CHANGELOG_STEP_ID = 'generate-changelog'

/**
 * Maps conventional commit types to changelog section types.
 */
const COMMIT_TYPE_TO_SECTION: Record<string, ChangelogSectionType> = {
  feat: 'features',
  fix: 'fixes',
  perf: 'performance',
  docs: 'documentation',
  refactor: 'refactoring',
  revert: 'other',
  build: 'build',
  ci: 'ci',
  test: 'tests',
  chore: 'chores',
  style: 'other',
}

/**
 * Checks if a commit source represents an indirect change.
 *
 * @param source - The commit source type
 * @returns True if the commit is indirect (dependency or infrastructure)
 */
function isIndirectSource(source: ClassifiedCommit['source']): boolean {
  return source === 'indirect-dependency' || source === 'indirect-infra'
}

/**
 * Groups classified commits by their section type.
 *
 * @param commits - Array of classified commits
 * @returns Record of section type to classified commits
 */
function groupClassifiedCommitsBySection(commits: readonly ClassifiedCommit[]): Record<ChangelogSectionType, ClassifiedCommit[]> {
  const groups: Record<string, ClassifiedCommit[]> = {}

  for (const classified of commits) {
    const sectionType = COMMIT_TYPE_TO_SECTION[classified.commit.type ?? 'chore'] ?? 'chores'
    if (!groups[sectionType]) {
      groups[sectionType] = []
    }
    groups[sectionType].push(classified)
  }

  return <Record<ChangelogSectionType, ClassifiedCommit[]>>groups
}

/**
 * Groups commits by their section type.
 *
 * @param commits - Array of conventional commits
 * @returns Record of section type to commits
 */
function groupCommitsBySection(commits: readonly ConventionalCommit[]): Record<ChangelogSectionType, ConventionalCommit[]> {
  const groups: Record<string, ConventionalCommit[]> = {}

  for (const commit of commits) {
    const sectionType = COMMIT_TYPE_TO_SECTION[commit.type ?? 'chore'] ?? 'chores'
    if (!groups[sectionType]) {
      groups[sectionType] = []
    }
    groups[sectionType].push(commit)
  }

  return <Record<ChangelogSectionType, ConventionalCommit[]>>groups
}

/**
 * Creates a changelog item from a classified commit.
 *
 * Applies scope display rules:
 * - Direct commits: scope omitted (redundant in project changelog)
 * - Indirect commits: scope preserved (provides context)
 *
 * @param classified - The classified commit with source metadata
 * @returns A changelog item with proper scope handling
 */
function classifiedCommitToItem(classified: ClassifiedCommit): ChangelogItem {
  // Apply scope transformation based on classification
  const commit = toChangelogCommit(classified)
  const indirect = isIndirectSource(classified.source)

  let text = commit.subject

  // Add scope prefix if preserved (indirect commits)
  if (commit.scope) {
    text = `**${commit.scope}:** ${text}`
  }

  // Add breaking change indicator
  if (commit.breaking) {
    text = `⚠️ BREAKING: ${text}`
  }

  return createChangelogItem(text, {
    source: classified.source,
    indirect,
    breaking: commit.breaking,
  })
}

/**
 * Creates a changelog item from a conventional commit.
 *
 * @param commit - The conventional commit
 * @returns A changelog item
 */
function commitToItem(commit: ConventionalCommit): ChangelogItem {
  let text = commit.subject

  // Add scope prefix if present
  if (commit.scope) {
    text = `**${commit.scope}:** ${text}`
  }

  // Add breaking change indicator
  if (commit.breaking) {
    text = `⚠️ BREAKING: ${text}`
  }

  return createChangelogItem(text)
}

/**
 * Creates the generate-changelog step.
 *
 * This step:
 * 1. Groups commits by type/section
 * 2. Creates changelog items from commits
 * 3. Assembles a complete changelog entry
 *
 * State updates:
 * - changelogEntry: The generated ChangelogEntry
 *
 * @returns A FlowStep that generates changelog
 */
export function createGenerateChangelogStep(): FlowStep {
  return createStep(
    GENERATE_CHANGELOG_STEP_ID,
    'Generate Changelog Entry',
    async (ctx) => {
      const { config, state } = ctx
      const { commits, nextVersion, bumpType } = state

      // Skip if no bump needed
      if (!nextVersion || bumpType === 'none') {
        return createSkippedResult('No version bump, skipping changelog generation')
      }

      // Skip if changelog disabled
      if (config.skipChangelog) {
        return createSkippedResult('Changelog generation disabled')
      }

      // Handle case with no commits (e.g., first release)
      if (!commits || commits.length === 0) {
        // Generate compare URL using commit hashes ONLY
        // Only generate if we have a valid base commit (effectiveBaseCommit will be null if fallback was used)
        let compareUrl: string | undefined
        if (state.repositoryConfig && state.effectiveBaseCommit) {
          const currentCommit = ctx.git.getHeadHash()
          compareUrl =
            createCompareUrl({
              repository: state.repositoryConfig,
              // TODO: Phase 6 will rename these to fromCommit/toCommit
              fromTag: state.effectiveBaseCommit,
              toTag: currentCommit,
            }) ?? undefined
        } else if (state.publishedCommit && !state.effectiveBaseCommit) {
          // Log why we're not generating a compare URL
          ctx.logger.info('Compare URL omitted: published commit not in current history')
        }

        const entry = createChangelogEntry(nextVersion, {
          date: createDate().toISOString().split('T')[0],
          sections: [createChangelogSection('features', 'Features', [createChangelogItem('Initial release')])],
          compareUrl,
        })

        return {
          status: 'success',
          stateUpdates: { changelogEntry: entry },
          message: 'Generated initial release changelog entry',
        }
      }

      // Use classification result when available for proper scope handling
      const { classificationResult } = state
      const sections: ChangelogSection[] = []

      if (classificationResult && classificationResult.included.length > 0) {
        // Use classified commits for proper scope display rules
        const classifiedCommits = classificationResult.included

        // Separate direct and indirect commits
        const directCommits = classifiedCommits.filter((c) => !isIndirectSource(c.source))
        const indirectCommits = classifiedCommits.filter((c) => isIndirectSource(c.source))

        // Add breaking changes section first if any
        const breakingCommits = classifiedCommits.filter((c) => c.commit.breaking)
        if (breakingCommits.length > 0) {
          sections.push(
            createChangelogSection(
              'breaking',
              'Breaking Changes',
              breakingCommits.map((c) => {
                const commit = toChangelogCommit(c)
                const text = commit.breakingDescription ?? commit.subject
                const indirect = isIndirectSource(c.source)
                return createChangelogItem(commit.scope ? `**${commit.scope}:** ${text}` : text, {
                  source: c.source,
                  indirect,
                  breaking: true,
                })
              })
            )
          )
        }

        // Group direct commits by section
        const groupedDirect = groupClassifiedCommitsBySection(directCommits)

        // Add other sections in conventional order (direct commits only)
        const sectionOrder: readonly { type: ChangelogSectionType; heading: string }[] = [
          { type: 'features', heading: 'Features' },
          { type: 'fixes', heading: 'Bug Fixes' },
          { type: 'performance', heading: 'Performance' },
          { type: 'documentation', heading: 'Documentation' },
          { type: 'refactoring', heading: 'Code Refactoring' },
          { type: 'build', heading: 'Build' },
          { type: 'ci', heading: 'Continuous Integration' },
          { type: 'tests', heading: 'Tests' },
          { type: 'chores', heading: 'Chores' },
          { type: 'other', heading: 'Other' },
        ]

        for (const { type: sectionType, heading } of sectionOrder) {
          const sectionCommits = groupedDirect[sectionType]
          if (sectionCommits && sectionCommits.length > 0) {
            sections.push(createChangelogSection(sectionType, heading, sectionCommits.map(classifiedCommitToItem)))
          }
        }

        // Add Dependency Updates section for indirect commits if any
        if (indirectCommits.length > 0) {
          sections.push(
            createChangelogSection(
              'other', // Use 'other' as section type for dependency updates
              'Dependency Updates',
              indirectCommits.map((c) => classifiedCommitToItem(c))
            )
          )
        }
      } else {
        // Fallback: use commits without classification (backward compatibility)
        const grouped = groupCommitsBySection(commits)

        // Add breaking changes section first if any
        const breakingCommits = commits.filter((c) => c.breaking)
        if (breakingCommits.length > 0) {
          sections.push(
            createChangelogSection(
              'breaking',
              'Breaking Changes',
              breakingCommits.map((c) => {
                const text = c.breakingDescription ?? c.subject
                return createChangelogItem(c.scope ? `**${c.scope}:** ${text}` : text)
              })
            )
          )
        }

        // Add other sections in conventional order
        const sectionOrder: readonly { type: ChangelogSectionType; heading: string }[] = [
          { type: 'features', heading: 'Features' },
          { type: 'fixes', heading: 'Bug Fixes' },
          { type: 'performance', heading: 'Performance' },
          { type: 'documentation', heading: 'Documentation' },
          { type: 'refactoring', heading: 'Code Refactoring' },
          { type: 'build', heading: 'Build' },
          { type: 'ci', heading: 'Continuous Integration' },
          { type: 'tests', heading: 'Tests' },
          { type: 'chores', heading: 'Chores' },
          { type: 'other', heading: 'Other' },
        ]

        for (const { type: sectionType, heading } of sectionOrder) {
          const sectionCommits = grouped[sectionType]
          if (sectionCommits && sectionCommits.length > 0) {
            sections.push(createChangelogSection(sectionType, heading, sectionCommits.map(commitToItem)))
          }
        }
      }

      // Generate compare URL using commit hashes ONLY
      // Only generate if we have a valid base commit (effectiveBaseCommit will be null if fallback was used)
      let compareUrl: string | undefined
      if (state.repositoryConfig && state.effectiveBaseCommit) {
        const currentCommit = ctx.git.getHeadHash()
        compareUrl =
          createCompareUrl({
            repository: state.repositoryConfig,
            // TODO: Phase 6 will rename these to fromCommit/toCommit
            fromTag: state.effectiveBaseCommit,
            toTag: currentCommit,
          }) ?? undefined
        ctx.logger.debug(`Compare URL: ${state.effectiveBaseCommit.slice(0, 7)}...${currentCommit.slice(0, 7)}`)
      } else if (state.publishedCommit && !state.effectiveBaseCommit) {
        // Log why we're not generating a compare URL
        ctx.logger.info('Compare URL omitted: published commit not in current history')
      }

      // Create the entry
      const entry = createChangelogEntry(nextVersion, {
        date: createDate().toISOString().split('T')[0],
        sections,
        compareUrl,
      })

      return {
        status: 'success',
        stateUpdates: { changelogEntry: entry },
        message: `Generated changelog with ${sections.length} section(s), ${commits.length} commit(s)`,
      }
    },
    {
      dependsOn: ['check-idempotency'],
    }
  )
}

/**
 * Creates the write-changelog step.
 *
 * This step writes the generated changelog entry to CHANGELOG.md.
 *
 * @returns A FlowStep that writes changelog to file
 */
export function createWriteChangelogStep(): FlowStep {
  return createStep(
    'write-changelog',
    'Write Changelog',
    async (ctx) => {
      const { tree, projectRoot, config, state, logger } = ctx
      const { changelogEntry, nextVersion, bumpType } = state

      // Skip if no bump or no changelog
      if (!nextVersion || bumpType === 'none' || !changelogEntry || config.skipChangelog) {
        return createSkippedResult('No changelog to write')
      }

      const changelogPath = `${projectRoot}/CHANGELOG.md`
      let existingContent = ''

      // Read existing changelog
      try {
        existingContent = tree.read(changelogPath, 'utf-8') ?? ''
      } catch {
        logger.debug('No existing CHANGELOG.md found')
      }

      // If no existing content, create new changelog
      if (!existingContent.trim()) {
        const newChangelog = {
          header: {
            title: '# Changelog',
            description: ['All notable changes to this project will be documented in this file.'],
            links: [],
          },
          entries: [changelogEntry],
          metadata: {
            format: <const>'conventional',
            isConventional: true,
            warnings: [],
          },
        }

        const serialized = serializeChangelog(newChangelog)
        tree.write(changelogPath, serialized)

        return {
          status: 'success',
          stateUpdates: {
            modifiedFiles: [...(state.modifiedFiles ?? []), changelogPath],
          },
          message: `Created CHANGELOG.md with version ${nextVersion}`,
        }
      }

      // Parse existing and add entry
      const existing = parseChangelog(existingContent)
      const updated = addEntry(existing, changelogEntry)
      const serialized = serializeChangelog(updated)

      tree.write(changelogPath, serialized)

      return {
        status: 'success',
        stateUpdates: {
          modifiedFiles: [...(state.modifiedFiles ?? []), changelogPath],
        },
        message: `Updated CHANGELOG.md with version ${nextVersion}`,
      }
    },
    {
      dependsOn: ['generate-changelog'],
    }
  )
}
