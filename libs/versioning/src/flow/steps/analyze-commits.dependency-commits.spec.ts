import type { Mock } from '@hyperfrontend/testing'
import type { GitClient } from '../../git/factory'
import type { DependencyCommitRequest } from '../models/types'
import type { MockCommit } from './__test-utils__/analyze-commits-mocks'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createMockContext, createMockGitClient } from './__test-utils__/analyze-commits-mocks'
import { createAnalyzeCommitsStep } from './analyze-commits'

const COMMITS: readonly MockCommit[] = [
  { message: 'fix(lib-builder): a change in a dependency', hash: 'dependency1' },
  { message: 'feat(lib-test): a change of its own', hash: 'own1' },
]

/**
 * Creates a git client whose history holds the commits and whose path queries find none of them, so no commit touches the project's own files.
 *
 * @returns The git client
 */
function createGit(): GitClient {
  return {
    ...createMockGitClient({ commits: COMMITS }),
    getCommitsSince: (_since: string, options?: { path?: string }) => (options?.path === undefined ? COMMITS : []),
  } as unknown as GitClient
}

/**
 * Creates a resolver reporting that the dependency commit reaches the project through `lib-builder`.
 *
 * @returns The resolver, as a mock that records its calls
 */
function createResolver(): Mock<ReadonlyMap<string, ReadonlySet<string>>, [DependencyCommitRequest]> {
  return jest.fn<[DependencyCommitRequest], ReadonlyMap<string, ReadonlySet<string>>>(
    () => new Map([['lib-builder', new Set(['dependency1'])]])
  )
}

describe('analyze-commits step with a dependency commit resolver', () => {
  it('asks the resolver about the project from the published commit', async () => {
    const dependencyCommits = createResolver()
    const context = createMockContext({
      git: createGit(),
      state: { publishedCommit: 'base000', isFirstRelease: false },
      config: { scopeFiltering: { dependencyCommits } },
    })

    await createAnalyzeCommitsStep().execute(context)

    expect(dependencyCommits.mock.calls).toEqual([[{ projectName: 'lib-test', workspaceRoot: '/workspace', baseCommit: 'base000' }]])
  })

  it('asks the resolver with no base commit on a first release', async () => {
    const dependencyCommits = createResolver()
    const context = createMockContext({
      git: createGit(),
      state: { isFirstRelease: true },
      config: { scopeFiltering: { dependencyCommits } },
    })

    await createAnalyzeCommitsStep().execute(context)

    expect(dependencyCommits.mock.calls).toEqual([[expect.objectContaining({ baseCommit: null })]])
  })

  it('counts the commit the resolver names as an indirect dependency change', async () => {
    const context = createMockContext({
      git: createGit(),
      state: { publishedCommit: 'base000', isFirstRelease: false },
      config: { scopeFiltering: { dependencyCommits: createResolver() } },
    })

    const result = await createAnalyzeCommitsStep().execute(context)

    expect(result.stateUpdates?.classificationResult?.summary.bySource).toEqual(
      expect.objectContaining({ 'direct-scope': 1, 'indirect-dependency': 1 })
    )
  })

  it('records only the commits of the project itself as direct', async () => {
    const context = createMockContext({
      git: createGit(),
      state: { publishedCommit: 'base000', isFirstRelease: false },
      config: { scopeFiltering: { dependencyCommits: createResolver() } },
    })

    const result = await createAnalyzeCommitsStep().execute(context)

    expect({
      all: result.stateUpdates?.commits?.map((commit) => commit.subject),
      direct: result.stateUpdates?.directCommits?.map((commit) => commit.subject),
    }).toEqual({ all: ['a change in a dependency', 'a change of its own'], direct: ['a change of its own'] })
  })

  it('prefers the resolver to the built-in dependency lookup', async () => {
    const context = createMockContext({
      git: createGit(),
      state: { publishedCommit: 'base000', isFirstRelease: false },
      config: { scopeFiltering: { trackDependencyChanges: true, dependencyCommits: createResolver() } },
    })

    const result = await createAnalyzeCommitsStep().execute(context)

    expect(result.stateUpdates?.classificationResult?.summary.bySource['indirect-dependency']).toBe(1)
  })
})
