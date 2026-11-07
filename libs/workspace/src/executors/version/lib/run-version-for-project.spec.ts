import type { Mock } from '@hyperfrontend/testing'
import type { FlowResult } from '@hyperfrontend/versioning/flow/models'
import type { FollowUp } from './run-version-for-project'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { executeFlow } from '@hyperfrontend/versioning/flow/executor'
import { amendCommitNoEdit, stage } from '@hyperfrontend/versioning/git/operations'
import { isInUnstableGitState } from './is-in-unstable-git-state'
import { isVersionCommit } from './is-version-commit'
import { runVersion } from './run-version-for-project'
import { updateDependentVersions } from './update-dependent-versions'
import { updateE2eDependencies } from './update-e2e-dependencies'
jest.mock('@hyperfrontend/versioning/flow', () => ({ createVersionFlow: jest.fn(() => ({ config: {} })) }))
jest.mock('@hyperfrontend/versioning/flow/executor', () => ({ executeFlow: jest.fn() }))
jest.mock('@hyperfrontend/versioning/git/operations', () => ({ stage: jest.fn(), amendCommitNoEdit: jest.fn() }))
jest.mock('./is-in-unstable-git-state', () => ({ isInUnstableGitState: jest.fn(() => false) }))
jest.mock('./is-version-commit', () => ({ isVersionCommit: jest.fn(() => false) }))
jest.mock('./update-dependent-versions', () => ({ updateDependentVersions: jest.fn(() => []) }))
jest.mock('./update-e2e-dependencies', () => ({ updateE2eDependencies: jest.fn(() => []) }))

const mockFlow = executeFlow as Mock
const mockStage = stage as Mock
const mockAmend = amendCommitNoEdit as Mock
const mockUnstable = isInUnstableGitState as Mock
const mockVersionCommit = isVersionCommit as Mock
const mockDependents = updateDependentVersions as Mock
const mockE2e = updateE2eDependencies as Mock

const workspace = useTempDir({ tree: { 'libs/core/package.json': JSON.stringify({ name: '@scope/core', version: '1.0.0' }) } })

/** The projects of the workspace: the versioned one, a library, and the e2e project that tests it. */
const PROJECTS = {
  core: { name: 'core', root: 'libs/core' },
  consumer: { name: 'consumer', root: 'libs/consumer' },
  'e2e-core': { name: 'e2e-core', root: 'e2e/core', implicitDependencies: ['core'] },
}

/**
 * A flow result.
 *
 * @param status - The outcome
 * @param state - The state the flow ended in
 * @returns A result with that outcome and state, no steps and a summary naming the outcome
 */
function flowResult(status: FlowResult['status'], state: FlowResult['state'] = {}): FlowResult {
  return { status, steps: [], state, duration: 1, summary: `${status}` }
}

/**
 * Runs the version flow on the core library of the workspace, quietly.
 *
 * @param overrides - Options beyond the workspace's own
 * @returns What the run reported
 */
function run(overrides: Partial<Parameters<typeof runVersion>[0]> = {}): ReturnType<typeof runVersion> {
  return runVersion({
    projectName: 'core',
    workspaceRoot: workspace.path,
    projectRoot: 'libs/core',
    projects: PROJECTS,
    quiet: true,
    ...overrides,
  })
}

beforeEach(() => {
  mockFlow.mockReset()
  mockStage.mockReset()
  mockAmend.mockReset()
  mockDependents.mockReset().mockReturnValue([])
  mockE2e.mockReset().mockReturnValue([])
  mockUnstable.mockReset().mockReturnValue(false)
  mockVersionCommit.mockReset().mockReturnValue(false)
})

describe('runVersion', () => {
  it('stands down on a version commit for the project', async () => {
    mockVersionCommit.mockReturnValue(true)
    const result = await run()
    expect({ result, flowRuns: mockFlow.mock.calls.length }).toEqual({
      result: { success: true, bumped: false, previousVersion: null, newVersion: null, modifiedFiles: [] },
      flowRuns: 0,
    })
  })

  it('stands down while git is mid-rebase or mid-merge', async () => {
    mockUnstable.mockReturnValue(true)
    const result = await run()
    expect({ result, flowRuns: mockFlow.mock.calls.length }).toEqual({
      result: expect.objectContaining({ success: true, bumped: false }),
      flowRuns: 0,
    })
  })

  it('reports no bump when the flow finds no releasable commit', async () => {
    mockFlow.mockResolvedValue(flowResult('success', { currentVersion: '1.0.0' }))
    expect(await run()).toEqual(expect.objectContaining({ success: true, bumped: false, previousVersion: '1.0.0', newVersion: null }))
  })

  it('reports no bump when the flow skipped', async () => {
    mockFlow.mockResolvedValue(flowResult('skipped', { currentVersion: '1.0.0' }))
    expect(await run()).toEqual(expect.objectContaining({ success: true, bumped: false, previousVersion: '1.0.0' }))
  })

  it('reports no previous version when the flow skipped before reading one', async () => {
    mockFlow.mockResolvedValue(flowResult('skipped'))
    expect(await run()).toEqual(expect.objectContaining({ success: true, bumped: false, previousVersion: null }))
  })

  it('reports no bump, and no previous version, when the flow found no releasable commit and read no version', async () => {
    mockFlow.mockResolvedValue(flowResult('success'))
    expect(await run()).toEqual(expect.objectContaining({ success: true, bumped: false, previousVersion: null, newVersion: null }))
  })

  it('fails when the flow failed, with the flow summary', async () => {
    mockFlow.mockResolvedValue(flowResult('failed'))
    expect(await run()).toEqual(expect.objectContaining({ success: false, bumped: false, error: 'failed' }))
  })

  it('hands the flow the project root, the tag format and the commit window', async () => {
    mockFlow.mockResolvedValue(flowResult('skipped'))
    await run({ maxCommitFallback: 42, tagPrefix: 'v', releaseAs: 'minor', verbose: true, quiet: undefined, skipTag: false })
    expect(mockFlow).toHaveBeenCalledWith(
      expect.anything(),
      'core',
      workspace.path,
      expect.objectContaining({ projectRoot: 'libs/core', dryRun: false })
    )
  })

  it('reports the files the flow changed, workspace-relative, and the pins its dependents took', async () => {
    mockFlow.mockResolvedValue(
      flowResult('success', {
        currentVersion: '1.0.0',
        nextVersion: '1.1.0',
        modifiedFiles: [join(workspace.path, 'libs', 'core', 'package.json'), 'elsewhere/CHANGELOG.md'],
      })
    )
    mockDependents.mockReturnValue(['libs/consumer/package.json'])
    mockE2e.mockReturnValue(['e2e/core/package.json'])
    expect(await run()).toEqual(
      expect.objectContaining({
        success: true,
        bumped: true,
        previousVersion: '1.0.0',
        newVersion: '1.1.0',
        modifiedFiles: ['libs/core/package.json', 'elsewhere/CHANGELOG.md', 'libs/consumer/package.json', 'e2e/core/package.json'],
      })
    )
  })

  it('pins the dependents of the package, and repins only the projects that depend on it implicitly', async () => {
    mockFlow.mockResolvedValue(flowResult('success', { nextVersion: '1.1.0' }))
    await run()
    expect({ dependents: mockDependents.mock.calls[0], e2e: mockE2e.mock.calls[0] }).toEqual({
      dependents: ['@scope/core', '1.1.0', workspace.path, PROJECTS, 'core', false],
      e2e: ['@scope/core', '1.1.0', workspace.path, [PROJECTS['e2e-core']], false],
    })
  })

  it('falls back to the manifest and the changelog when the flow does not say what it changed', async () => {
    mockFlow.mockResolvedValue(flowResult('success', { nextVersion: '1.1.0' }))
    workspace.write('libs/core/CHANGELOG.md', '# Changelog\n')
    expect((await run()).modifiedFiles).toEqual(['libs/core/package.json', 'libs/core/CHANGELOG.md'])
  })

  it('falls back to the manifest alone when the project has no changelog', async () => {
    mockFlow.mockResolvedValue(flowResult('success', { nextVersion: '1.1.0' }))
    expect((await run()).modifiedFiles).toEqual(['libs/core/package.json'])
  })

  it('calls each follow-up with the bump after the dependents are pinned, and commits what they changed with the bump', async () => {
    mockFlow.mockResolvedValue(flowResult('success', { currentVersion: '1.0.0', nextVersion: '1.1.0', modifiedFiles: [] }))
    const calls: unknown[] = []
    const first: FollowUp = (bump, flowRun) => {
      calls.push([bump, flowRun])
      return ['DOCUMENT.md']
    }
    const second: FollowUp = () => []
    const result = await run({ followUps: [first, second] })
    expect({
      calls,
      modifiedFiles: result.modifiedFiles,
      staged: mockStage.mock.calls[0]?.[0],
      amended: mockAmend.mock.calls.length,
    }).toEqual({
      calls: [
        [
          { projectName: 'core', projectRoot: 'libs/core', packageName: '@scope/core', previousVersion: '1.0.0', newVersion: '1.1.0' },
          { workspaceRoot: workspace.path, dryRun: false },
        ],
      ],
      modifiedFiles: ['DOCUMENT.md'],
      staged: ['DOCUMENT.md'],
      amended: 1,
    })
  })

  it('leaves the commit alone when the run skips committing, and on a dry run', async () => {
    mockFlow.mockResolvedValue(flowResult('success', { nextVersion: '1.1.0', modifiedFiles: [] }))
    mockDependents.mockReturnValue(['libs/consumer/package.json'])
    await run({ skipCommit: true })
    await run({ dryRun: true })
    expect({ staged: mockStage.mock.calls.length, amended: mockAmend.mock.calls.length }).toEqual({ staged: 0, amended: 0 })
  })

  it('warns and goes on when the commit cannot be amended', async () => {
    mockFlow.mockResolvedValue(flowResult('success', { nextVersion: '1.1.0', modifiedFiles: [] }))
    mockDependents.mockReturnValue(['libs/consumer/package.json'])
    mockStage.mockImplementation(() => {
      throw new Error('no git')
    })
    expect(await run()).toEqual(expect.objectContaining({ success: true, bumped: true, modifiedFiles: ['libs/consumer/package.json'] }))
  })

  it('pins nothing when the project carries no manifest', async () => {
    mockFlow.mockResolvedValue(flowResult('success', { nextVersion: '1.1.0', modifiedFiles: [] }))
    await run({ projectName: 'consumer', projectRoot: 'libs/consumer' })
    expect(mockDependents).not.toHaveBeenCalled()
  })
})
