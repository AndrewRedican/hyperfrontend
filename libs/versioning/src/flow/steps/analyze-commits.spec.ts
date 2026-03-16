import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope'

import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../models/types'

import { createAnalyzeCommitsStep, ANALYZE_COMMITS_STEP_ID } from './analyze-commits'

function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setLogLevel: jest.fn(),
  } as unknown as Logger
}

function createMockTree(): Tree {
  return {
    root: '/workspace',
    read: () => null,
    write: jest.fn(),
    exists: () => false,
    delete: jest.fn(),
    rename: jest.fn(),
    isFile: () => false,
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

interface MockGitClientOptions {
  commits?: readonly { message: string; hash: string }[]
  packageTags?: readonly { name: string; hash: string }[]
  projectTags?: readonly { name: string; hash: string }[]
}

function createMockGitClient(options: MockGitClientOptions = {}): GitClient {
  const { commits = [], packageTags = [], projectTags = [] } = options

  return {
    cwd: '/workspace',
    timeout: 30000,
    getCommitLog: (opts?: { maxCount?: number }) => {
      if (opts?.maxCount) {
        return commits.slice(0, opts.maxCount)
      }
      return commits
    },
    getCommitsBetween: () => commits,
    getCommitsSince: () => commits,
    getCommit: () => (commits.length > 0 ? commits[0] : null),
    commitExists: () => true,
    getTags: () => [],
    getTag: () => null,
    createTag: jest.fn(),
    deleteTag: () => true,
    tagExists: () => false,
    getLatestTag: () => null,
    getTagsForPackage: (name: string) => {
      // Return packageTags when querying for package name, projectTags for project name
      if (name.startsWith('@') || name.includes('/')) {
        return packageTags as { name: string; hash: string }[]
      }
      return projectTags as { name: string; hash: string }[]
    },
    pushTag: () => true,
    createCommit: jest.fn(),
    stage: () => true,
    unstage: () => true,
    stageAll: () => true,
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

function createMockContext(overrides?: {
  git?: GitClient
  logger?: Logger
  state?: FlowState
  config?: Partial<FlowConfig>
  projectName?: string
  packageName?: string
}): FlowContext {
  return {
    workspaceRoot: '/workspace',
    projectName: overrides?.projectName ?? 'lib-test',
    projectRoot: '/workspace/libs/test',
    packageName: overrides?.packageName ?? '@test/pkg',
    tree: createMockTree(),
    registry: createMockRegistry(),
    git: overrides?.git ?? createMockGitClient(),
    logger: overrides?.logger ?? createMockLogger(),
    config: {
      preset: 'conventional',
      releaseTypes: ['feat', 'fix', 'perf', 'revert'],
      ...overrides?.config,
    },
    state: overrides?.state ?? {},
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('analyze-commits step', () => {
  describe('ANALYZE_COMMITS_STEP_ID', () => {
    it('has the correct ID', () => {
      expect(ANALYZE_COMMITS_STEP_ID).toBe('analyze-commits')
    })
  })

  describe('createAnalyzeCommitsStep', () => {
    it('creates a step with correct ID and name', () => {
      const step = createAnalyzeCommitsStep()

      expect(step.id).toBe('analyze-commits')
      expect(step.name).toBe('Analyze Commits')
      expect(typeof step.execute).toBe('function')
    })

    it('depends on fetch-registry step', () => {
      const step = createAnalyzeCommitsStep()

      expect(step.dependsOn).toContain('fetch-registry')
    })

    describe('execute', () => {
      describe('tag discovery', () => {
        it('finds last release tag for package name', async () => {
          const git = createMockGitClient({
            packageTags: [
              { name: '@test/pkg@1.0.0', hash: 'abc123' },
              { name: '@test/pkg@0.9.0', hash: 'def456' },
            ],
            commits: [{ message: 'feat: new feature', hash: 'ghi789' }],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: false },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.lastReleaseTag).toBe('@test/pkg@1.0.0')
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Found last release tag: @test/pkg@1.0.0'))
        })

        it('falls back to project name format when no package tags exist', async () => {
          const git = createMockGitClient({
            packageTags: [], // No package name tags
            projectTags: [
              { name: 'lib-test@1.0.0', hash: 'abc123' },
              { name: 'lib-test@0.5.0', hash: 'def456' },
            ],
            commits: [{ message: 'fix: bug fix', hash: 'ghi789' }],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: false },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.lastReleaseTag).toBe('lib-test@1.0.0')
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Found last release tag (project format): lib-test@1.0.0'))
        })

        it('handles no tags found for non-first release', async () => {
          const git = createMockGitClient({
            packageTags: [],
            projectTags: [],
            commits: [{ message: 'feat: new feature', hash: 'abc123' }],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: false },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.lastReleaseTag).toBe(null)
        })

        it('skips tag lookup for first release', async () => {
          const git = createMockGitClient({
            packageTags: [{ name: '@test/pkg@1.0.0', hash: 'abc123' }],
            commits: [{ message: 'feat: initial', hash: 'def456' }],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.lastReleaseTag).toBe(null)
          // Should log about first release commits, not tags
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('First release'))
        })
      })

      describe('commit analysis', () => {
        it('gets commits since last release tag', async () => {
          const git = createMockGitClient({
            packageTags: [{ name: '@test/pkg@1.0.0', hash: 'abc123' }],
            commits: [
              { message: 'feat: feature 1', hash: 'commit1' },
              { message: 'fix: bug fix', hash: 'commit2' },
            ],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: false },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.commits).toHaveLength(2)
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Found 2 commits since'))
        })

        it('gets all commits for first release (limited to 100)', async () => {
          const commits = Array.from({ length: 150 }, (_, i) => ({
            message: `feat: feature ${i}`,
            hash: `commit${i}`,
          }))
          const git = createMockGitClient({ commits })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          // Should be limited to 100 commits
          expect(result.stateUpdates?.commits?.length).toBeLessThanOrEqual(100)
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('First release'))
        })

        it('parses conventional commits and filters by release types', async () => {
          const git = createMockGitClient({
            packageTags: [{ name: '@test/pkg@1.0.0', hash: 'abc123' }],
            commits: [
              { message: 'feat: new feature', hash: 'commit1' },
              { message: 'fix: bug fix', hash: 'commit2' },
              { message: 'docs: update readme', hash: 'commit3' }, // Not a release type
              { message: 'chore: cleanup', hash: 'commit4' }, // Not a release type
              { message: 'perf: improve speed', hash: 'commit5' },
            ],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: false },
            config: { releaseTypes: ['feat', 'fix', 'perf', 'revert'] },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          // Should only include feat, fix, perf (not docs, chore)
          expect(result.stateUpdates?.commits).toHaveLength(3)
        })

        it('filters invalid conventional commits', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat: valid feature', hash: 'commit1' },
              { message: 'not a conventional commit', hash: 'commit2' },
              { message: 'fix: valid fix', hash: 'commit3' },
              { message: 'WIP stuff', hash: 'commit4' },
            ],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.commits).toHaveLength(2)
        })

        it('returns empty commits array when no releasable commits found', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'docs: update docs', hash: 'commit1' },
              { message: 'chore: cleanup', hash: 'commit2' },
              { message: 'style: formatting', hash: 'commit3' },
            ],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.commits).toHaveLength(0)
          expect(result.message).toContain('No releasable commits found')
        })

        it('returns appropriate message when releasable commits are found', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat: feature 1', hash: 'commit1' },
              { message: 'feat: feature 2', hash: 'commit2' },
              { message: 'docs: readme', hash: 'commit3' },
            ],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.message).toContain('Found 2 releasable commits')
          expect(result.message).toContain('3 total')
        })
      })

      describe('config handling', () => {
        it('uses default release types when not specified', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: feature', hash: 'commit1' }],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: { releaseTypes: undefined },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          // Should use default release types: ['feat', 'fix', 'perf', 'revert']
          expect(result.stateUpdates?.commits).toHaveLength(1)
        })

        it('respects custom release types', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat: feature', hash: 'commit1' },
              { message: 'custom: custom type', hash: 'commit2' },
            ],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: { releaseTypes: ['custom'] }, // Only 'custom' is a release type
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          // Only 'custom' type should be included
          expect(result.stateUpdates?.commits).toHaveLength(1)
          expect(result.stateUpdates?.commits?.[0].type).toBe('custom')
        })
      })
    })
  })
})
