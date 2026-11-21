import type { Logger } from '@hyperfrontend/logging'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowContext } from '../models/types'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { createMock, describe, expect, it } from '@hyperfrontend/testing'
import { createConventionalCommit } from '../../commits/models/conventional'
import { createCalculateBumpStep } from './calculate-bump'

const SECURITY = createConventionalCommit('security', 'bump a vulnerable dependency')
const BREAKING_SECURITY = createConventionalCommit('security', 'drop a vulnerable option', { breaking: true })

/**
 * Creates a flow context for a published project whose configuration names no patch types, so the step falls back to its own.
 *
 * @param commits - The analysed commits, all the project's own
 * @param version - The version both local and published
 * @returns A context whose state holds those commits at that version
 */
function createContext(commits: readonly ConventionalCommit[], version: string): FlowContext {
  return {
    workspaceRoot: '/workspace',
    projectName: 'lib-test',
    projectRoot: '/workspace/libs/test',
    packageName: '@test/pkg',
    tree: createMemoryTree(),
    registry: createMock<Registry>(),
    git: createMock<GitClient>(),
    logger: createMock<Logger>(),
    config: { preset: 'conventional' },
    state: { commits, directCommits: commits, currentVersion: version, publishedVersion: version, isFirstRelease: false },
  }
}

describe('calculate-bump step with a security commit', () => {
  it('raises the project by a patch under the default patch types', async () => {
    const result = await createCalculateBumpStep().execute(createContext([SECURITY], '1.2.3'))

    expect(result.stateUpdates).toEqual(expect.objectContaining({ bumpType: 'patch', nextVersion: '1.2.4' }))
  })

  it('raises a stable project by a major when the commit is breaking', async () => {
    const result = await createCalculateBumpStep().execute(createContext([BREAKING_SECURITY], '1.2.3'))

    expect(result.stateUpdates).toEqual(expect.objectContaining({ bumpType: 'major', nextVersion: '2.0.0' }))
  })

  it('raises a project below 1.0.0 by a minor when the commit is breaking', async () => {
    const result = await createCalculateBumpStep().execute(createContext([BREAKING_SECURITY], '0.4.2'))

    expect(result.stateUpdates).toEqual(expect.objectContaining({ bumpType: 'minor', nextVersion: '0.5.0' }))
  })
})
