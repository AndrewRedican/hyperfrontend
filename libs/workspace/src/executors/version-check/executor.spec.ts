import type { Mock } from '@hyperfrontend/testing'
import type { ExecutorContext } from '../../runner/contract'
import type { VersionValidationResult } from '../version/lib/validate-version-state'
import type { VersionCheckExecutorOptions } from './options'
import { execFileSync } from 'node:child_process'
import { beforeEach } from 'node:test'
import { logger } from '@hyperfrontend/logging'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { captureStdio } from '@hyperfrontend/testing/process'
import { getCommit } from '@hyperfrontend/versioning/git/operations'
import { workspaceGraph } from '../../graph'
import { withShippedChanges } from '../version/lib/graph-change-sources'
import { validateVersionState } from '../version/lib/validate-version-state'
import { versionCheckExecutor } from './executor'
jest.mock('@hyperfrontend/versioning/git/operations', () => {
  const actual = jest.requireActual<typeof import('@hyperfrontend/versioning/git/operations')>('@hyperfrontend/versioning/git/operations')
  return { ...actual, getCommit: jest.fn(actual.getCommit) }
})
jest.mock('../../graph', () => ({ workspaceGraph: jest.fn() }))
jest.mock('../version/lib/graph-change-sources', () => ({ withShippedChanges: jest.fn() }))
jest.mock('../version/lib/validate-version-state', () => ({
  ...jest.requireActual<typeof import('../version/lib/validate-version-state')>('../version/lib/validate-version-state'),
  validateVersionState: jest.fn(),
}))

const mockValidate = validateVersionState as Mock
const mockGetCommit = getCommit as Mock
const mockGraph = workspaceGraph as Mock
const mockShipped = withShippedChanges as Mock

/** The graph of the workspace, as far as these cases pass it along. */
const GRAPH = { projects: new Map() }

/** The scope filtering the graph resolves a task's own into. */
const TRACKED = { strategy: 'hybrid', tracked: true }

/** A verdict with nothing wrong. */
const VALID: VersionValidationResult = {
  status: 'valid',
  library: 'lib-core',
  expected: { version: '1.1.0', bumpType: 'minor', commitCount: 1 },
  discrepancies: [],
}

/** A verdict with a manifest behind its commits. */
const INVALID: VersionValidationResult = {
  status: 'invalid',
  library: 'lib-core',
  expected: { version: '1.1.0', bumpType: 'minor', commitCount: 1 },
  actual: { version: '1.0.0', hasVersionEntry: true },
  discrepancies: [
    { file: 'package.json', type: 'version-mismatch', expected: '1.1.0', actual: '1.0.0', remedy: 'Run: npx hf run lib-core:version' },
  ],
}

const repository = useTempDir({ prefix: 'version-check-' })

beforeEach(() => {
  mockValidate.mockReset().mockResolvedValue(VALID)
  mockGraph.mockReset().mockReturnValue(GRAPH)
  mockShipped.mockReset().mockReturnValue(TRACKED)
})

/**
 * Runs git in the temporary repository, as a fixed identity.
 *
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
function git(...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', '-c', 'commit.gpgsign=false', ...args], {
    cwd: repository.path,
    encoding: 'utf8',
  }).trim()
}

/**
 * Starts a repository on `main`, in the temporary directory.
 */
function init(): void {
  git('init', '-q', '-b', 'main')
}

/**
 * Commits nothing, under a subject.
 *
 * @param subject - What the commit says of itself
 */
function commit(subject: string): void {
  git('commit', '-q', '--allow-empty', '-m', subject)
}

/**
 * Makes a repository whose head merges a branch: the branch ends in a commit under the given
 * subject, and the merge commit's own subject is not a version commit.
 *
 * @param subject - The subject of the commit merged in
 */
function mergedRepository(subject: string): void {
  init()
  commit('feat: start')
  git('checkout', '-q', '-b', 'side')
  commit(subject)
  git('checkout', '-q', 'main')
  commit('fix: move on')
  git('merge', '-q', '--no-ff', '--no-edit', 'side')
}

/**
 * The context of a version-check task of the library at `libs/core`, in the temporary repository.
 *
 * @param overrides - Fields that differ from the plain task
 * @returns The task's context
 */
function context(overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    root: repository.path,
    cwd: repository.path,
    projectName: 'lib-core',
    targetName: 'version-check',
    target: {},
    projects: { 'lib-core': { root: 'libs/core' } },
    configuration: {},
    ...overrides,
  }
}

/** What a run printed, by stream, and what it answered. */
interface RunOutput {
  /** What the executor answered. */
  readonly result: Awaited<ReturnType<typeof versionCheckExecutor>>
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
async function run(options: VersionCheckExecutorOptions = {}, taskContext: ExecutorContext = context()): Promise<RunOutput> {
  const stdio = captureStdio()
  try {
    const result = await versionCheckExecutor(options, taskContext)
    return { result, stdout: stdio.stdout(), stderr: stdio.stderr() }
  } finally {
    stdio.restore()
  }
}

describe('versionCheckExecutor guards', () => {
  it.each([[undefined], ['']])('fails a task with no project name (%s) without validating', async (projectName) => {
    const { result, stderr } = await run({}, context({ projectName: projectName as string }))
    expect({ result, stderr, validations: mockValidate.mock.calls.length }).toEqual({
      result: { success: false },
      stderr: expect.stringContaining('Project name is required'),
      validations: 0,
    })
  })

  it('fails a task on a project the workspace does not have', async () => {
    init()
    const { result, stderr } = await run({}, context({ projectName: 'lib-missing' }))
    expect({ result, stderr, validations: mockValidate.mock.calls.length }).toEqual({
      result: { success: false },
      stderr: expect.stringContaining('Project not found in the workspace'),
      validations: 0,
    })
  })

  it.each([
    ['a manual release of the project', 'chore(lib-core): release version 1.1.0'],
    ['a batch naming the project first', 'chore: update versions for lib-core, lib-utils'],
    ['a batch naming the project last', 'chore: update versions for lib-utils, lib-core'],
    ['a batch naming something that is no package', 'chore: update versions for NOT~A~PACKAGE, lib-core'],
  ])('passes without validating on %s', async (_commit, subject) => {
    init()
    commit(subject)
    const { result } = await run()
    expect({ result, validations: mockValidate.mock.calls.length }).toEqual({ result: { success: true }, validations: 0 })
  })

  it.each([
    ['a change', 'feat(lib-core): add a thing'],
    ['a chore that releases nothing', 'chore(lib-core): tidy up'],
    ['the manual release of another project', 'chore(lib-other): release version 1.1.0'],
    ['a batch without the project', 'chore: update versions for lib-other, lib-utils'],
    ['an unscoped chore', 'chore: tidy up'],
    ['a chore with no space after its colon', 'chore:update versions for lib-core'],
  ])('validates on %s', async (_commit, subject) => {
    init()
    commit(subject)
    await run()
    expect(mockValidate.mock.calls.length).toBe(1)
  })

  it.each([
    ['an error', new Error('git went away'), 'git went away'],
    ['anything else', 'gave up', 'gave up'],
  ])('validates when reading the head commit throws %s, saying what went wrong', async (_thrown, thrown, message) => {
    init()
    commit('chore(lib-core): release version 1.1.0')
    mockGetCommit.mockImplementationOnce(() => {
      throw thrown
    })
    const { stderr } = await run()
    expect({ stderr, validations: mockValidate.mock.calls.length }).toEqual({
      stderr: expect.stringContaining(`error while checking version commit - ${message}`),
      validations: 1,
    })
  })

  it('validates a repository with no commit yet', async () => {
    init()
    await run()
    expect(mockValidate.mock.calls.length).toBe(1)
  })

  it('passes without validating on a merge that brings in a version commit', async () => {
    mergedRepository('chore(lib-core): release version 1.1.0')
    await run()
    expect(mockValidate.mock.calls.length).toBe(0)
  })

  it('validates a merge that brings in no version commit', async () => {
    mergedRepository('feat(lib-core): add a thing')
    await run()
    expect(mockValidate.mock.calls.length).toBe(1)
  })

  it('validates a version commit when the task turns the stand-down off', async () => {
    init()
    commit('chore(lib-core): release version 1.1.0')
    await run({ skipIfVersionCommit: false })
    expect(mockValidate.mock.calls.length).toBe(1)
  })

  it('passes without validating while a merge is in progress', async () => {
    init()
    commit('feat: start')
    repository.write('.git/MERGE_HEAD', `${git('rev-parse', 'HEAD')}\n`)
    const { result } = await run()
    expect({ result, validations: mockValidate.mock.calls.length }).toEqual({ result: { success: true }, validations: 0 })
  })
})

describe('versionCheckExecutor validation', () => {
  it('validates the project from its root, with the options of the task', async () => {
    init()
    commit('feat: start')
    const scopeFiltering = { strategy: 'hybrid', excludeScopes: ['ci'] } as VersionCheckExecutorOptions['scopeFiltering']
    await run({ verbose: true, scopeFiltering, maxCommitFallback: 30, repository: 'inferred' })
    expect({ validations: mockValidate.mock.calls, resolved: mockShipped.mock.calls, graphs: mockGraph.mock.calls }).toEqual({
      validations: [
        [
          {
            workspaceRoot: repository.path,
            projectName: 'lib-core',
            projectRoot: 'libs/core',
            verbose: true,
            scopeFiltering: TRACKED,
            maxCommitFallback: 30,
            repository: 'inferred',
          },
        ],
      ],
      resolved: [[scopeFiltering, GRAPH, repository.path]],
      graphs: [[repository.path]],
    })
  })

  it('passes a valid project, printing the verdict', async () => {
    init()
    commit('feat: start')
    const { result, stdout } = await run()
    expect({ result, stdout }).toEqual({
      result: { success: true },
      stdout: expect.stringContaining('lib-core: version 1.1.0 matches expected'),
    })
  })

  it('passes a skipped project, printing why', async () => {
    init()
    commit('feat: start')
    mockValidate.mockResolvedValue({ status: 'skipped', library: 'lib-core', skipReason: 'no bump is due', discrepancies: [] })
    const { result, stdout } = await run()
    expect({ result, stdout }).toEqual({ result: { success: true }, stdout: expect.stringContaining('lib-core: no bump is due') })
  })

  it('fails on a validation error, printing it as one', async () => {
    init()
    commit('feat: start')
    mockValidate.mockResolvedValue({ status: 'error', library: 'lib-core', errorMessage: 'the flow broke', discrepancies: [] })
    const { result, stderr } = await run()
    expect({ result, stderr }).toEqual({ result: { success: false }, stderr: expect.stringContaining('lib-core: the flow broke') })
  })

  it('fails an invalid project, warning with the discrepancies', async () => {
    init()
    commit('feat: start')
    mockValidate.mockResolvedValue(INVALID)
    const { result, stderr } = await run()
    expect({ result, stderr }).toEqual({
      result: { success: false },
      stderr: expect.stringContaining('package.json: version-mismatch'),
    })
  })

  it('tells the developer of an invalid project the steps that fix it', async () => {
    init()
    commit('feat: start')
    mockValidate.mockResolvedValue(INVALID)
    expect((await run()).stdout).toEqual(
      expect.stringMatching(
        /To fix this issue:[\s\S]*git pull origin <branch>[\s\S]*npx hf run lib-core:version[\s\S]*Push the version commit/
      )
    )
  })

  it('prints the verdict at the level of the task, whatever level the flow left the logger at', async () => {
    init()
    commit('feat: start')
    mockValidate.mockImplementation(async () => {
      logger.setLogLevel('error')
      return VALID
    })
    expect((await run()).stdout).toContain('matches expected')
  })

  it('keeps the verdict of a passing project from a quiet task', async () => {
    init()
    commit('feat: start')
    expect((await run({ quiet: true })).stdout).toBe('')
  })
})
