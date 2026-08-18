import type { Logger } from '@hyperfrontend/logging'
import type { GitClient } from '../../git/factory'
import { createMockContext, createMockGitClient, createMockLogger } from './__test-utils__/analyze-commits-mocks'
import { createAnalyzeCommitsStep } from './analyze-commits'

describe('analyze-commits step', () => {
  describe('createAnalyzeCommitsStep', () => {
    describe('execute', () => {
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
          const commits = result.stateUpdates?.commits ?? []
          expect(commits.every((c) => !c.scope.includes('deps'))).toBe(true)
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

      describe('infrastructure path-based detection', () => {
        it('detects commits touching infrastructure paths', async () => {
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
          const customMatcher = jest.fn((ctx: { scope: readonly string[] }) => ctx.scope.includes('tooling'))
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
          const customMatcher = jest.fn((ctx: { scope: readonly string[] }) => ctx.scope.includes('custom'))
          const context = createMockContext({
            git,
            logger,
            state: { isFirstRelease: true },
            config: {
              scopeFiltering: {
                infrastructure: {
                  scopes: ['ci'],
                },
                infrastructureMatcher: customMatcher,
              },
            },
          })
          const step = createAnalyzeCommitsStep()

          await step.execute(context)

          expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Infrastructure matcher'))
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
          })
          const step = createAnalyzeCommitsStep()

          const result = await step.execute(context)

          expect(result.status).toBe('success')
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

          const debugCalls = (logger.debug as jest.Mock).mock.calls.map((call) => call[0])
          const depLogs = debugCalls.filter(
            (msg: string) => msg.includes('dependencies') || msg.includes('Dependency') || msg.includes('dependency')
          )
          expect(depLogs.length).toBeGreaterThan(0)
        })
      })
    })
  })
})
