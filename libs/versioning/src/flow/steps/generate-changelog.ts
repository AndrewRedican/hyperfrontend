import type { ChangelogItem, ChangelogSection } from '../../changelog/models/entry'
import type { ChangelogSectionType } from '../../changelog/models/section'
import type { ClassifiedCommit } from '../../commits/classify'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { FlowStep } from '../models/step'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { serializeChangelog, parseChangelog, addEntry, removeEntries } from '../../changelog'
import { createChangelogEntry, createChangelogItem, createChangelogSection } from '../../changelog/models/entry'
import { toChangelogCommit } from '../../commits/classify'
import { createCompareUrl } from '../../repository/url'
import { gt } from '../../semver/compare'
import { parseVersion } from '../../semver/parse/version'
import { createStep, createSkippedResult } from '../models/step'
import { DEFAULT_CHANGELOG_FILENAME } from '../models/types'

export const GENERATE_CHANGELOG_STEP_ID = 'generate-changelog'

/**
 * Maps conventional commit types to changelog section types.
 */
export const DEFAULT_COMMIT_TYPE_TO_SECTION: Record<string, ChangelogSectionType> = {
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
 * Resolves the commit type to section mapping by merging config with defaults.
 *
 * @param configMapping - User-provided partial mapping from FlowConfig
 * @returns Resolved mapping with user overrides applied
 */
function resolveCommitTypeMapping(
  configMapping: Partial<Record<string, ChangelogSectionType | null>> | undefined
): Record<string, ChangelogSectionType | null> {
  if (!configMapping) {
    return DEFAULT_COMMIT_TYPE_TO_SECTION
  }
  return { ...DEFAULT_COMMIT_TYPE_TO_SECTION, ...configMapping }
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
 * @param mapping - Commit type to section mapping
 * @returns Record of section type to classified commits
 */
function groupClassifiedCommitsBySection(
  commits: readonly ClassifiedCommit[],
  mapping: Record<string, ChangelogSectionType | null>
): Record<ChangelogSectionType, ClassifiedCommit[]> {
  const groups: Record<string, ClassifiedCommit[]> = {}

  for (const classified of commits) {
    const sectionType = mapping[classified.commit.type ?? 'chore']
    if (sectionType === null) continue
    const resolvedSection = sectionType ?? 'chores'
    if (!groups[resolvedSection]) {
      groups[resolvedSection] = []
    }
    groups[resolvedSection].push(classified)
  }

  return <Record<ChangelogSectionType, ClassifiedCommit[]>>groups
}

/**
 * Groups commits by their section type.
 *
 * @param commits - Array of conventional commits
 * @param mapping - Commit type to section mapping
 * @returns Record of section type to commits
 */
function groupCommitsBySection(
  commits: readonly ConventionalCommit[],
  mapping: Record<string, ChangelogSectionType | null>
): Record<ChangelogSectionType, ConventionalCommit[]> {
  const groups: Record<string, ConventionalCommit[]> = {}

  for (const commit of commits) {
    const sectionType = mapping[commit.type ?? 'chore']
    if (sectionType === null) continue
    const resolvedSection = sectionType ?? 'chores'
    if (!groups[resolvedSection]) {
      groups[resolvedSection] = []
    }
    groups[resolvedSection].push(commit)
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
  const commit = toChangelogCommit(classified)
  const indirect = isIndirectSource(classified.source)

  let text = commit.subject

  if (commit.scope) {
    text = `**${commit.scope}:** ${text}`
  }

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

  if (commit.scope) {
    text = `**${commit.scope}:** ${text}`
  }

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
 *
 * @example
 * ```typescript
 * import { createGenerateChangelogStep, executeStep } from '@hyperfrontend/versioning'
 *
 * const step = createGenerateChangelogStep()
 * const result = await executeStep(step, context)
 *
 * // Access the generated changelog entry
 * const entry = result.stateUpdates?.changelogEntry
 * console.log(entry?.version, entry?.sections.length)
 * // => '1.2.0', 3
 * ```
 */
export function createGenerateChangelogStep(): FlowStep {
  return createStep(
    GENERATE_CHANGELOG_STEP_ID,
    'Generate Changelog Entry',
    async (ctx) => {
      const { config, state } = ctx
      const { commits, nextVersion, bumpType } = state

      const commitTypeMapping = resolveCommitTypeMapping(config.commitTypeToSection)

      if (!nextVersion || bumpType === 'none') {
        return createSkippedResult('No version bump, skipping changelog generation')
      }

      if (config.skipChangelog) {
        return createSkippedResult('Changelog generation disabled')
      }

      if (!commits || commits.length === 0) {
        let compareUrl: string | undefined
        if (state.repositoryConfig && state.effectiveBaseCommit) {
          const currentCommit = ctx.git.getHeadHash()
          compareUrl =
            createCompareUrl({
              repository: state.repositoryConfig,
              fromCommit: state.effectiveBaseCommit,
              toCommit: currentCommit,
            }) ?? undefined
        } else if (state.publishedCommit && !state.effectiveBaseCommit) {
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

      const { classificationResult } = state
      const sections: ChangelogSection[] = []

      if (classificationResult && classificationResult.included.length > 0) {
        const classifiedCommits = classificationResult.included

        const directCommits = classifiedCommits.filter((c) => !isIndirectSource(c.source))
        const indirectCommits = classifiedCommits.filter((c) => isIndirectSource(c.source))

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

        const groupedDirect = groupClassifiedCommitsBySection(directCommits, commitTypeMapping)

        const sectionOrder: readonly {
          /** Changelog section type identifier */
          type: ChangelogSectionType
          /** Display heading for the section */
          heading: string
        }[] = [
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

        if (indirectCommits.length > 0) {
          sections.push(
            createChangelogSection(
              'other',
              'Dependency Updates',
              indirectCommits.map((c) => classifiedCommitToItem(c))
            )
          )
        }
      } else {
        const grouped = groupCommitsBySection(commits, commitTypeMapping)

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

        const sectionOrder: readonly {
          /** Changelog section type identifier */
          type: ChangelogSectionType
          /** Display heading for the section */
          heading: string
        }[] = [
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

      let compareUrl: string | undefined
      if (state.repositoryConfig && state.effectiveBaseCommit) {
        const currentCommit = ctx.git.getHeadHash()
        compareUrl =
          createCompareUrl({
            repository: state.repositoryConfig,
            fromCommit: state.effectiveBaseCommit,
            toCommit: currentCommit,
          }) ?? undefined
        ctx.logger.debug(`Compare URL: ${state.effectiveBaseCommit.slice(0, 7)}...${currentCommit.slice(0, 7)}`)
      } else if (state.publishedCommit && !state.effectiveBaseCommit) {
        ctx.logger.info('Compare URL omitted: published commit not in current history')
      }

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
 *
 * @example
 * ```typescript
 * import { createWriteChangelogStep, executeStep } from '@hyperfrontend/versioning'
 *
 * const step = createWriteChangelogStep()
 * const result = await executeStep(step, context)
 *
 * // CHANGELOG.md is updated with the new entry
 * console.log(result.message)
 * // => 'Updated CHANGELOG.md with version 1.2.0'
 * ```
 */
export function createWriteChangelogStep(): FlowStep {
  return createStep(
    'write-changelog',
    'Write Changelog',
    async (ctx) => {
      const { tree, projectRoot, config, state, logger } = ctx
      const { changelogEntry, nextVersion, bumpType } = state

      if (!nextVersion || bumpType === 'none' || !changelogEntry || config.skipChangelog) {
        return createSkippedResult('No changelog to write')
      }

      const changelogFileName = config.changelogFileName ?? DEFAULT_CHANGELOG_FILENAME
      const changelogPath = `${projectRoot}/${changelogFileName}`
      const backupPath = changelogPath.replace('.md', '.backup.md')
      const shouldBackup = config.backupChangelog && tree.exists(changelogPath) && tree.isFile(changelogPath)
      let existingContent = ''

      if (shouldBackup) {
        logger.debug(`Creating backup: ${changelogFileName} -> ${changelogFileName.replace('.md', '.backup.md')}`)
        tree.rename(changelogPath, backupPath)
        try {
          existingContent = tree.read(backupPath, 'utf-8') ?? ''
        } catch {
          logger.debug(`Could not read backup ${backupPath}`)
        }
      } else {
        try {
          existingContent = tree.read(changelogPath, 'utf-8') ?? ''
        } catch {
          logger.debug(`No existing ${changelogFileName} found`)
        }
      }

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
          message: `Created ${changelogFileName} with version ${nextVersion}`,
        }
      }

      const existing = parseChangelog(existingContent)

      const isPendingPublication = state.isPendingPublication === true
      let changelog = existing

      if (isPendingPublication && state.publishedVersion) {
        const publishedVer = parseVersion(state.publishedVersion)
        if (publishedVer.success && publishedVer.version) {
          const pubVer = publishedVer.version
          const toRemove = changelog.entries
            .filter((e) => !e.unreleased)
            .filter((e) => {
              const ver = parseVersion(e.version)
              return ver.success && ver.version && gt(ver.version, pubVer)
            })
            .map((e) => e.version)

          if (toRemove.length > 0) {
            logger.info(`Removing stacked entries: ${toRemove.join(', ')}`)
            changelog = removeEntries(changelog, toRemove, { throwIfNotFound: false })
          }
        }
      }

      const updated = addEntry(changelog, changelogEntry, { replaceExisting: isPendingPublication })
      const serialized = serializeChangelog(updated)

      tree.write(changelogPath, serialized)

      if (shouldBackup && tree.exists(backupPath)) {
        logger.debug(`Removing backup: ${changelogFileName.replace('.md', '.backup.md')}`)
        tree.delete(backupPath)
      }

      return {
        status: 'success',
        stateUpdates: {
          modifiedFiles: [...(state.modifiedFiles ?? []), changelogPath],
        },
        message: `Updated ${changelogFileName} with version ${nextVersion}`,
      }
    },
    {
      dependsOn: ['generate-changelog'],
    }
  )
}
