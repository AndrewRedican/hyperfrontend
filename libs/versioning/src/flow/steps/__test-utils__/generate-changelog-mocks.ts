import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { ChangelogEntry, ChangelogItem } from '../../../changelog/models/entry'
import type { ConventionalCommit } from '../../../commits/models/conventional'
import type { GitClient } from '../../../git/factory'
import type { Registry } from '../../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../../models/types'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { jest } from '@hyperfrontend/testing'

/** Seed files for the in-memory tree the changelog steps read and write. */
export interface MockTreeOptions {
  /** Absolute path to file content, for example `{ '/workspace/libs/test/CHANGELOG.md': '# Changelog\n' }` */
  files?: Record<string, string>
}

/**
 * Builds a logger whose every method is a jest spy, so tests can assert on the
 * info and debug lines the changelog steps emit.
 *
 * @returns Logger backed by jest mock functions
 *
 * @example Asserting the step logged the compare URL it generated
 * ```typescript
 * const logger = createMockLogger()
 * await step.execute({ ...createMockContext(), logger })
 * expect(logger.debug).toHaveBeenCalledWith('Compare URL: def4567...abc123')
 * ```
 */
export function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setLogLevel: jest.fn(),
  } as unknown as Logger
}

/**
 * Builds a virtual file tree rooted at `/workspace` backed by an in-memory map.
 * Writes land in the map and are recorded on a jest spy, so tests can assert on
 * both the written content and the path it went to.
 *
 * @param options - Seed files keyed by absolute path
 * @returns Tree preloaded with the supplied files
 *
 * @example Seeding an existing changelog before running the write step
 * ```typescript
 * const tree = createMockTree({ files: { '/workspace/libs/test/CHANGELOG.md': '# Changelog\n' } })
 * const written = (tree.write as jest.Mock).mock.calls[0][1] as string
 * ```
 */
export function createMockTree(options: MockTreeOptions = {}): Tree {
  const files = createMap<string, string>(entries(options.files ?? {}))

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

/**
 * Builds a registry that reports nothing published. The changelog steps never
 * query it, so every lookup resolves empty.
 *
 * @returns Registry whose queries all resolve empty
 *
 * @example Attaching the registry to a hand-rolled context
 * ```typescript
 * const context = { ...createMockContext(), registry: createMockRegistry() }
 * ```
 */
export function createMockRegistry(): Registry {
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

/**
 * Builds a git client whose head resolves to `abc123`, which is the hash the
 * compare URL assertions expect on the right-hand side of every range.
 *
 * @returns Git client answering with benign constants
 *
 * @example Attaching the client to a hand-rolled context
 * ```typescript
 * const context = { ...createMockContext(), git: createMockGitClient() }
 * ```
 */
export function createMockGitClient(): GitClient {
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

/**
 * Builds a parsed conventional commit, defaulting to an unscoped `feat` so
 * tests only spell out the fields they assert on.
 *
 * @param overrides - Fields merged over the `feat: test commit` defaults
 * @returns Conventional commit ready to place in flow state
 *
 * @example Building a scoped breaking change
 * ```typescript
 * const commit = createMockCommit({ scope: ['api'], subject: 'new endpoint', breaking: true })
 * ```
 */
export function createMockCommit(overrides: Partial<ConventionalCommit> = {}): ConventionalCommit {
  return {
    type: 'feat',
    scope: [],
    subject: 'test commit',
    breaking: false,
    breakingDescription: undefined,
    body: undefined,
    footers: [],
    raw: 'feat: test commit',
    ...overrides,
  }
}

/**
 * Builds a changelog bullet carrying only a description, with no commit
 * references and no breaking marker.
 *
 * @param description - Bullet text as it renders under a section heading
 * @returns Changelog item for a section's `items` array
 *
 * @example Filling a features section with one bullet
 * ```typescript
 * const section = { type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }
 * ```
 */
export function createMockChangelogItem(description: string): ChangelogItem {
  return { description, commits: [], references: [], breaking: false }
}

/**
 * Builds a released `1.0.0` changelog entry with a single features section, so
 * write-step tests can focus on file handling rather than entry shape.
 *
 * @param overrides - Fields merged over the released `1.0.0` defaults
 * @returns Changelog entry ready to place in flow state
 *
 * @example Writing a `0.2.0` entry with no sections
 * ```typescript
 * const entry = createMockChangelogEntry({ version: '0.2.0', sections: [] })
 * ```
 */
export function createMockChangelogEntry(overrides: Partial<ChangelogEntry> = {}): ChangelogEntry {
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

/**
 * Builds the flow context the changelog steps execute against, for the
 * `lib-test` project published as `@test/pkg` under the conventional preset.
 *
 * @param state - Flow state carried into the step
 * @param config - Config fragment merged over the conventional preset
 * @returns Flow context ready to hand to `step.execute`
 *
 * @example Running the generate step for a minor bump
 * ```typescript
 * const ctx = createMockContext({ nextVersion: '1.1.0', bumpType: 'minor', commits: [createMockCommit()] })
 * const result = await createGenerateChangelogStep().execute(ctx)
 * ```
 */
export function createMockContext(state: Partial<FlowState> = {}, config: Partial<FlowConfig> = {}): FlowContext {
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
