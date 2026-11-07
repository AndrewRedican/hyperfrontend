import type { Mock } from '@hyperfrontend/testing'
import type { TempDir } from '@hyperfrontend/testing/fs'
import type { ExecutorContext } from '../../runner/contract'
import type { RunVersionOptions, RunVersionResult } from '../version/lib/run-version-for-project'
import type { VersionBatchExecutorOptions } from './options'
import { execFileSync } from 'node:child_process'
import { posix } from 'node:path'
import { after as afterAll, beforeEach } from 'node:test'
import { logger } from '@hyperfrontend/logging'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { captureStdio } from '@hyperfrontend/testing/process'
import { workspaceGraph } from '../../graph'
import { withShippedChanges } from '../version/lib/graph-change-sources'
import { runVersion } from '../version/lib/run-version-for-project'
import { versionBatchExecutor } from './executor'
import { getAffectedLibraries } from './lib/get-affected-libraries'
jest.mock('../../graph', () => ({
  ...jest.requireActual<typeof import('../../graph')>('../../graph'),
  workspaceGraph: jest.fn(),
}))
jest.mock('../version/lib/graph-change-sources', () => ({ withShippedChanges: jest.fn(), selectReleaseBuilds: jest.fn() }))
jest.mock('../version/lib/run-version-for-project', () => ({ runVersion: jest.fn() }))
jest.mock('./lib/get-affected-libraries', () => ({
  ...jest.requireActual<typeof import('./lib/get-affected-libraries')>('./lib/get-affected-libraries'),
  getAffectedLibraries: jest.fn(),
}))

const mockRun = runVersion as Mock
const mockGraph = workspaceGraph as Mock
const mockShipped = withShippedChanges as Mock
const mockAffected = getAffectedLibraries as Mock

/** The scope filtering the graph resolves a batch's own into. */
const TRACKED = { strategy: 'hybrid', tracked: true }

/** Two versionable libraries, and an application that declares no version target. */
const GRAPH = {
  projects: new Map([
    ['lib-a', { name: 'lib-a', root: 'libs/a', configuration: { targets: { version: {} } } }],
    ['lib-b', { name: 'lib-b', root: 'libs/b', configuration: { targets: { version: {} } } }],
    ['docs-site', { name: 'docs-site', root: 'apps/docs', configuration: { targets: {} } }],
  ]),
}

const repositories: TempDir[] = []
afterAll(() => repositories.forEach((directory) => directory.remove()))

beforeEach(() => {
  mockRun.mockReset()
  mockGraph.mockReset().mockReturnValue(GRAPH)
  mockShipped.mockReset().mockReturnValue(TRACKED)
  mockAffected.mockReset().mockResolvedValue(['lib-a', 'lib-b'])
})

/**
 * Runs git in a repository.
 *
 * @param directory - The repository
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
function git(directory: TempDir, ...args: string[]): string {
  return execFileSync('git', args, { cwd: directory.path, encoding: 'utf8' }).trim()
}

/**
 * A repository on `feature` with two libraries committed, whose identity is its own.
 *
 * @returns Its directory, holding one commit
 */
function repository(): TempDir {
  const directory = createTempDir({
    prefix: 'version-batch-',
    tree: { 'libs/a/package.json': '{ "version": "1.0.0" }\n', 'libs/b/package.json': '{ "version": "2.0.0" }\n', 'notes.md': 'mine\n' },
  })
  repositories.push(directory)
  git(directory, 'init', '-q', '-b', 'feature')
  git(directory, 'config', 'user.name', 'fixture')
  git(directory, 'config', 'user.email', 'fixture@localhost')
  git(directory, 'config', 'commit.gpgsign', 'false')
  git(directory, 'add', '-A')
  git(directory, 'commit', '-q', '-m', 'base')
  return directory
}

/**
 * What a version run does to a library that is due a bump: it rewrites the manifest and says so.
 *
 * @param directory - The repository the run edits
 * @returns The stand-in for `runVersion`
 */
function bumps(directory: TempDir): (options: RunVersionOptions) => Promise<RunVersionResult> {
  return async ({ projectRoot }) => {
    const manifest = posix.join(projectRoot, 'package.json')
    directory.write(manifest, '{ "version": "9.9.9" }\n')
    return { success: true, bumped: true, previousVersion: '1.0.0', newVersion: '9.9.9', modifiedFiles: [manifest] }
  }
}

/**
 * What a version run answers when no bump is due.
 *
 * @returns A clean answer, modifying no file
 */
function unchanged(): RunVersionResult {
  return { success: true, bumped: false, previousVersion: '1.0.0', newVersion: null, modifiedFiles: [] }
}

/**
 * The context of a batch task in a repository.
 *
 * @param directory - The repository
 * @param overrides - Fields that differ from the plain task
 * @returns The task's context
 */
function context(directory: TempDir, overrides: Partial<ExecutorContext> = {}): ExecutorContext {
  return {
    root: directory.path,
    cwd: directory.path,
    projectName: 'workspace',
    targetName: 'version-batch',
    target: {},
    projects: {},
    configuration: {},
    ...overrides,
  }
}

/** What a batch printed, by stream, and what it answered. */
interface BatchOutput {
  /** What the executor answered. */
  readonly result: Awaited<ReturnType<typeof versionBatchExecutor>>
  /** What it wrote to stdout. */
  readonly stdout: string
  /** What it wrote to stderr. */
  readonly stderr: string
}

/**
 * Runs the batch in a repository with its output captured.
 *
 * @param directory - The repository
 * @param options - What the task sets
 * @param overrides - Fields of the context that differ from the plain task
 * @returns What it answered and printed
 */
async function batch(
  directory: TempDir,
  options: VersionBatchExecutorOptions = {},
  overrides: Partial<ExecutorContext> = {}
): Promise<BatchOutput> {
  const stdio = captureStdio()
  try {
    const result = await versionBatchExecutor(options, context(directory, overrides))
    return { result, stdout: stdio.stdout(), stderr: stdio.stderr() }
  } finally {
    stdio.restore()
  }
}

/**
 * The lines of captured output that say something.
 *
 * @param output - What a stream received
 * @returns Its lines, without the blank ones
 */
function linesOf(output: string): string[] {
  return output.split(/\r?\n/).filter((line) => line !== '')
}

describe('versionBatchExecutor before it writes', () => {
  it('stands down on the branch behind a remote-tracking base', async () => {
    const directory = repository()
    git(directory, 'remote', 'add', 'origin', 'https://example.com/repo.git')
    git(directory, 'branch', '-m', 'main')
    const { result, stdout } = await batch(directory)
    expect({ result, stdout, detections: mockAffected.mock.calls.length }).toEqual({
      result: { success: true },
      stdout: expect.stringContaining('On the base branch main, skipping version-batch'),
      detections: 0,
    })
  })

  it('stands down on a branch the base names directly', async () => {
    const directory = repository()
    const { result } = await batch(directory, { base: 'refs/heads/feature' })
    expect({ result, detections: mockAffected.mock.calls.length }).toEqual({ result: { success: true }, detections: 0 })
  })

  it('carries on from a detached head, whatever its branch was', async () => {
    const directory = repository()
    git(directory, 'checkout', '-q', '--detach')
    mockRun.mockResolvedValue(unchanged())
    const { stdout } = await batch(directory, { verbose: true })
    expect(stdout).toContain('Current branch: unknown')
  })

  it('names the branch and the revisions it compares when verbose', async () => {
    const directory = repository()
    mockRun.mockResolvedValue(unchanged())
    const { stdout } = await batch(directory, { verbose: true, base: 'develop', head: 'HEAD~1' })
    expect(stdout).toEqual(expect.stringMatching(/Current branch: feature[\s\S]*Base: develop, Head: HEAD~1/))
  })

  it('aborts while a merge is in progress', async () => {
    const directory = repository()
    directory.write('.git/MERGE_HEAD', `${git(directory, 'rev-parse', 'HEAD')}\n`)
    const { result, stderr } = await batch(directory)
    expect({ result, stderr, detections: mockAffected.mock.calls.length }).toEqual({
      result: { success: false },
      stderr: expect.stringContaining('Git is in an unstable state'),
      detections: 0,
    })
  })

  it('detects the change from origin/main to HEAD by default', async () => {
    const directory = repository()
    mockAffected.mockResolvedValue([])
    await batch(directory)
    expect(mockAffected.mock.calls).toEqual([[directory.path, GRAPH, 'origin/main', 'HEAD']])
  })

  it('detects the change between the revisions the task names', async () => {
    const directory = repository()
    mockAffected.mockResolvedValue([])
    await batch(directory, { base: 'develop', head: 'release' })
    expect(mockAffected.mock.calls).toEqual([[directory.path, GRAPH, 'develop', 'release']])
  })

  it('passes without a version run when nothing is affected', async () => {
    const directory = repository()
    mockAffected.mockResolvedValue([])
    const { result, stdout } = await batch(directory)
    expect({ result, stdout, runs: mockRun.mock.calls.length }).toEqual({
      result: { success: true },
      stdout: expect.stringContaining('No affected libraries with version target found'),
      runs: 0,
    })
  })

  it('refuses libraries named without a forced bump', async () => {
    const directory = repository()
    const { result, stderr } = await batch(directory, { libraries: ['lib-a'] })
    expect({ result, stderr }).toEqual({ result: { success: false }, stderr: expect.stringContaining('only meaningful with --releaseAs') })
  })

  it('refuses a forced bump on a project that declares no version target', async () => {
    const directory = repository()
    const { result, stderr } = await batch(directory, { releaseAs: 'patch', libraries: ['docs-site', 'lib-missing'] })
    expect({ result, stderr }).toEqual({
      result: { success: false },
      stderr: expect.stringContaining('Not versionable: docs-site, lib-missing'),
    })
  })

  it('consults no affected detection for a forced bump', async () => {
    const directory = repository()
    await batch(directory, { releaseAs: 'patch', libraries: ['lib-a'], dryRun: true })
    expect(mockAffected.mock.calls.length).toBe(0)
  })

  it('lists what a dry run would version, and versions nothing', async () => {
    const directory = repository()
    const { result, stdout } = await batch(directory, { dryRun: true })
    expect({ result, stdout, runs: mockRun.mock.calls.length, status: git(directory, 'status', '--porcelain') }).toEqual({
      result: { success: true },
      stdout: expect.stringMatching(
        /Found 2 affected libraries: lib-a, lib-b[\s\S]*\[dry-run\] Would version the following libraries:[\s\S]*- lib-a[\s\S]*- lib-b/
      ),
      runs: 0,
      status: '',
    })
  })

  it('says which bump a forced dry run would make', async () => {
    const directory = repository()
    const { stdout } = await batch(directory, { dryRun: true, releaseAs: 'minor', libraries: ['lib-b', 'lib-a'] })
    expect(stdout).toEqual(
      expect.stringMatching(
        /Forcing a minor bump on 2 libraries: lib-a, lib-b[\s\S]*\[dry-run\] Would version the following libraries with a forced minor bump:/
      )
    )
  })

  it.each([
    ['an error', new Error('graph broke'), 'version-batch failed: graph broke'],
    ['anything else', 'gave up', 'version-batch failed: gave up'],
  ])('fails when reading the workspace throws %s', async (_thrown, thrown, message) => {
    const directory = repository()
    mockGraph.mockImplementation(() => {
      throw thrown
    })
    const { result, stderr } = await batch(directory)
    expect({ result, stderr }).toEqual({ result: { success: false }, stderr: expect.stringContaining(message) })
  })
})

/** Where a batch finds its attribution, with the options and configuration of the case and what it should settle on. */
type AttributionCase = [string, VersionBatchExecutorOptions, ExecutorContext['configuration'], Record<string, unknown>]

/** Every way a batch's attribution is declared. */
const ATTRIBUTIONS: AttributionCase[] = [
  ['nothing without a declaration', {}, {}, { scopeFiltering: undefined, maxCommitFallback: undefined }],
  ['nothing from a version target with no options', {}, { targetDefaults: { version: {} } }, { maxCommitFallback: undefined }],
  [
    'the version target declaration',
    {},
    { targetDefaults: { version: { options: { scopeFiltering: { strategy: 'scope' }, maxCommitFallback: 10 } } } },
    { scopeFiltering: { strategy: 'scope' }, maxCommitFallback: 10 },
  ],
  [
    'its own options over the version target',
    { scopeFiltering: { strategy: 'hybrid' }, maxCommitFallback: 20 } as VersionBatchExecutorOptions,
    { targetDefaults: { version: { options: { scopeFiltering: { strategy: 'scope' }, maxCommitFallback: 10 } } } },
    { scopeFiltering: { strategy: 'hybrid' }, maxCommitFallback: 20 },
  ],
]

describe('versionBatchExecutor attribution', () => {
  it.each(ATTRIBUTIONS)('attributes commits with %s', async (_source, options, configuration, expected) => {
    const directory = repository()
    mockAffected.mockResolvedValue(['lib-a'])
    mockRun.mockResolvedValue(unchanged())
    await batch(directory, options, { configuration })
    expect({
      scopeFiltering: mockShipped.mock.calls[0]?.[0],
      maxCommitFallback: (mockRun.mock.calls[0]?.[0] as RunVersionOptions).maxCommitFallback,
    }).toEqual({ scopeFiltering: undefined, maxCommitFallback: undefined, ...expected })
  })
})

describe('versionBatchExecutor runs', () => {
  it('versions each library in place, uncommitted and quiet, under one reading of the graph', async () => {
    const directory = repository()
    const followUps = [jest.fn()]
    const projects = { 'lib-a': { root: 'libs/a' } }
    mockAffected.mockResolvedValue(['lib-a'])
    mockRun.mockResolvedValue(unchanged())
    await batch(directory, { followUps, maxCommitFallback: 5 }, { projects })
    expect(mockRun.mock.calls).toEqual([
      [
        {
          projectName: 'lib-a',
          workspaceRoot: directory.path,
          projectRoot: 'libs/a',
          projects,
          skipCommit: true,
          skipTag: true,
          dryRun: false,
          verbose: false,
          quiet: true,
          scopeFiltering: TRACKED,
          maxCommitFallback: 5,
          releaseAs: undefined,
          followUps,
        },
      ],
    ])
  })

  it('leaves a verbose batch loud, and hands a forced bump to every library', async () => {
    const directory = repository()
    mockRun.mockResolvedValue(unchanged())
    await batch(directory, { verbose: true, releaseAs: 'major', libraries: ['lib-a'] })
    expect(mockRun.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ verbose: true, quiet: false, releaseAs: 'major' }))
  })

  it('records every bump in one commit naming every library', async () => {
    const directory = repository()
    mockRun.mockImplementation(bumps(directory))
    await batch(directory)
    expect({
      subjects: git(directory, 'log', '--format=%s', '-2').split(/\r?\n/),
      files: git(directory, 'show', '--name-only', '--format=', 'HEAD').split(/\r?\n/),
    }).toEqual({
      subjects: ['chore: update versions for lib-a, lib-b', 'base'],
      files: ['libs/a/package.json', 'libs/b/package.json'],
    })
  })

  it('leaves the uncommitted edits of the developer out of the commit, and in the tree', async () => {
    const directory = repository()
    directory.write('notes.md', 'mine, edited\n')
    mockRun.mockImplementation(bumps(directory))
    await batch(directory)
    expect({ status: git(directory, 'status', '--porcelain'), notes: directory.read('notes.md') }).toEqual({
      status: 'M notes.md',
      notes: 'mine, edited\n',
    })
  })

  it('reports each bump and the commit that records them', async () => {
    const directory = repository()
    mockRun.mockImplementation(bumps(directory))
    const { result, stdout } = await batch(directory)
    expect({ result, lines: linesOf(stdout.slice(stdout.indexOf('Found'))) }).toEqual({
      result: { success: true },
      lines: [
        'Found 2 affected libraries: lib-a, lib-b',
        '  ✓ lib-a: 1.0.0 → 9.9.9',
        '  ✓ lib-b: 1.0.0 → 9.9.9',
        'Creating batch commit for 2 libraries...',
        `Created commit: ${git(directory, 'rev-parse', 'HEAD').slice(0, 8)}`,
        'Bumped: lib-a, lib-b',
      ],
    })
  })

  it('makes no commit when no library is due a bump', async () => {
    const directory = repository()
    const head = git(directory, 'rev-parse', 'HEAD')
    mockRun.mockResolvedValue(unchanged())
    const { result, stdout } = await batch(directory)
    expect({ result, stdout, head: git(directory, 'rev-parse', 'HEAD') }).toEqual({
      result: { success: true },
      stdout: expect.stringContaining('No version bumps needed'),
      head,
    })
  })

  it('says of a library with no bump due that it needed none, when verbose', async () => {
    const directory = repository()
    mockRun.mockResolvedValue(unchanged())
    expect((await batch(directory, { verbose: true })).stdout).toContain('- lib-a: no version bump needed')
  })

  it('skips a library the graph no longer has, and versions the rest', async () => {
    const directory = repository()
    mockAffected.mockResolvedValue(['lib-gone', 'lib-a'])
    mockRun.mockImplementation(bumps(directory))
    const { result, stderr } = await batch(directory)
    expect({ result, stderr, subject: git(directory, 'log', '-1', '--format=%s') }).toEqual({
      result: { success: true },
      stderr: expect.stringContaining('Project lib-gone not found in graph, skipping'),
      subject: 'chore: update versions for lib-a',
    })
  })

  it('reports its lines at its own level, whatever level a version run left the logger at', async () => {
    const directory = repository()
    const bump = bumps(directory)
    mockAffected.mockResolvedValue(['lib-a'])
    mockRun.mockImplementation((options: RunVersionOptions) => {
      logger.setLogLevel('error')
      return bump(options)
    })
    expect((await batch(directory)).stdout).toContain('✓ lib-a: 1.0.0 → 9.9.9')
  })
})

describe('versionBatchExecutor failures', () => {
  it.each([
    ['its error', { error: 'registry down' }, '  ✗ lib-a: registry down'],
    ['a stand-in when it gives none', {}, '  ✗ lib-a: unknown error'],
  ])('fails a library whose run failed, with %s', async (_message, failure, line) => {
    const directory = repository()
    mockAffected.mockResolvedValue(['lib-a'])
    mockRun.mockResolvedValue({ success: false, bumped: false, previousVersion: null, newVersion: null, modifiedFiles: [], ...failure })
    const { result, stderr } = await batch(directory)
    expect({ result, lines: linesOf(stderr) }).toEqual({
      result: { success: false },
      lines: [
        line,
        '1 of 1 library failed to version: lib-a. Anything that did version is left in place; resolve the failures and run again.',
      ],
    })
  })

  it.each([
    ['an error', new Error('run broke'), '✗ lib-a: run broke'],
    ['anything else', 'gave up', '✗ lib-a: gave up'],
  ])('fails a library whose run threw %s, and carries on', async (_thrown, thrown, line) => {
    const directory = repository()
    mockRun.mockRejectedValueOnce(thrown).mockResolvedValueOnce(unchanged())
    const { result, stderr } = await batch(directory)
    expect({ result, stderr, runs: mockRun.mock.calls.length }).toEqual({
      result: { success: false },
      stderr: expect.stringContaining(line),
      runs: 2,
    })
  })

  it('counts several failed libraries in the plural', async () => {
    const directory = repository()
    mockRun.mockResolvedValue({ ...unchanged(), success: false })
    expect((await batch(directory)).stderr).toContain('2 of 2 libraries failed to version: lib-a, lib-b')
  })

  it('commits what did version, and still fails the batch', async () => {
    const directory = repository()
    const bump = bumps(directory)
    mockRun.mockImplementationOnce(bump).mockResolvedValueOnce({ ...unchanged(), success: false, error: 'registry down' })
    const { result, stderr } = await batch(directory)
    expect({ result, stderr, subject: git(directory, 'log', '-1', '--format=%s') }).toEqual({
      result: { success: false },
      stderr: expect.stringContaining('Anything that did version is left in place'),
      subject: 'chore: update versions for lib-a',
    })
  })

  it('puts the tree back as the developer had it when the commit cannot be made', async () => {
    const directory = repository()
    directory.write('libs/a/package.json', '{ "version": "1.0.0", "edit": "mine" }\n')
    const head = git(directory, 'rev-parse', 'HEAD')
    mockAffected.mockResolvedValue(['lib-a'])
    mockRun.mockImplementation(async (options: RunVersionOptions) => ({
      ...(await bumps(directory)(options)),
      modifiedFiles: ['libs/a/package.json', 'libs/a/does-not-exist.json'],
    }))
    const { result, stdout, stderr } = await batch(directory)
    expect({
      result,
      stdout,
      stderr,
      manifest: directory.read('libs/a/package.json'),
      head: git(directory, 'rev-parse', 'HEAD'),
    }).toEqual({
      result: { success: false },
      stdout: expect.stringContaining('Failed, putting the working tree back as it stood...'),
      stderr: expect.stringContaining('version-batch failed: Failed to stage files for commit'),
      manifest: '{ "version": "1.0.0", "edit": "mine" }\n',
      head,
    })
  })
})
