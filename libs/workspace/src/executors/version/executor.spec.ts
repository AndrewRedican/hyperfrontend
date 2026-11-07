import type { Mock } from '@hyperfrontend/testing'
import type { ExecutorContext } from '../../runner/contract'
import type { VersionExecutorOptions } from './options'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { captureStdio } from '@hyperfrontend/testing/process'
import { workspaceGraph } from '../../graph'
import { versionExecutor } from './executor'
import { withShippedChanges } from './lib/graph-change-sources'
import { runVersion } from './lib/run-version-for-project'
jest.mock('../../graph', () => ({ workspaceGraph: jest.fn() }))
jest.mock('./lib/graph-change-sources', () => ({ withShippedChanges: jest.fn() }))
jest.mock('./lib/run-version-for-project', () => ({ runVersion: jest.fn() }))

const mockRun = runVersion as Mock
const mockGraph = workspaceGraph as Mock
const mockShipped = withShippedChanges as Mock

/** The graph of the workspace, as far as these cases pass it along. */
const GRAPH = { projects: new Map() }

/** The scope filtering the graph resolves a task's own into. */
const TRACKED = { strategy: 'hybrid', tracked: true }

beforeEach(() => {
  mockRun.mockReset().mockResolvedValue({ success: true })
  mockGraph.mockReset().mockReturnValue(GRAPH)
  mockShipped.mockReset().mockReturnValue(TRACKED)
})

/**
 * The context of a version task of the library at `libs/core`.
 *
 * @param overrides - Fields that differ from the plain task
 * @returns The task's context, rooted at `/workspace`
 */
function context(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    root: '/workspace',
    cwd: '/workspace',
    projectName: 'lib-core',
    targetName: 'version',
    target: {},
    projects: { 'lib-core': { root: 'libs/core' } },
    configuration: {},
    ...overrides,
  }
}

/** What a run printed, by stream, and what it answered. */
interface RunOutput {
  /** What the executor answered. */
  readonly result: Awaited<ReturnType<typeof versionExecutor>>
  /** What it wrote to stdout. */
  readonly stdout: string
  /** What it wrote to stderr. */
  readonly stderr: string
}

/**
 * Runs the executor with its output captured.
 *
 * @param options - What the task sets
 * @param taskContext - Where it runs
 * @returns What it answered and printed
 */
async function run(options: VersionExecutorOptions = {}, taskContext: ExecutorContext = context()): Promise<RunOutput> {
  const stdio = captureStdio()
  try {
    const result = await versionExecutor(options, taskContext)
    return { result, stdout: stdio.stdout(), stderr: stdio.stderr() }
  } finally {
    stdio.restore()
  }
}

describe('versionExecutor', () => {
  it.each([[undefined], ['']])('fails a task with no project name (%s) without running a version', async (projectName) => {
    const { result, stderr } = await run({}, context({ projectName: projectName as string }))
    expect({ result, stderr, runs: mockRun.mock.calls.length }).toEqual({
      result: { success: false },
      stderr: expect.stringContaining('Project name is required'),
      runs: 0,
    })
  })

  it('fails a task on a project the workspace does not have', async () => {
    const { result, stderr } = await run({}, context({ projectName: 'lib-missing' }))
    expect({ result, stderr, runs: mockRun.mock.calls.length }).toEqual({
      result: { success: false },
      stderr: expect.stringContaining('Project not found in the workspace'),
      runs: 0,
    })
  })

  it('runs the version of the project from its root, handing every option through', async () => {
    const followUps = [jest.fn()]
    const options: VersionExecutorOptions = {
      skipCommit: true,
      skipTag: false,
      dryRun: true,
      verbose: false,
      quiet: true,
      releaseAs: 'minor',
      tagPrefix: 'lib-core@',
      maxCommitFallback: 50,
      followUps,
    }
    const taskContext = context()
    await run(options, taskContext)
    expect(mockRun.mock.calls).toEqual([
      [
        {
          projectName: 'lib-core',
          workspaceRoot: '/workspace',
          projectRoot: 'libs/core',
          projects: taskContext.projects,
          skipCommit: true,
          skipTag: false,
          dryRun: true,
          verbose: false,
          quiet: true,
          releaseAs: 'minor',
          tagPrefix: 'lib-core@',
          scopeFiltering: TRACKED,
          maxCommitFallback: 50,
          followUps,
        },
      ],
    ])
  })

  it('leaves tagging off unless the task asks for it', async () => {
    await run()
    expect(mockRun.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ skipTag: true }))
  })

  it('resolves the scope filtering of the task against the graph of its workspace', async () => {
    const scopeFiltering = { strategy: 'hybrid', excludeScopes: ['ci'] } as VersionExecutorOptions['scopeFiltering']
    await run({ scopeFiltering })
    expect({ graphs: mockGraph.mock.calls, resolved: mockShipped.mock.calls }).toEqual({
      graphs: [['/workspace']],
      resolved: [[scopeFiltering, GRAPH, '/workspace']],
    })
  })

  it.each([
    ['succeeds', true],
    ['fails', false],
  ])('%s when the version run does', async (_verdict, success) => {
    mockRun.mockResolvedValue({ success, bumped: false, error: 'not part of the answer' })
    expect((await run()).result).toEqual({ success })
  })

  it('stays silent at the default level', async () => {
    const { stdout, stderr } = await run()
    expect({ stdout, stderr }).toEqual({ stdout: '', stderr: '' })
  })

  it('reports its start and end at the level a verbose task sets', async () => {
    const { stdout } = await run({ verbose: true })
    expect(stdout).toEqual(expect.stringMatching(/Executor started with log level: debug[\s\S]*Executor completed successfully/))
  })
})
