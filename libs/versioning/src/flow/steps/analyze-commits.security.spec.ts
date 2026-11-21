import type { GitClient } from '../../git/factory'
import type { MockCommit } from './__test-utils__/analyze-commits-mocks'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createMockContext, createMockGitClient } from './__test-utils__/analyze-commits-mocks'
import { createAnalyzeCommitsStep } from './analyze-commits'

const COMMITS: readonly MockCommit[] = [
  { message: 'security(lib-x): bump a vulnerable dependency', hash: 'security1' },
  { message: 'docs(lib-test): describe the option', hash: 'docs1' },
  { message: 'security(lib-test)!: drop a vulnerable option', hash: 'security2' },
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

describe('analyze-commits step with security commits', () => {
  it('keeps the security commit of the project as releasable under the default release types', async () => {
    const context = createMockContext({
      git: createGit(),
      state: { publishedCommit: 'base000', isFirstRelease: false },
      config: { releaseTypes: undefined },
    })

    const result = await createAnalyzeCommitsStep().execute(context)

    expect(result.stateUpdates?.commits).toEqual([
      expect.objectContaining({ type: 'security', subject: 'drop a vulnerable option', breaking: true }),
    ])
  })

  it('counts a security commit the resolver names as an indirect dependency change', async () => {
    const context = createMockContext({
      git: createGit(),
      state: { publishedCommit: 'base000', isFirstRelease: false },
      config: { releaseTypes: undefined, scopeFiltering: { dependencyCommits: () => new Map([['lib-x', new Set(['security1'])]]) } },
    })

    const result = await createAnalyzeCommitsStep().execute(context)

    expect({
      all: result.stateUpdates?.commits?.map((commit) => commit.subject),
      direct: result.stateUpdates?.directCommits?.map((commit) => commit.subject),
    }).toEqual({ all: ['bump a vulnerable dependency', 'drop a vulnerable option'], direct: ['drop a vulnerable option'] })
  })
})
