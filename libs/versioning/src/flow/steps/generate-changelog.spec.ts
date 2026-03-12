import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope'

import type { ChangelogEntry, ChangelogItem } from '../../changelog/models/entry'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
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

// ============================================================================
// Tests: createGenerateChangelogStep
// ============================================================================

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
})

// ============================================================================
// Tests: createWriteChangelogStep
// ============================================================================

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
})
