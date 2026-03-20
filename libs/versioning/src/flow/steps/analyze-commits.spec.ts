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
  commitReachable?: boolean
}

function createMockGitClient(options: MockGitClientOptions = {}): GitClient {
  const { commits = [], packageTags = [], projectTags = [], commitReachable = true } = options

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
    commitReachableFromHead: () => commitReachable,
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
      describe('publishedCommit scoping', () => {
        it('uses publishedCommit from state when commit is reachable', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat: new feature', hash: 'ghi789' },
              { message: 'fix: bug fix', hash: 'jkl012' },
            ],
            commitReachable: true,
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: {
              isFirstRelease: false,
              publishedCommit: 'abc1234',
              publishedVersion: '1.0.0',
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.effectiveBaseCommit).toBe('abc1234')
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Found 2 commits since abc1234'))
        })

        it('falls back gracefully when publishedCommit is not reachable from HEAD', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: new feature', hash: 'xyz789' }],
            commitReachable: false, // Commit not in history (rebase/force push)
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: {
              isFirstRelease: false,
              publishedCommit: 'orphaned123',
              publishedVersion: '1.0.0',
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          // effectiveBaseCommit should be null (fallback was used)
          expect(result.stateUpdates?.effectiveBaseCommit).toBe(null)
          // Warning should be logged
          expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Published commit orphane not found in history'))
          expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('rebase or force push'))
        })

        it('handles no publishedCommit (first release from registry perspective)', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: initial', hash: 'def456' }],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: {
              isFirstRelease: false,
              publishedCommit: null, // No gitHead in npm
              publishedVersion: '1.0.0',
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.effectiveBaseCommit).toBe(null)
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('First release'))
        })

        it('skips commit verification for first release', async () => {
          const git = createMockGitClient({
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
          expect(result.stateUpdates?.effectiveBaseCommit).toBe(null)
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('First release'))
        })
      })

      describe('commit analysis', () => {
        it('gets commits since publishedCommit', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat: feature 1', hash: 'commit1' },
              { message: 'fix: bug fix', hash: 'commit2' },
            ],
            commitReachable: true,
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: {
              isFirstRelease: false,
              publishedCommit: 'abc123',
            },
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

      describe('scope filtering strategies', () => {
        it('uses hybrid strategy by default', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: new feature', hash: 'commit1' }],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.message).toContain('strategy: hybrid')
        })

        it('respects scope-only strategy from config', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat(lib-test): scoped feature', hash: 'commit1' },
              { message: 'feat: unscoped feature', hash: 'commit2' },
            ],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'scope-only' },
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.message).toContain('strategy: scope-only')
          // Only scoped commits matching project should be included
          // In scope-only mode, unscoped commits are filtered out
          expect(result.stateUpdates?.commits).toHaveLength(1)
        })

        it('respects file-only strategy from config', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat(lib-test): scoped feature', hash: 'commit1' },
              { message: 'feat: unscoped feature', hash: 'commit2' },
            ],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'file-only' },
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.message).toContain('strategy: file-only')
        })

        it('infers scope-only strategy when >70% commits have scopes', async () => {
          // 8 out of 10 commits have scopes (80%)
          const commits = [
            { message: 'feat(scope1): feature 1', hash: 'c1' },
            { message: 'feat(scope2): feature 2', hash: 'c2' },
            { message: 'fix(scope3): fix 1', hash: 'c3' },
            { message: 'feat(scope4): feature 3', hash: 'c4' },
            { message: 'fix(scope5): fix 2', hash: 'c5' },
            { message: 'feat(scope6): feature 4', hash: 'c6' },
            { message: 'fix(scope7): fix 3', hash: 'c7' },
            { message: 'feat(scope8): feature 5', hash: 'c8' },
            { message: 'feat: unscoped 1', hash: 'c9' },
            { message: 'fix: unscoped 2', hash: 'c10' },
          ]
          const git = createMockGitClient({ commits })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'inferred' },
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.message).toContain('strategy: scope-only')
        })

        it('infers file-only strategy when <30% commits have scopes', async () => {
          // 2 out of 10 commits have scopes (20%)
          const commits = [
            { message: 'feat(scope1): feature 1', hash: 'c1' },
            { message: 'feat(scope2): feature 2', hash: 'c2' },
            { message: 'fix: fix 1', hash: 'c3' },
            { message: 'feat: feature 3', hash: 'c4' },
            { message: 'fix: fix 2', hash: 'c5' },
            { message: 'feat: feature 4', hash: 'c6' },
            { message: 'fix: fix 3', hash: 'c7' },
            { message: 'feat: feature 5', hash: 'c8' },
            { message: 'feat: unscoped 1', hash: 'c9' },
            { message: 'fix: unscoped 2', hash: 'c10' },
          ]
          const git = createMockGitClient({ commits })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'inferred' },
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.message).toContain('strategy: file-only')
        })

        it('infers hybrid strategy when scope ratio is between 30-70%', async () => {
          // 5 out of 10 commits have scopes (50%)
          const commits = [
            { message: 'feat(scope1): feature 1', hash: 'c1' },
            { message: 'feat(scope2): feature 2', hash: 'c2' },
            { message: 'fix(scope3): fix 1', hash: 'c3' },
            { message: 'feat(scope4): feature 3', hash: 'c4' },
            { message: 'fix(scope5): fix 2', hash: 'c5' },
            { message: 'feat: feature 4', hash: 'c6' },
            { message: 'fix: fix 3', hash: 'c7' },
            { message: 'feat: feature 5', hash: 'c8' },
            { message: 'feat: unscoped 1', hash: 'c9' },
            { message: 'fix: unscoped 2', hash: 'c10' },
          ]
          const git = createMockGitClient({ commits })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'inferred' },
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.message).toContain('strategy: hybrid')
        })

        it('infers file-only strategy when no commits exist (ratio is 0)', async () => {
          const git = createMockGitClient({ commits: [] })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'inferred' },
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          // With 0 commits, scope ratio is 0 which is < 0.3, so file-only is selected
          expect(result.message).toContain('strategy: file-only')
        })
      })

      describe('classification result', () => {
        it('includes classificationResult in state updates', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat(lib-test): scoped feature', hash: 'commit1' },
              { message: 'feat: unscoped feature', hash: 'commit2' },
            ],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.classificationResult).toBeDefined()
          expect(result.stateUpdates?.classificationResult?.summary).toBeDefined()
          expect(result.stateUpdates?.classificationResult?.summary.bySource).toBeDefined()
        })

        it('provides classification summary breakdown', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat(lib-test): scoped feature', hash: 'commit1' }],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should log classification breakdown
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Classification breakdown:'))
        })
      })

      describe('scope filtering config', () => {
        it('applies excludeScopes from config', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat(lib-test): included', hash: 'commit1' },
              { message: 'feat(deps): excluded dep update', hash: 'commit2' },
            ],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: {
                strategy: 'hybrid',
                excludeScopes: ['deps'],
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          // deps scope should be excluded
          const commits = result.stateUpdates?.commits ?? []
          expect(commits.every((c) => c.scope !== 'deps')).toBe(true)
        })

        it('applies includeScopes from config', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat(custom-scope): custom scoped', hash: 'commit1' },
              { message: 'feat(other): other scope', hash: 'commit2' },
            ],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: {
                strategy: 'scope-only',
                includeScopes: ['custom-scope'],
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          // custom-scope should be treated as project scope and included
          // The commit with custom-scope should be included in results
          expect(result.stateUpdates?.commits).toHaveLength(1)
        })

        it('logs project scopes derivation', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: feature', hash: 'commit1' }],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Project scopes:'))
        })
      })

      describe('file-based commit detection', () => {
        it('detects commits touching project files in hybrid mode', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat: unscoped feature', hash: 'commit1' },
              { message: 'fix: unscoped fix', hash: 'commit2' },
            ],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'hybrid' },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should log about file commits
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('commits touching'))
        })

        it('detects commits touching project files in file-only mode', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: unscoped feature', hash: 'commit1' }],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'file-only' },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('commits touching'))
        })

        it('skips file detection in scope-only mode', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat(lib-test): scoped feature', hash: 'commit1' }],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'scope-only' },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should NOT log about file commits in scope-only mode
          const debugCalls = (logger.debug as jest.Mock).mock.calls.map((call) => call[0])
          const fileCommitLogs = debugCalls.filter((msg: string) => msg.includes('commits touching'))
          expect(fileCommitLogs).toHaveLength(0)
        })
      })

      describe('summary message', () => {
        it('includes strategy in success message', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: feature', hash: 'commit1' }],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.message).toContain('strategy:')
        })

        it('includes strategy in no-commits message', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'docs: documentation', hash: 'commit1' }],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.message).toContain('No releasable commits')
          expect(result.message).toContain('strategy:')
        })

        it('shows total commit count in message', async () => {
          const git = createMockGitClient({
            commits: [
              { message: 'feat: feature 1', hash: 'c1' },
              { message: 'docs: docs update', hash: 'c2' },
              { message: 'chore: cleanup', hash: 'c3' },
            ],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.message).toContain('3 total')
        })
      })

      describe('infrastructure path-based detection', () => {
        it('detects commits touching infrastructure paths', async () => {
          // Create a git client that returns specific commits for infrastructure paths
          const baseCommits = [
            { message: 'feat(ci): update pipeline', hash: 'infra-commit1' },
            { message: 'feat(lib-test): regular feature', hash: 'commit2' },
          ]
          const git = {
            ...createMockGitClient({ commits: baseCommits }),
            getCommitLog: (opts?: { maxCount?: number; path?: string }) => {
              if (opts?.path === 'tools/') {
                return [{ message: 'feat(ci): update pipeline', hash: 'infra-commit1' }]
              }
              if (opts?.maxCount) {
                return baseCommits.slice(0, opts.maxCount)
              }
              return baseCommits
            },
            getCommitsSince: (tag: string, opts?: { path?: string }) => {
              if (opts?.path === 'tools/') {
                return [{ message: 'feat(ci): update pipeline', hash: 'infra-commit1' }]
              }
              return baseCommits
            },
          } as unknown as GitClient
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: {
                infrastructure: {
                  paths: ['tools/'],
                },
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should log about infrastructure paths
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('infrastructure paths'))
        })

        it('detects commits from multiple infrastructure paths', async () => {
          const baseCommits = [
            { message: 'feat(ci): update ci', hash: 'ci-commit' },
            { message: 'feat(scripts): add script', hash: 'scripts-commit' },
            { message: 'feat(lib-test): feature', hash: 'feature-commit' },
          ]
          const git = {
            ...createMockGitClient({ commits: baseCommits }),
            getCommitLog: (opts?: { maxCount?: number; path?: string }) => {
              if (opts?.path === '.github/') {
                return [{ message: 'feat(ci): update ci', hash: 'ci-commit' }]
              }
              if (opts?.path === 'scripts/') {
                return [{ message: 'feat(scripts): add script', hash: 'scripts-commit' }]
              }
              if (opts?.maxCount) {
                return baseCommits.slice(0, opts.maxCount)
              }
              return baseCommits
            },
          } as unknown as GitClient
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: {
                infrastructure: {
                  paths: ['.github/', 'scripts/'],
                },
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Logs should show detected commits from infrastructure paths
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('infrastructure paths'))
        })
      })

      describe('infrastructure scope-based detection', () => {
        it('detects commits matching infrastructure scopes', async () => {
          const commits = [
            { message: 'feat(ci): update pipeline', hash: 'ci-commit' },
            { message: 'feat(deps): update deps', hash: 'deps-commit' },
            { message: 'feat(lib-test): feature', hash: 'feature-commit' },
          ]
          const git = createMockGitClient({ commits })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: {
                infrastructure: {
                  scopes: ['ci', 'deps'],
                },
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should log about infrastructure matcher
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Infrastructure matcher'))
        })
      })

      describe('infrastructure custom matcher', () => {
        it('applies custom infrastructureMatcher function', async () => {
          const commits = [
            { message: 'feat(tooling): add tool', hash: 'tooling-commit' },
            { message: 'feat(lib-test): feature', hash: 'feature-commit' },
          ]
          const git = createMockGitClient({ commits })
          const logger = createMockLogger()
          const customMatcher = jest.fn((ctx: { scope?: string }) => ctx.scope === 'tooling')
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: {
                infrastructureMatcher: customMatcher,
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Custom matcher should have been called
          expect(customMatcher).toHaveBeenCalled()
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Infrastructure matcher'))
        })

        it('combines infrastructure config matcher with custom matcher using OR logic', async () => {
          const commits = [
            { message: 'feat(ci): update ci', hash: 'ci-commit' },
            { message: 'feat(custom): custom match', hash: 'custom-commit' },
            { message: 'feat(lib-test): feature', hash: 'feature-commit' },
          ]
          const git = createMockGitClient({ commits })
          const logger = createMockLogger()
          // Custom matcher matches 'custom' scope
          const customMatcher = jest.fn((ctx: { scope?: string }) => ctx.scope === 'custom')
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: {
                // Config matcher matches 'ci' scope
                infrastructure: {
                  scopes: ['ci'],
                },
                // Custom matcher matches 'custom' scope
                infrastructureMatcher: customMatcher,
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Both matchers should contribute to infrastructure detection
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Infrastructure matcher'))
        })
      })

      describe('toChangelogCommit transformation', () => {
        it('removes scope from direct-scope classified commits', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat(lib-test): scoped feature', hash: 'commit1' }],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'hybrid' },
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          // Scope should be removed from direct-scope commits
          const commits = result.stateUpdates?.commits ?? []
          expect(commits).toHaveLength(1)
          expect(commits[0].scope).toBeUndefined()
        })

        it('preserves scope for file-based commits with different scope', async () => {
          // Create git client that marks commit1 as touching project files
          const commits = [{ message: 'feat(other-project): cross-cutting change', hash: 'commit1' }]
          const git = {
            ...createMockGitClient({ commits }),
            getCommitLog: (opts?: { maxCount?: number; path?: string }) => {
              // When querying by path (project files), return the commit
              if (opts?.path) {
                return commits
              }
              if (opts?.maxCount) {
                return commits.slice(0, opts.maxCount)
              }
              return commits
            },
          } as unknown as GitClient
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'hybrid' },
            },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          // Scope should be preserved for file-based commits
          const resultCommits = result.stateUpdates?.commits ?? []
          expect(resultCommits).toHaveLength(1)
          expect(resultCommits[0].scope).toBe('other-project')
        })
      })

      describe('relative path calculation', () => {
        it('handles project path within workspace root', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: feature', hash: 'commit1' }],
          })
          const logger = createMockLogger()
          const context: FlowContext = {
            ...createMockContext({ git, logger, state: { isFirstRelease: true } }),
            workspaceRoot: '/workspace',
            projectRoot: '/workspace/libs/test',
          }
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should log the relative path correctly
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('libs/test'))
        })

        it('handles project path not starting with workspace root', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: feature', hash: 'commit1' }],
          })
          const logger = createMockLogger()
          // Edge case: projectRoot doesn't start with workspaceRoot
          const context: FlowContext = {
            ...createMockContext({ git, logger, state: { isFirstRelease: true } }),
            workspaceRoot: '/workspace',
            projectRoot: '/other/path/libs/test',
          }
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should fall back to using projectRoot as-is
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('/other/path/libs/test'))
        })
      })

      describe('first release path filtering', () => {
        it('uses getCommitLog with path filter for first release', async () => {
          const commits = [{ message: 'feat: feature', hash: 'commit1' }]
          const getCommitLogMock = jest.fn((opts?: { maxCount?: number; path?: string }) => {
            if (opts?.path) {
              return commits
            }
            if (opts?.maxCount) {
              return commits.slice(0, opts.maxCount)
            }
            return commits
          })
          const git = {
            ...createMockGitClient({ commits }),
            getCommitLog: getCommitLogMock,
          } as unknown as GitClient
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: { strategy: 'hybrid' },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should call getCommitLog with path filter
          const pathFilteredCalls = getCommitLogMock.mock.calls.filter((call) => call[0]?.path)
          expect(pathFilteredCalls.length).toBeGreaterThan(0)
        })
      })

      describe('commits since publishedCommit with path filtering', () => {
        it('uses getCommitsSince with path filter for existing releases', async () => {
          const commits = [{ message: 'feat: feature', hash: 'commit1' }]
          const getCommitsSinceMock = jest.fn(() => commits)
          const git = {
            ...createMockGitClient({
              commits,
              commitReachable: true,
            }),
            getCommitsSince: getCommitsSinceMock,
          } as unknown as GitClient
          const context = createMockContext({
            git,
            state: {
              isFirstRelease: false,
              publishedCommit: 'abc1234',
            },
            config: {
              scopeFiltering: { strategy: 'hybrid' },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should call getCommitsSince with path filter
          type CommitsSinceCall = [commit: string, opts?: { path?: string }]
          const calls = getCommitsSinceMock.mock.calls as unknown as CommitsSinceCall[]
          const pathFilteredCalls = calls.filter((call) => call[1]?.path)
          expect(pathFilteredCalls.length).toBeGreaterThan(0)
        })
      })

      describe('infrastructure returns undefined when not configured', () => {
        it('returns undefined for infrastructureCommitHashes when no infrastructure config', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: feature', hash: 'commit1' }],
          })
          const context = createMockContext({
            git,
            state: { isFirstRelease: true },
            // No infrastructure config at all
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          // Classification context should not have infrastructureCommitHashes set
          // This is indirectly tested by verifying no infrastructure-related logs
          const logger = context.logger as jest.Mocked<Logger>
          const debugCalls = logger.debug.mock.calls.map((call) => call[0])
          const infraLogs = debugCalls.filter((msg: string) => msg.includes('infrastructure') || msg.includes('Infrastructure'))
          expect(infraLogs).toHaveLength(0)
        })
      })

      describe('infrastructure path detection with existing release', () => {
        it('uses getCommitsSince for infrastructure paths when publishedCommit exists', async () => {
          const baseCommits = [
            { message: 'feat(ci): update ci', hash: 'ci-commit' },
            { message: 'feat(lib-test): feature', hash: 'feature-commit' },
          ]
          const getCommitsSinceMock = jest.fn((commit: string, opts?: { path?: string }) => {
            if (opts?.path === 'tools/') {
              return [{ message: 'feat(ci): update ci', hash: 'ci-commit' }]
            }
            return baseCommits
          })
          const git = {
            ...createMockGitClient({
              commits: baseCommits,
              commitReachable: true,
            }),
            getCommitsSince: getCommitsSinceMock,
          } as unknown as GitClient
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: {
              isFirstRelease: false,
              publishedCommit: 'abc1234',
            },
            config: {
              scopeFiltering: {
                infrastructure: {
                  paths: ['tools/'],
                },
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should call getCommitsSince with infrastructure path
          type CommitsSinceCall = [commit: string, opts?: { path?: string }]
          const calls = getCommitsSinceMock.mock.calls as unknown as CommitsSinceCall[]
          const infraPathCalls = calls.filter((call) => call[1]?.path === 'tools/')
          expect(infraPathCalls.length).toBeGreaterThan(0)
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('infrastructure paths'))
        })
      })

      describe('infrastructure path with no matching commits', () => {
        it('logs zero commits when infrastructure paths configured but no matches', async () => {
          const baseCommits = [{ message: 'feat(lib-test): feature', hash: 'feature-commit' }]
          const git = {
            ...createMockGitClient({ commits: baseCommits }),
            getCommitLog: (opts?: { maxCount?: number; path?: string }) => {
              // Infrastructure path returns no commits
              if (opts?.path === 'tools/') {
                return []
              }
              if (opts?.maxCount) {
                return baseCommits.slice(0, opts.maxCount)
              }
              return baseCommits
            },
          } as unknown as GitClient
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: {
                infrastructure: {
                  paths: ['tools/'],
                },
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should log 0 commits for infrastructure paths
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Found 0 commits touching infrastructure paths'))
        })
      })

      describe('dependency tracking (Phase 4)', () => {
        it('skips dependency map when trackDependencyChanges is false', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: feature', hash: 'commit1' }],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: {
                trackDependencyChanges: false,
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should NOT log about dependencies
          const debugCalls = (logger.debug as jest.Mock).mock.calls.map((call) => call[0])
          const depLogs = debugCalls.filter((msg: string) => msg.includes('dependencies') || msg.includes('Dependency'))
          expect(depLogs).toHaveLength(0)
        })

        it('attempts dependency map build when trackDependencyChanges is true', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: feature', hash: 'commit1' }],
          })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: {
                trackDependencyChanges: true,
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          // Should log about dependency discovery (may fail gracefully but will log)
          const debugCalls = (logger.debug as jest.Mock).mock.calls.map((call) => call[0])
          const depLogs = debugCalls.filter(
            (msg: string) => msg.includes('dependencies') || msg.includes('Dependency') || msg.includes('dependency')
          )
          // Either logs "No dependencies found" or "Failed to build dependency map" or found deps
          expect(depLogs.length).toBeGreaterThan(0)
        })
      })
    })
  })
})
