import type { Logger } from '@hyperfrontend/logging'
import type { ConventionalCommit } from '../../commits/models/conventional'
import type { GitClient } from '../../git/factory'
import type { Registry } from '../../registry/models/registry'
import type { FlowContext, FlowState } from '../models/types'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { createMock, describe, expect, it } from '@hyperfrontend/testing'
import { createConventionalCommit } from '../../commits/models/conventional'
import { createCalculateBumpStep } from './calculate-bump'

const FIX = createConventionalCommit('fix', 'a fix')
const FEATURE = createConventionalCommit('feat', 'a feature')
const BREAKING = createConventionalCommit('feat', 'a breaking change', { breaking: true })

/**
 * Creates a flow context at version 1.2.3, published, with the given analysed commits.
 *
 * @param commits - Every analysed commit
 * @param directCommits - The ones attributed to the project itself, or undefined when the analysis recorded none
 * @returns A context whose state holds those commits and a published version equal to the local one
 */
function createContext(commits: readonly ConventionalCommit[], directCommits: readonly ConventionalCommit[] | undefined): FlowContext {
  const state: FlowState = { commits, directCommits, currentVersion: '1.2.3', publishedVersion: '1.2.3', isFirstRelease: false }
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
    state,
  }
}

describe('calculate-bump step with indirect commits', () => {
  it('raises the project by a patch for a feature that reaches it only indirectly', async () => {
    const result = await createCalculateBumpStep().execute(createContext([FEATURE], []))

    expect(result.stateUpdates).toEqual(expect.objectContaining({ bumpType: 'patch', nextVersion: '1.2.4' }))
  })

  it('raises the project by a patch for a breaking change that reaches it only indirectly', async () => {
    const result = await createCalculateBumpStep().execute(createContext([BREAKING], []))

    expect(result.stateUpdates).toEqual(expect.objectContaining({ bumpType: 'patch', nextVersion: '1.2.4' }))
  })

  it('keeps a patch when the project has a fix of its own beside an indirect feature', async () => {
    const result = await createCalculateBumpStep().execute(createContext([FIX, FEATURE], [FIX]))

    expect(result.stateUpdates).toEqual(expect.objectContaining({ bumpType: 'patch', nextVersion: '1.2.4' }))
  })

  it('takes the level of a feature of its own beside an indirect fix', async () => {
    const result = await createCalculateBumpStep().execute(createContext([FEATURE, FIX], [FEATURE]))

    expect(result.stateUpdates).toEqual(expect.objectContaining({ bumpType: 'minor', nextVersion: '1.3.0' }))
  })

  it('reads every commit as direct when the analysis recorded no direct set', async () => {
    const result = await createCalculateBumpStep().execute(createContext([FEATURE], undefined))

    expect(result.stateUpdates).toEqual(expect.objectContaining({ bumpType: 'minor', nextVersion: '1.3.0' }))
  })
})
