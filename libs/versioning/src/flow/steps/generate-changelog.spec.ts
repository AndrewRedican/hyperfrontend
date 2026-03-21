import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope'
import type { ChangelogEntry, ChangelogItem } from '../../changelog/models/entry'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { RepositoryConfig } from '../../repository/models'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'

import { createGenerateChangelogStep, createWriteChangelogStep, GENERATE_CHANGELOG_STEP_ID } from './generate-changelog'

function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setLogLevel: jest.fn(),
  } as unknown as Logger
}

interface MockTreeOptions {
  files?: Record<string, string>
}

function createMockTree(options: MockTreeOptions = {}): Tree {
  const files = new Map(Object.entries(options.files ?? {}))

  return {
    root: '/workspace',
    read(path: string, encoding?: string) {
      const content = files.get(path)
      if (content === undefined) {
        return null
      }
      return encoding ? content : Buffer.from(content)
    },
    write: jest.fn((path: string, content: string) => {
      files.set(path, content)
    }),
    exists: (path: string) => files.has(path),
    delete: jest.fn(),
    rename: jest.fn(),
    isFile: (path: string) => files.has(path),
    children: () => [],
    listChanges: () => [],
  } as unknown as Tree
}

function createMockRegistry(): Registry {
  return {
    name: 'mock',
    url: 'https://mock.registry.com',
    async getLatestVersion() {
      return null
    },
    async isVersionPublished() {
      return false
    },
    async getPackageInfo() {
      return null
    },
    async getVersionInfo() {
      return null
    },
    async listVersions() {
      return []
    },
  }
}

function createMockGitClient(): GitClient {
  return {
    cwd: '/workspace',
    timeout: 30000,
    getCommitLog: () => [],
    getCommitsBetween: () => [],
    getCommitsSince: () => [],
    getCommit: () => null,
    commitExists: () => true,
    getTags: () => [],
    getTag: () => null,
    createTag: jest.fn(),
    deleteTag: () => true,
    tagExists: () => false,
    getLatestTag: () => null,
    getTagsForPackage: () => [],
    pushTag: () => true,
    createCommit: jest.fn(),
    stage: jest.fn(),
    unstage: () => true,
    stageAll: jest.fn(),
    amendCommit: jest.fn(),
    createEmptyCommit: jest.fn(),
    getHead: () => 'abc123',
    getCurrentBranch: () => 'main',
    hasStagedChanges: () => false,
    hasUnstagedChanges: () => false,
    hasUntrackedFiles: () => false,
    getStatus: () => ({
      clean: true,
      entries: [],
      staged: [],
      unstaged: [],
      untracked: [],
    }),
    isClean: () => true,
    getRepositoryRoot: () => '/workspace',
    getHeadHash: () => 'abc123',
    getHeadShortHash: () => 'abc123',
    getModifiedFiles: () => [],
    getUntrackedFiles: () => [],
    getStagedFiles: () => [],
  } as unknown as GitClient
}

function createMockCommit(overrides: Partial<ConventionalCommit> = {}): ConventionalCommit {
  return {
    type: 'feat',
    scope: undefined,
    subject: 'test commit',
    breaking: false,
    breakingDescription: undefined,
    body: undefined,
    footers: [],
    raw: 'feat: test commit',
    ...overrides,
  }
}

function createMockChangelogItem(description: string): ChangelogItem {
  return { description, commits: [], references: [], breaking: false }
}

function createMockChangelogEntry(overrides: Partial<ChangelogEntry> = {}): ChangelogEntry {
  return {
    version: '1.0.0',
    date: '2024-01-15',
    unreleased: false,
    sections: [
      {
        type: 'features' as const,
        heading: 'Features',
        items: [createMockChangelogItem('Feature 1')],
      },
    ],
    ...overrides,
  }
}

function createMockContext(state: Partial<FlowState> = {}, config: Partial<FlowConfig> = {}): FlowContext {
  return {
    workspaceRoot: '/workspace',
    projectName: 'lib-test',
    projectRoot: '/workspace/libs/test',
    packageName: '@test/pkg',
    tree: createMockTree(),
    registry: createMockRegistry(),
    git: createMockGitClient(),
    logger: createMockLogger(),
    config: { preset: 'conventional', ...config },
    state: { ...state },
  }
}

describe('Generate Changelog Step', () => {
  describe('createGenerateChangelogStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createGenerateChangelogStep()

      expect(step.id).toBe(GENERATE_CHANGELOG_STEP_ID)
      expect(step.id).toBe('generate-changelog')
      expect(step.name).toBe('Generate Changelog Entry')
    })

    it('depends on check-idempotency step', () => {
      const step = createGenerateChangelogStep()

      expect(step.dependsOn).toContain('check-idempotency')
    })
  })

  describe('execute - skip conditions', () => {
    it('skips when no bump needed (no nextVersion)', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({ bumpType: 'none', nextVersion: undefined })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('No version bump')
    })

    it('skips when bumpType is none', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'none' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })

    it('skips when changelog disabled', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' }, { skipChangelog: true })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
      expect(result.message).toContain('Changelog generation disabled')
    })
  })

  describe('execute - initial release', () => {
    it('generates initial release entry when no commits', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry).toBeDefined()
      expect(result.stateUpdates?.changelogEntry.version).toBe('1.0.0')
      expect(result.message).toContain('initial release')
    })

    it('generates initial release entry when commits is undefined', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '0.1.0',
        bumpType: 'minor',
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry).toBeDefined()
    })
  })

  describe('execute - commit grouping', () => {
    it('groups commits by type into sections', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.1.0',
        bumpType: 'minor',
        commits: [
          createMockCommit({ type: 'feat', subject: 'feature 1' }),
          createMockCommit({ type: 'feat', subject: 'feature 2' }),
          createMockCommit({ type: 'fix', subject: 'bug fix' }),
        ],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const entry = result.stateUpdates?.changelogEntry
      expect(entry.sections.length).toBeGreaterThanOrEqual(2)

      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      const fixesSection = entry.sections.find((s: { type: string }) => s.type === 'fixes')

      expect(featuresSection?.items).toHaveLength(2)
      expect(fixesSection?.items).toHaveLength(1)
    })

    it('includes commit scope in changelog item', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: 'api', subject: 'new endpoint' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const featSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featSection?.items[0].description).toContain('**api:**')
    })
  })

  describe('execute - breaking changes', () => {
    it('adds breaking changes section first', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        commits: [
          createMockCommit({ type: 'feat', subject: 'breaking feature', breaking: true }),
          createMockCommit({ type: 'fix', subject: 'normal fix' }),
        ],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      expect(entry.sections[0].type).toBe('breaking')
      expect(entry.sections[0].heading).toBe('Breaking Changes')
    })

    it('uses breakingDescription when available', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        commits: [
          createMockCommit({
            type: 'feat',
            subject: 'refactor API',
            breaking: true,
            breakingDescription: 'API signature changed',
          }),
        ],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const breakingSection = entry.sections.find((s: { type: string }) => s.type === 'breaking')
      expect(breakingSection?.items[0].description).toContain('API signature changed')
    })

    it('includes scope in breaking change item', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        commits: [
          createMockCommit({
            type: 'feat',
            scope: 'core',
            subject: 'breaking change',
            breaking: true,
          }),
        ],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const breakingSection = entry.sections.find((s: { type: string }) => s.type === 'breaking')
      expect(breakingSection?.items[0].description).toContain('**core:**')
    })

    it('adds breaking indicator to feature items', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        commits: [
          createMockCommit({
            type: 'feat',
            subject: 'breaking feature',
            breaking: true,
          }),
        ],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featuresSection?.items[0].description).toContain('⚠️ BREAKING:')
    })
  })

  describe('execute - commit type mapping', () => {
    it('maps perf to performance section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.1',
        bumpType: 'patch',
        commits: [createMockCommit({ type: 'perf', subject: 'faster loading' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const perfSection = entry.sections.find((s: { type: string }) => s.type === 'performance')
      expect(perfSection).toBeDefined()
    })

    it('maps docs to documentation section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'docs', subject: 'update readme' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const docsSection = entry.sections.find((s: { type: string }) => s.type === 'documentation')
      expect(docsSection).toBeDefined()
    })

    it('maps chore to chores section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'chore', subject: 'update deps' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeDefined()
    })

    it('maps unknown types to chores', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'custom', subject: 'custom commit' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeDefined()
    })

    it('maps refactor to refactoring section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'refactor', subject: 'simplify logic' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const refactorSection = entry.sections.find((s: { type: string }) => s.type === 'refactoring')
      expect(refactorSection).toBeDefined()
      expect(refactorSection?.heading).toBe('Code Refactoring')
    })

    it('maps revert to other section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'revert', subject: 'revert previous change' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const otherSection = entry.sections.find((s: { type: string }) => s.type === 'other')
      expect(otherSection).toBeDefined()
    })

    it('maps build to build section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'build', subject: 'update build config' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const buildSection = entry.sections.find((s: { type: string }) => s.type === 'build')
      expect(buildSection).toBeDefined()
    })

    it('maps ci to ci section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'ci', subject: 'add workflow' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const ciSection = entry.sections.find((s: { type: string }) => s.type === 'ci')
      expect(ciSection).toBeDefined()
      expect(ciSection?.heading).toBe('Continuous Integration')
    })

    it('maps test to tests section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'test', subject: 'add unit tests' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const testsSection = entry.sections.find((s: { type: string }) => s.type === 'tests')
      expect(testsSection).toBeDefined()
    })

    it('maps style to other section', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'style', subject: 'format code' })],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const otherSection = entry.sections.find((s: { type: string }) => s.type === 'other')
      expect(otherSection).toBeDefined()
    })

    it('defaults to chores when commit type is undefined', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [{ ...createMockCommit(), type: undefined as unknown as string }],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeDefined()
    })

    it('uses default mapping when commitTypeToSection is undefined', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          commits: [createMockCommit({ type: 'chore', subject: 'update deps' })],
        },
        { commitTypeToSection: undefined }
      )

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeDefined()
    })

    it('overrides existing mapping via config', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          commits: [createMockCommit({ type: 'chore', subject: 'update deps' })],
        },
        { commitTypeToSection: { chore: 'other' } }
      )

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const otherSection = entry.sections.find((s: { type: string }) => s.type === 'other')
      expect(otherSection).toBeDefined()
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeUndefined()
    })

    it('adds custom commit type via config', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          commits: [createMockCommit({ type: 'wip', subject: 'work in progress' })],
        },
        { commitTypeToSection: { wip: 'other' } }
      )

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const otherSection = entry.sections.find((s: { type: string }) => s.type === 'other')
      expect(otherSection).toBeDefined()
    })

    it('excludes commit type when mapped to null', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          commits: [
            createMockCommit({ type: 'feat', subject: 'new feature' }),
            createMockCommit({ type: 'docs', subject: 'update readme' }),
          ],
        },
        { commitTypeToSection: { docs: null } }
      )

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const docsSection = entry.sections.find((s: { type: string }) => s.type === 'documentation')
      expect(docsSection).toBeUndefined()
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featuresSection).toBeDefined()
    })

    it('falls back to chores for unmapped custom type without config', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          commits: [createMockCommit({ type: 'experiment', subject: 'try something' })],
        },
        { commitTypeToSection: { wip: 'other' } } // has custom config but not for 'experiment'
      )

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const choresSection = entry.sections.find((s: { type: string }) => s.type === 'chores')
      expect(choresSection).toBeDefined()
    })
  })

  describe('execute - section ordering', () => {
    it('orders sections by conventional format', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [
          createMockCommit({ type: 'chore', subject: 'chore' }),
          createMockCommit({ type: 'feat', subject: 'feature' }),
          createMockCommit({ type: 'fix', subject: 'fix' }),
          createMockCommit({ type: 'docs', subject: 'docs' }),
        ],
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const types = entry.sections.map((s: { type: string }) => s.type)

      // Features should come before fixes, fixes before docs, docs before chores
      expect(types.indexOf('features')).toBeLessThan(types.indexOf('fixes'))
      expect(types.indexOf('fixes')).toBeLessThan(types.indexOf('documentation'))
      expect(types.indexOf('documentation')).toBeLessThan(types.indexOf('chores'))
    })
  })

  describe('execute - success message', () => {
    it('includes section and commit counts in message', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [
          createMockCommit({ type: 'feat', subject: 'f1' }),
          createMockCommit({ type: 'feat', subject: 'f2' }),
          createMockCommit({ type: 'fix', subject: 'fix' }),
        ],
      })

      const result = await step.execute(ctx)

      expect(result.message).toMatch(/\d+ section\(s\)/)
      expect(result.message).toMatch(/\d+ commit\(s\)/)
    })
  })

  describe('execute - compare URL generation', () => {
    // Note: Compare URLs now use commit hashes only (not tags)
    // Mock git client returns 'abc123' for getHeadHash()

    const createGitHubConfig = (): RepositoryConfig => ({
      platform: 'github',
      baseUrl: 'https://github.com/owner/repo',
    })

    const createGitLabConfig = (): RepositoryConfig => ({
      platform: 'gitlab',
      baseUrl: 'https://gitlab.com/group/project',
    })

    const createBitbucketConfig = (): RepositoryConfig => ({
      platform: 'bitbucket',
      baseUrl: 'https://bitbucket.org/owner/repo',
    })

    it('does not include compareUrl when repositoryConfig is not present', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        effectiveBaseCommit: 'def456789',
        commits: [createMockCommit({ type: 'feat', subject: 'new feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBeUndefined()
    })

    it('does not include compareUrl when effectiveBaseCommit is not present', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        commits: [createMockCommit({ type: 'feat', subject: 'new feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBeUndefined()
    })

    it('does not include compareUrl when effectiveBaseCommit is null', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        effectiveBaseCommit: null,
        commits: [createMockCommit({ type: 'feat', subject: 'new feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBeUndefined()
    })

    it('logs info when publishedCommit exists but effectiveBaseCommit is null (fallback mode)', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        publishedCommit: 'orphaned123', // Commit exists in registry but not in history
        effectiveBaseCommit: null, // Null because fallback was used
        commits: [createMockCommit({ type: 'feat', subject: 'new feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBeUndefined()
      expect(ctx.logger.info).toHaveBeenCalledWith('Compare URL omitted: published commit not in current history')
    })

    it('generates GitHub compareUrl using commit hashes when effectiveBaseCommit exists', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.1.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        effectiveBaseCommit: 'def456789',
        commits: [createMockCommit({ type: 'feat', subject: 'new feature' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      // Uses commit hashes: effectiveBaseCommit...getHeadHash() (abc123 from mock)
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBe('https://github.com/owner/repo/compare/def456789...abc123')
    })

    it('generates GitLab compareUrl with /-/ prefix using commit hashes', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        repositoryConfig: createGitLabConfig(),
        effectiveBaseCommit: 'def456789',
        commits: [createMockCommit({ type: 'feat', subject: 'breaking change', breaking: true })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBe('https://gitlab.com/group/project/-/compare/def456789...abc123')
    })

    it('generates Bitbucket compareUrl with reversed order and two dots using commit hashes', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.1',
        bumpType: 'patch',
        repositoryConfig: createBitbucketConfig(),
        effectiveBaseCommit: 'def456789',
        commits: [createMockCommit({ type: 'fix', subject: 'bug fix' })],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      // Bitbucket uses reversed order (toCommit..fromCommit) with two dots
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBe('https://bitbucket.org/owner/repo/compare/abc123..def456789')
    })

    it('handles initial release path with repositoryConfig but no commits', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '0.1.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        // No effectiveBaseCommit for initial release
        commits: [],
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.message).toContain('initial release')
      // No compareUrl for true initial release (no effectiveBaseCommit)
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBeUndefined()
    })

    it('generates compareUrl for version reset scenario (empty commits but has effectiveBaseCommit)', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'major',
        repositoryConfig: createGitHubConfig(),
        effectiveBaseCommit: 'def456789',
        commits: [], // Empty commits but has effectiveBaseCommit (version reset scenario)
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBe('https://github.com/owner/repo/compare/def456789...abc123')
    })

    it('uses custom formatter when platform is custom', async () => {
      const step = createGenerateChangelogStep()
      const customConfig: RepositoryConfig = {
        platform: 'custom',
        baseUrl: 'https://my-git.internal/repo',
        formatCompareUrl: (from, to) => `https://my-git.internal/diff/${from}/${to}`,
      }
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        repositoryConfig: customConfig,
        effectiveBaseCommit: 'def456789',
        commits: [createMockCommit({ type: 'feat', subject: 'feature' })],
      })

      const result = await step.execute(ctx)

      // Custom formatter receives commit hashes: effectiveBaseCommit, getHeadHash()
      expect(result.stateUpdates?.changelogEntry.compareUrl).toBe('https://my-git.internal/diff/def456789/abc123')
    })

    it('logs debug message with abbreviated commit hashes when generating compareUrl', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        repositoryConfig: createGitHubConfig(),
        effectiveBaseCommit: 'def456789abcdef',
        commits: [createMockCommit({ type: 'feat', subject: 'feature' })],
      })

      await step.execute(ctx)

      expect(ctx.logger.debug).toHaveBeenCalledWith('Compare URL: def4567...abc123')
    })
  })
})

describe('Write Changelog Step', () => {
  describe('createWriteChangelogStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createWriteChangelogStep()

      expect(step.id).toBe('write-changelog')
      expect(step.name).toBe('Write Changelog')
    })

    it('depends on generate-changelog step', () => {
      const step = createWriteChangelogStep()

      expect(step.dependsOn).toContain('generate-changelog')
    })
  })

  describe('execute - skip conditions', () => {
    it('skips when no nextVersion', async () => {
      const step = createWriteChangelogStep()
      const ctx = createMockContext({ bumpType: 'minor', changelogEntry: createMockChangelogEntry() })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })

    it('skips when bumpType is none', async () => {
      const step = createWriteChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'none',
        changelogEntry: createMockChangelogEntry({ version: '1.0.0', sections: [] }),
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })

    it('skips when no changelog entry', async () => {
      const step = createWriteChangelogStep()
      const ctx = createMockContext({ nextVersion: '1.0.0', bumpType: 'minor' })

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })

    it('skips when changelog disabled', async () => {
      const step = createWriteChangelogStep()
      const ctx = createMockContext(
        {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({ version: '1.0.0', sections: [] }),
        },
        { skipChangelog: true }
      )

      const result = await step.execute(ctx)

      expect(result.status).toBe('skipped')
    })
  })

  describe('execute - create new changelog', () => {
    it('creates new CHANGELOG.md when none exists', async () => {
      const step = createWriteChangelogStep()
      const tree = createMockTree()
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({
            version: '1.0.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Initial feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.write).toHaveBeenCalled()
      expect(result.message).toContain('Created CHANGELOG.md')
    })

    it('adds changelog path to modified files', async () => {
      const step = createWriteChangelogStep()
      const tree = createMockTree()
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({ version: '1.0.0', sections: [] }),
          modifiedFiles: [],
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.stateUpdates?.modifiedFiles).toContain('/workspace/libs/test/CHANGELOG.md')
    })
  })

  describe('execute - update existing changelog', () => {
    it('adds entry to existing CHANGELOG.md', async () => {
      const existingChangelog = `# Changelog

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.2.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.write).toHaveBeenCalled()
      expect(result.message).toContain('Updated CHANGELOG.md')
    })

    it('preserves existing modified files when updating', async () => {
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': '# Changelog\n' },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({ version: '1.0.0', sections: [] }),
          modifiedFiles: ['/workspace/libs/test/package.json'],
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.stateUpdates?.modifiedFiles).toContain('/workspace/libs/test/package.json')
      expect(result.stateUpdates?.modifiedFiles).toContain('/workspace/libs/test/CHANGELOG.md')
    })
  })

  describe('execute - error handling', () => {
    it('handles read error gracefully and creates new changelog', async () => {
      const step = createWriteChangelogStep()
      const logger = createMockLogger()

      // Create a tree that throws when reading the changelog
      const throwingTree = {
        root: '/workspace',
        read: jest.fn((path: string) => {
          if (path.includes('CHANGELOG.md')) {
            throw new Error('Read error')
          }
          return null
        }),
        write: jest.fn(),
        exists: () => false,
        delete: jest.fn(),
        rename: jest.fn(),
        isFile: () => false,
        children: () => [],
        listChanges: () => [],
      } as unknown as Tree

      const ctx: FlowContext = {
        workspaceRoot: '/workspace',
        projectName: 'lib-test',
        projectRoot: '/workspace/libs/test',
        packageName: '@test/pkg',
        tree: throwingTree,
        registry: createMockRegistry(),
        git: createMockGitClient(),
        logger,
        config: { preset: 'conventional' },
        state: {
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({ version: '1.0.0', sections: [] }),
        },
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(logger.debug).toHaveBeenCalledWith('No existing CHANGELOG.md found')
      expect(result.message).toContain('Created CHANGELOG.md')
    })
  })

  describe('execute - classification result', () => {
    function createMockRawCommit(hash = 'abc123') {
      return {
        hash,
        shortHash: hash.slice(0, 7),
        authorName: 'Test',
        authorEmail: 'test@test.com',
        authorDate: '2024-01-15T10:00:00Z',
        committerName: 'Test',
        committerEmail: 'test@test.com',
        commitDate: '2024-01-15T10:00:00Z',
        subject: 'test commit',
        body: '',
        message: 'test commit',
        parents: [],
        refs: [],
      }
    }

    function createMockSummary(overrides: Partial<{ total: number; included: number; excluded: number }> = {}) {
      return {
        total: overrides.total ?? 1,
        included: overrides.included ?? 1,
        excluded: overrides.excluded ?? 0,
        bySource: {
          'direct-scope': 0,
          'direct-file': 0,
          'unscoped-file': 0,
          'indirect-dependency': 0,
          'indirect-infra': 0,
          'unscoped-global': 0,
          excluded: 0,
        },
      }
    }

    function createClassifiedCommit(
      overrides: Partial<{
        type: string
        scope: string
        subject: string
        breaking: boolean
        breakingDescription: string
        source: 'direct-scope' | 'direct-file' | 'unscoped-file' | 'indirect-dependency' | 'indirect-infra'
        include: boolean
        preserveScope: boolean
      }> = {}
    ) {
      const {
        type = 'feat',
        scope,
        subject = 'test feature',
        breaking = false,
        breakingDescription,
        source = 'direct-scope',
        include = true,
        preserveScope = source !== 'direct-scope',
      } = overrides

      return {
        commit: {
          type,
          scope,
          subject,
          breaking,
          breakingDescription,
          body: undefined,
          footers: [],
          raw: `${type}${scope ? `(${scope})` : ''}: ${subject}`,
        },
        raw: createMockRawCommit(),
        source,
        include,
        preserveScope,
      }
    }

    it('uses classificationResult when available', async () => {
      const step = createGenerateChangelogStep()
      const directCommit = createClassifiedCommit({
        type: 'feat',
        scope: 'lib-test',
        subject: 'add new feature',
        source: 'direct-scope',
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: 'lib-test', subject: 'add new feature' })],
        classificationResult: {
          commits: [directCommit],
          included: [directCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const entry = result.stateUpdates?.changelogEntry
      expect(entry.sections.length).toBeGreaterThan(0)
    })

    it('omits scope for direct-scope commits (redundant)', async () => {
      const step = createGenerateChangelogStep()
      const directCommit = createClassifiedCommit({
        type: 'feat',
        scope: 'lib-test',
        subject: 'add feature',
        source: 'direct-scope',
        preserveScope: false, // direct-scope commits do NOT preserve scope
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: 'lib-test', subject: 'add feature' })],
        classificationResult: {
          commits: [directCommit],
          included: [directCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featuresSection).toBeDefined()
      // Scope should NOT appear in description for direct-scope commits
      expect(featuresSection.items[0].description).not.toContain('**lib-test:**')
      expect(featuresSection.items[0].description).toBe('add feature')
    })

    it('preserves scope for direct-file commits (informative)', async () => {
      const step = createGenerateChangelogStep()
      const directFileCommit = createClassifiedCommit({
        type: 'feat',
        scope: 'lib-other',
        subject: 'cross-project feature',
        source: 'direct-file',
        preserveScope: true,
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: 'lib-other', subject: 'cross-project feature' })],
        classificationResult: {
          commits: [directFileCommit],
          included: [directFileCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featuresSection).toBeDefined()
      // Scope SHOULD appear for direct-file commits
      expect(featuresSection.items[0].description).toContain('**lib-other:**')
    })

    it('preserves scope for indirect-dependency commits', async () => {
      const step = createGenerateChangelogStep()
      const indirectCommit = createClassifiedCommit({
        type: 'feat',
        scope: 'lib-utils',
        subject: 'utility improvement',
        source: 'indirect-dependency',
        preserveScope: true,
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: 'lib-utils', subject: 'utility improvement' })],
        classificationResult: {
          commits: [indirectCommit],
          included: [indirectCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      // Indirect commits go to "Dependency Updates" section
      const depSection = entry.sections.find((s: { heading: string }) => s.heading === 'Dependency Updates')
      expect(depSection).toBeDefined()
      expect(depSection.items[0].description).toContain('**lib-utils:**')
    })

    it('creates Dependency Updates section for indirect commits', async () => {
      const step = createGenerateChangelogStep()
      const directCommit = createClassifiedCommit({
        type: 'feat',
        subject: 'direct feature',
        source: 'direct-scope',
      })
      const indirectCommit = createClassifiedCommit({
        type: 'fix',
        scope: 'lib-dep',
        subject: 'dependency fix',
        source: 'indirect-dependency',
        preserveScope: true,
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [
          createMockCommit({ type: 'feat', subject: 'direct feature' }),
          createMockCommit({ type: 'fix', scope: 'lib-dep', subject: 'dependency fix' }),
        ],
        classificationResult: {
          commits: [directCommit, indirectCommit],
          included: [directCommit, indirectCommit],
          excluded: [],
          summary: createMockSummary({ total: 2, included: 2 }),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      // Should have Features section and Dependency Updates section
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      const depSection = entry.sections.find((s: { heading: string }) => s.heading === 'Dependency Updates')

      expect(featuresSection).toBeDefined()
      expect(depSection).toBeDefined()
      expect(depSection.items[0].description).toContain('**lib-dep:**')
    })

    it('sets indirect flag on ChangelogItem for indirect commits', async () => {
      const step = createGenerateChangelogStep()
      const indirectCommit = createClassifiedCommit({
        type: 'feat',
        scope: 'lib-infra',
        subject: 'infra update',
        source: 'indirect-infra',
        preserveScope: true,
      })

      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: 'lib-infra', subject: 'infra update' })],
        classificationResult: {
          commits: [indirectCommit],
          included: [indirectCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const depSection = entry.sections.find((s: { heading: string }) => s.heading === 'Dependency Updates')
      expect(depSection).toBeDefined()
      expect(depSection.items[0].indirect).toBe(true)
      expect(depSection.items[0].source).toBe('indirect-infra')
    })

    it('handles breaking changes with classification', async () => {
      const step = createGenerateChangelogStep()
      const breakingCommit = createClassifiedCommit({
        type: 'feat',
        scope: 'lib-test',
        subject: 'major API change',
        breaking: true,
        breakingDescription: 'Removed deprecated method',
        source: 'direct-scope',
      })

      const ctx = createMockContext({
        nextVersion: '2.0.0',
        bumpType: 'major',
        commits: [
          createMockCommit({
            type: 'feat',
            scope: 'lib-test',
            subject: 'major API change',
            breaking: true,
            breakingDescription: 'Removed deprecated method',
          }),
        ],
        classificationResult: {
          commits: [breakingCommit],
          included: [breakingCommit],
          excluded: [],
          summary: createMockSummary(),
        },
      })

      const result = await step.execute(ctx)

      const entry = result.stateUpdates?.changelogEntry
      const breakingSection = entry.sections.find((s: { type: string }) => s.type === 'breaking')
      expect(breakingSection).toBeDefined()
      expect(breakingSection.heading).toBe('Breaking Changes')
      expect(breakingSection.items[0].breaking).toBe(true)
    })

    it('falls back to commits without classification for backward compatibility', async () => {
      const step = createGenerateChangelogStep()
      const ctx = createMockContext({
        nextVersion: '1.0.0',
        bumpType: 'minor',
        commits: [createMockCommit({ type: 'feat', scope: 'other', subject: 'fallback feature' })],
        // No classificationResult provided
      })

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const entry = result.stateUpdates?.changelogEntry
      const featuresSection = entry.sections.find((s: { type: string }) => s.type === 'features')
      expect(featuresSection).toBeDefined()
      // Fallback path preserves all scopes
      expect(featuresSection.items[0].description).toContain('**other:**')
    })
  })

  describe('execute - pending publication cleanup', () => {
    it('removes stacked entries when isPendingPublication is true', async () => {
      // Existing changelog has an unpublished 0.2.0 entry stacked on top
      const existingChangelog = `# Changelog

## [0.2.0] - 2024-01-10

### Features

- Unpublished feature

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0', // Published is 0.1.0
          isPendingPublication: true, // Current 0.2.0 was never published
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Updated feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      // The 0.2.0 entry should be replaced (not stacked)
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      // Should contain 0.2.0 with "Updated feature" not "Unpublished feature"
      expect(writtenContent).toContain('Updated feature')
      expect(writtenContent).not.toContain('Unpublished feature')
      // Should still contain the published 0.1.0 entry
      expect(writtenContent).toContain('0.1.0')
    })

    it('removes multiple stacked entries when isPendingPublication is true', async () => {
      // Multiple unpublished entries stacked
      const existingChangelog = `# Changelog

## [0.3.0] - 2024-01-15

### Features

- Feature 0.3.0

## [0.2.0] - 2024-01-10

### Features

- Feature 0.2.0

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const logger = createMockLogger()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0', // Only 0.1.0 is published
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Correct feature')] }],
          }),
        }),
        tree,
        logger,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      // Both 0.2.0 and 0.3.0 entries should be removed and replaced with new 0.2.0
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      expect(writtenContent).toContain('Correct feature')
      expect(writtenContent).not.toContain('Feature 0.3.0')
      expect(writtenContent).not.toContain('Feature 0.2.0')
      // Should still contain published 0.1.0
      expect(writtenContent).toContain('0.1.0')
      // Should log the removal
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Removing stacked entries'))
    })

    it('preserves unreleased entry during cleanup', async () => {
      const existingChangelog = `# Changelog

## [Unreleased]

### Features

- Work in progress

## [0.2.0] - 2024-01-10

### Features

- Unpublished feature

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Updated feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      // Unreleased entry should be preserved
      expect(writtenContent).toContain('Unreleased')
      expect(writtenContent).toContain('Work in progress')
    })

    it('does not remove entries when isPendingPublication is false', async () => {
      const existingChangelog = `# Changelog

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0',
          isPendingPublication: false, // Not pending - normal flow
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      // Both entries should exist - new one added, old one preserved
      expect(writtenContent).toContain('0.2.0')
      expect(writtenContent).toContain('0.1.0')
      expect(writtenContent).toContain('New feature')
      expect(writtenContent).toContain('Initial release')
    })

    it('does not remove entries when isPendingPublication is undefined', async () => {
      const existingChangelog = `# Changelog

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.2.0',
          bumpType: 'minor',
          // isPendingPublication is undefined (legacy flow)
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      // Both entries should exist
      expect(writtenContent).toContain('0.2.0')
      expect(writtenContent).toContain('0.1.0')
    })

    it('handles de-escalation scenario (version downgrade)', async () => {
      // 0.2.0 was created but commits warranted only patch, so nextVersion is 0.1.1
      const existingChangelog = `# Changelog

## [0.2.0] - 2024-01-10

### Features

- Wrong version feature

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.1.1', // De-escalated from 0.2.0 to 0.1.1
          bumpType: 'patch',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.1.1',
            sections: [{ type: 'fixes' as const, heading: 'Bug Fixes', items: [createMockChangelogItem('Bug fix')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      // 0.2.0 should be removed, 0.1.1 should be added
      expect(writtenContent).toContain('0.1.1')
      expect(writtenContent).not.toContain('0.2.0')
      expect(writtenContent).toContain('Bug fix')
      expect(writtenContent).not.toContain('Wrong version feature')
    })

    it('handles escalation scenario (version upgrade)', async () => {
      // 0.1.1 was created but new breaking change warrants 0.2.0
      const existingChangelog = `# Changelog

## [0.1.1] - 2024-01-10

### Bug Fixes

- Wrong version fix

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.2.0', // Escalated from 0.1.1 to 0.2.0
          bumpType: 'minor',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      // 0.1.1 should be removed, 0.2.0 should be added
      expect(writtenContent).toContain('0.2.0')
      expect(writtenContent).not.toContain('0.1.1')
      expect(writtenContent).toContain('New feature')
      expect(writtenContent).not.toContain('Wrong version fix')
    })

    it('does not fail when publishedVersion is missing during pending state', async () => {
      const existingChangelog = `# Changelog

## [0.2.0] - 2024-01-10

### Features

- Some feature

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.2.0',
          bumpType: 'minor',
          // publishedVersion is missing
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('Updated feature')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      // Should still succeed, just won't clean up entries
      expect(result.status).toBe('success')
    })

    it('uses replaceExisting when adding entry in pending publication state', async () => {
      // Entry version already exists - should replace, not throw
      const existingChangelog = `# Changelog

## [0.2.0] - 2024-01-10

### Features

- Old content

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/CHANGELOG.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '0.2.0',
          bumpType: 'minor',
          publishedVersion: '0.1.0',
          isPendingPublication: true,
          changelogEntry: createMockChangelogEntry({
            version: '0.2.0',
            sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New content')] }],
          }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      const writtenContent = (tree.write as jest.Mock).mock.calls[0][1] as string
      // Should have replaced the entry, not added a duplicate
      expect(writtenContent).toContain('New content')
      expect(writtenContent).not.toContain('Old content')
      // Count occurrences of version heading - should be exactly 1
      // Changelog serializes as "## [0.2.0]" or "## 0.2.0" depending on format
      const matches = writtenContent.match(/##\s+\[?0\.2\.0\]?/g)
      expect(matches).toHaveLength(1)
    })
  })

  describe('execute - custom changelog filename', () => {
    it('uses changelogFileName from config when creating new changelog', async () => {
      const step = createWriteChangelogStep()
      const tree = createMockTree({ files: {} })
      const ctx: FlowContext = {
        ...createMockContext(
          {
            nextVersion: '1.0.0',
            bumpType: 'minor',
            changelogEntry: createMockChangelogEntry({ version: '1.0.0' }),
          },
          { changelogFileName: 'HISTORY.md' }
        ),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.write).toHaveBeenCalledWith('/workspace/libs/test/HISTORY.md', expect.any(String))
      expect(result.stateUpdates?.modifiedFiles).toContain('/workspace/libs/test/HISTORY.md')
      expect(result.message).toContain('Created HISTORY.md')
    })

    it('uses changelogFileName from config when updating existing changelog', async () => {
      const existingChangelog = `# Changelog

## [0.1.0] - 2024-01-01

### Features

- Initial release
`
      const step = createWriteChangelogStep()
      const tree = createMockTree({
        files: { '/workspace/libs/test/RELEASES.md': existingChangelog },
      })
      const ctx: FlowContext = {
        ...createMockContext(
          {
            nextVersion: '0.2.0',
            bumpType: 'minor',
            changelogEntry: createMockChangelogEntry({
              version: '0.2.0',
              sections: [{ type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }],
            }),
          },
          { changelogFileName: 'RELEASES.md' }
        ),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.write).toHaveBeenCalledWith('/workspace/libs/test/RELEASES.md', expect.any(String))
      expect(result.message).toContain('Updated RELEASES.md')
    })

    it('defaults to CHANGELOG.md when changelogFileName not specified', async () => {
      const step = createWriteChangelogStep()
      const tree = createMockTree({ files: {} })
      const ctx: FlowContext = {
        ...createMockContext({
          nextVersion: '1.0.0',
          bumpType: 'minor',
          changelogEntry: createMockChangelogEntry({ version: '1.0.0' }),
        }),
        tree,
      }

      const result = await step.execute(ctx)

      expect(result.status).toBe('success')
      expect(tree.write).toHaveBeenCalledWith('/workspace/libs/test/CHANGELOG.md', expect.any(String))
    })
  })
})
