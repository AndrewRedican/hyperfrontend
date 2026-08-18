import type { GitClient } from '../../git/factory'
import type { FlowContext } from '../models/types'
import { createMockContext, createMockGitClient, createMockLogger } from './__test-utils__/analyze-commits-mocks'
import { createAnalyzeCommitsStep, ANALYZE_COMMITS_STEP_ID } from './analyze-commits'

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
            commitReachable: false,
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
          expect(result.stateUpdates?.effectiveBaseCommit).toBe(null)
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
              publishedCommit: null,
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

        it('gets all commits for first release (limited by default maxCommitFallback of 500)', async () => {
          const commits = Array.from({ length: 600 }, (_, i) => ({
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
          expect(result.stateUpdates?.commits?.length).toBeLessThanOrEqual(500)
          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('First release'))
        })

        it('respects custom maxCommitFallback config', async () => {
          const commits = Array.from({ length: 200 }, (_, i) => ({
            message: `feat: feature ${i}`,
            hash: `commit${i}`,
          }))
          const git = createMockGitClient({ commits })
          const logger = createMockLogger()
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: { maxCommitFallback: 50 },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.commits?.length).toBeLessThanOrEqual(50)
        })

        it('parses conventional commits and filters by release types', async () => {
          const git = createMockGitClient({
            packageTags: [{ name: '@test/pkg@1.0.0', hash: 'abc123' }],
            commits: [
              { message: 'feat: new feature', hash: 'commit1' },
              { message: 'fix: bug fix', hash: 'commit2' },
              { message: 'docs: update readme', hash: 'commit3' },
              { message: 'chore: cleanup', hash: 'commit4' },
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
            config: { releaseTypes: ['custom'] },
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
          expect(result.stateUpdates?.commits).toHaveLength(1)
          expect(result.stateUpdates?.commits?.[0].type).toBe('custom')
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
          const commits = result.stateUpdates?.commits ?? []
          expect(commits).toHaveLength(1)
          expect(commits[0].scope).toEqual([])
        })

        it('preserves scope for file-based commits with different scope', async () => {
          const commits = [{ message: 'feat(other-project): cross-cutting change', hash: 'commit1' }]
          const git = {
            ...createMockGitClient({ commits }),
            getCommitLog: (opts?: { maxCount?: number; path?: string }) => {
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
          const resultCommits = result.stateUpdates?.commits ?? []
          expect(resultCommits).toHaveLength(1)
          expect(resultCommits[0].scope).toEqual(['other-project'])
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

          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('libs/test'))
        })

        it('handles project path not starting with workspace root', async () => {
          const git = createMockGitClient({
            commits: [{ message: 'feat: feature', hash: 'commit1' }],
          })
          const logger = createMockLogger()
          const context: FlowContext = {
            ...createMockContext({ git, logger, state: { isFirstRelease: true } }),
            workspaceRoot: '/workspace',
            projectRoot: '/other/path/libs/test',
          }
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

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

          type CommitsSinceCall = [commit: string, opts?: { path?: string }]
          const calls = getCommitsSinceMock.mock.calls as unknown as CommitsSinceCall[]
          const pathFilteredCalls = calls.filter((call) => call[1]?.path)
          expect(pathFilteredCalls.length).toBeGreaterThan(0)
        })
      })
    })
  })
})
