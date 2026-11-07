import type { ChildProcess } from 'node:child_process'
import type { Mock } from '@hyperfrontend/testing'
import type { TempDir } from '@hyperfrontend/testing/fs'
import type { FakeChildProcess } from '@hyperfrontend/testing/process'
import type { HandoverHost } from './handover'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { promiseReject, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { queueMicrotask } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createCapturedOutput, createFakeChildProcess } from '@hyperfrontend/testing/process'
import { selectAffected } from '../graph/affected/select'
import { installAliases } from '../hooks/index'
import { createRunnerWorkspace } from '../runner/__test-utils__/workspace'
import { searchPath } from '../runner/environment'
import { FILES_PER_RUN, FORMAT_USAGE } from '../runner/format'
import { GENERATE_USAGE } from '../runner/generate'
import { AFFECTED_USAGE, MANY_USAGE } from '../runner/many'
import { USAGE as RUN_USAGE } from '../runner/run'
import { SHOW_USAGE } from '../runner/show'
import { GRAPH_USAGE } from './graph'
import { processHost } from './handover'
import { isOwnCommand, runWorkspaceCli, USAGE } from './run'

jest.mock('node:child_process', () => ({
  ...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
  spawn: jest.fn(),
}))
jest.mock('../hooks/index', () => ({ installAliases: jest.fn() }))
jest.mock('../graph/affected/select', () => {
  const actual = jest.requireActual<typeof import('../graph/affected/select')>('../graph/affected/select')
  return { ...actual, selectAffected: jest.fn(actual.selectAffected) }
})
jest.mock('./handover', () => ({ ...jest.requireActual<typeof import('./handover')>('./handover'), processHost: jest.fn() }))

const mockSpawn = spawn as unknown as Mock
const mockInstall = installAliases as Mock
const mockSelect = selectAffected as Mock
const mockProcessHost = processHost as Mock

/** The directory these cases start in, restored after each changes it. */
const START = process.cwd()

/** The search path these cases start with, restored after each changes it. */
const SEARCH_PATH = process.env['PATH']

/** What a workspace of these cases adds to the runner fixture: ignores, a prettier, a generator and a failing executor. */
const TREE = {
  '.gitignore': '.hf\nnode_modules\n',
  'node_modules/prettier/package.json': { name: 'prettier', version: '0.0.0' },
  'node_modules/prettier/bin/prettier.cjs': '',
  'libs/alpha/src/index.ts': 'export const alpha = 1\n',
  'tools/tooling/package.json': { name: '@fixture/tooling', private: true, executors: './executors.json', generators: './generators.json' },
  'tools/tooling/generators.json': { generators: { note: { factory: './src/note.mjs', schema: './src/note.json' } } },
  'tools/tooling/src/note.mjs': 'export default (tree, options) => tree.write(`notes/${options.name}.txt`, options.name)\n',
  'tools/tooling/src/note.json': { properties: { name: { type: 'string', $default: { $source: 'argv', index: 0 } } }, required: ['name'] },
  'tools/tooling/src/check/executor.ts': 'export default (): Promise<{ success: boolean }> => Promise.resolve({ success: false })\n',
}

/** A host where the features package is not installed. */
const ALONE: HandoverHost = { resolve: () => null, load: () => promiseReject(createError('nothing to load')) }

/** What a run answered and wrote. */
interface Run {
  /** The exit code. */
  readonly code: number
  /** What it wrote to standard output. */
  readonly stdout: string
  /** What it wrote to standard error. */
  readonly stderr: string
}

/** How a case differs from a run at the workspace root with no features package. */
interface RunOptions {
  /** Where the run starts; the workspace root unless named. */
  readonly cwd?: string
  /** How the features command line is found. */
  readonly host?: HandoverHost
  /** Whether the run was passed on by the other command line. */
  readonly handedOver?: boolean
}

let workspace: TempDir

/**
 * Runs the command line, keeping what it wrote.
 *
 * @param argv - The arguments after the executable's name
 * @param options - How the run differs from the default
 * @returns The exit code and both streams' text
 */
async function hf(argv: readonly string[], options: RunOptions = {}): Promise<Run> {
  const stdout = createCapturedOutput()
  const stderr = createCapturedOutput()
  const { host = ALONE, cwd = workspace.path, handedOver } = options
  const code = await runWorkspaceCli({ argv, cwd, stdout, stderr, ...(handedOver === undefined ? {} : { handedOver }) }, host)
  return { code, stdout: stdout.text(), stderr: stderr.text() }
}

/**
 * Runs git in the workspace.
 *
 * @param args - The arguments after `git`
 */
function git(args: readonly string[]): void {
  execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', ...args], { cwd: workspace.path, stdio: 'ignore' })
}

/**
 * Makes every child started exit with a code, once the caller has listened.
 *
 * @param codes - The exit codes in the order the children start; a child past the last exits with 0
 */
function childrenExit(...codes: readonly number[]): void {
  const queue = [...codes]
  mockSpawn.mockImplementation(() => {
    const child = createFakeChildProcess()
    const code = queue.shift() ?? 0
    queueMicrotask(() => child.exit(code))
    return child as unknown as ChildProcess
  })
}

/**
 * Makes the next child started end the way a callback ends it.
 *
 * @param end - Ends the child, once the caller has listened
 */
function childEnds(end: (child: FakeChildProcess) => void): void {
  mockSpawn.mockImplementationOnce(() => {
    const child = createFakeChildProcess()
    queueMicrotask(() => end(child))
    return child as unknown as ChildProcess
  })
}

/**
 * The files of each prettier run started.
 *
 * @returns The arguments after the `--` of each run
 */
function formatted(): string[][] {
  return mockSpawn.mock.calls.map(([, args]) => {
    const list = args as readonly string[]
    return list.slice(list.indexOf('--') + 1)
  })
}

beforeEach(() => {
  mockInstall.mockReset()
  mockSpawn.mockReset()
  childrenExit()
  workspace = createRunnerWorkspace(TREE)
  git(['add', '-A'])
  git(['commit', '-q', '-m', 'base'])
})

afterEach(() => {
  process.chdir(START)
  process.env['PATH'] = SEARCH_PATH
  workspace.remove()
})

describe('isOwnCommand', () => {
  it.each(['run', 'run-many', 'affected', 'format', 'generate', 'show', 'graph'])('owns %s', (word) => {
    expect(isOwnCommand(word)).toBe(true)
  })

  it.each(['pack', 'toString', ''])('does not own %j', (word) => {
    expect(isOwnCommand(word)).toBe(false)
  })
})

describe('runWorkspaceCli usage', () => {
  it('prints the usage and exits with 1 when no command is given', async () => {
    expect(await hf([])).toEqual({ code: 1, stdout: USAGE, stderr: '' })
  })

  it.each(['--help', '-h'])('prints the usage and exits cleanly for %s', async (word) => {
    expect(await hf([word])).toEqual({ code: 0, stdout: USAGE, stderr: '' })
  })

  it('follows the usage with the usage of the features command line, where that is installed', async () => {
    const asked: (readonly string[])[] = []
    const beside: HandoverHost = {
      resolve: () => '/features.cjs',
      load: () =>
        promiseResolve({
          runFeaturesCli: (invocation) => {
            asked.push(invocation.argv)
            return promiseResolve(9)
          },
        }),
    }
    const { code } = await hf(['-h'], { host: beside })
    expect({ code, asked }).toEqual({ code: 0, asked: [['--help']] })
  })

  it('leaves the other usage out of a run the other command line passed on', async () => {
    const resolve = jest.fn(() => null)
    await hf(['--help'], { host: { ...ALONE, resolve }, handedOver: true })
    expect(resolve).not.toHaveBeenCalled()
  })
})

describe('runWorkspaceCli commands it does not own', () => {
  it('passes the command to the features command line and answers with its exit code', async () => {
    const beside: HandoverHost = { resolve: () => '/features.cjs', load: () => promiseResolve({ runFeaturesCli: () => promiseResolve(0) }) }
    expect((await hf(['pack'], { host: beside })).code).toBe(0)
  })

  it('finds the features command line through the host of this process unless given one', async () => {
    mockProcessHost.mockReturnValueOnce({
      resolve: () => '/features.cjs',
      load: () => promiseResolve({ runFeaturesCli: () => promiseResolve(42) }),
    })
    const stream = createCapturedOutput()
    await expect(runWorkspaceCli({ argv: ['pack'], cwd: workspace.path, stdout: stream, stderr: stream })).resolves.toBe(42)
  })

  it('reports the command and the usage where the features package is not installed', async () => {
    expect(await hf(['pack'])).toEqual({ code: 1, stdout: '', stderr: `hf: unknown command pack\n${USAGE}` })
  })

  it('reports a command passed on to it rather than passing it back', async () => {
    const resolve = jest.fn(() => '/features.cjs')
    const result = await hf(['pack'], { host: { ...ALONE, resolve }, handedOver: true })
    expect({ code: result.code, stderr: result.stderr, asked: resolve.mock.calls.length }).toEqual({
      code: 1,
      stderr: `hf: unknown command pack\n${USAGE}`,
      asked: 0,
    })
  })
})

describe('runWorkspaceCli workspace', () => {
  it('refuses to run outside a workspace', async () => {
    rmSync(join(workspace.path, 'hf.json'))
    expect(await hf(['show', 'projects'])).toEqual({
      code: 1,
      stdout: '',
      stderr: 'run from inside the workspace: no hf.json above the working directory\n',
    })
  })

  it('installs the aliases of the workspace above where it started', async () => {
    await hf(['show', 'projects'], { cwd: join(workspace.path, 'libs/alpha') })
    expect(mockInstall.mock.calls).toEqual([[workspace.path]])
  })

  it('moves to the workspace root', async () => {
    await hf(['show', 'projects'], { cwd: join(workspace.path, 'libs/alpha') })
    expect(process.cwd()).toBe(workspace.path)
  })

  it('puts the binaries of the workspace first on the search path', async () => {
    await hf(['show', 'projects'])
    expect(process.env['PATH']).toBe(searchPath(workspace.path, SEARCH_PATH, process.execPath, process.platform))
  })
})

describe('runWorkspaceCli run', () => {
  it('answers 0 for a task whose executor, imported from the workspace, succeeds', async () => {
    expect((await hf(['run', 'lib-alpha:build'])).code).toBe(0)
  })

  it('answers 1 for a task whose executor fails', async () => {
    expect((await hf(['run', 'lib-alpha:check'])).code).toBe(1)
  })

  it('starts the command of a run-commands task', async () => {
    await hf(['run', 'lib-alpha:audit'])
    expect(mockSpawn.mock.calls).toEqual([['npm audit', expect.objectContaining({ cwd: join(workspace.path, 'libs/alpha') })]])
  })

  it('reports a call that names no task', async () => {
    expect(await hf(['run'])).toEqual({ code: 1, stdout: '', stderr: `${RUN_USAGE}\n` })
  })
})

describe('runWorkspaceCli run-many', () => {
  it('runs each task in a child started the way this process was, from the workspace root', async () => {
    await hf(['run-many', '-t', 'build', '-p', 'lib-alpha'])
    expect(mockSpawn.mock.calls).toEqual([
      [process.execPath, [...process.execArgv, process.argv[1], 'run', 'lib-alpha:build'], { cwd: workspace.path, stdio: 'inherit' }],
    ])
  })

  it('passes the arguments after the selection to the requested tasks', async () => {
    await hf(['run-many', '-t', 'build', '-p', 'lib-alpha', '--verbose'])
    expect((mockSpawn.mock.calls[0]?.[1] as string[]).slice(-3)).toEqual(['run', 'lib-alpha:build', '--verbose'])
  })

  it('exits cleanly and prints the summary when every task succeeds', async () => {
    const { code, stderr } = await hf(['run-many', '-t', 'build', '-p', 'lib-alpha'])
    expect({ code, stderr }).toEqual({ code: 0, stderr: expect.stringContaining('1 succeeded, 0 failed, 0 skipped\n') })
  })

  it('exits with 1 when a task fails, and still runs the rest', async () => {
    childrenExit(3, 0)
    const { code, stderr } = await hf(['run-many', '-t', 'audit,build', '-p', 'lib-alpha'])
    expect({ code, stderr }).toEqual({ code: 1, stderr: expect.stringContaining('1 succeeded, 1 failed, 0 skipped\n') })
  })

  it('counts a child that could not start as failed', async () => {
    childEnds((child) => child.fail(createError('spawn ENOENT')))
    expect((await hf(['run-many', '-t', 'build', '-p', 'lib-alpha'])).code).toBe(1)
  })

  it('counts a child ended by a signal as failed', async () => {
    childEnds((child) => child.exit(null, 'SIGTERM'))
    expect((await hf(['run-many', '-t', 'build', '-p', 'lib-alpha'])).code).toBe(1)
  })
})

describe('runWorkspaceCli affected', () => {
  it('runs the tasks the change selects, with what comes after the selection', async () => {
    writeFileSync(join(workspace.path, 'libs/alpha/src/index.ts'), 'export const alpha = 2\n')
    await hf(['affected', '-t', 'build', '--base=HEAD', '--verbose'])
    expect(mockSpawn.mock.calls.map(([, args]) => (args as string[]).slice(-3))).toEqual([['run', 'lib-alpha:build', '--verbose']])
  })

  it('reports how many tasks the changed files selected', async () => {
    writeFileSync(join(workspace.path, 'libs/alpha/src/index.ts'), 'export const alpha = 2\n')
    const { stderr } = await hf(['affected', '-t', 'build', '--base=HEAD'])
    expect(stderr).toContain('hf affected: 1 tasks selected from 1 changed files\n')
  })

  it('selects nothing for a working tree that matches the base', async () => {
    const { code, stderr } = await hf(['affected', '-t', 'build', '--base=HEAD'])
    expect({ code, stderr, started: mockSpawn.mock.calls.length }).toEqual({
      code: 0,
      stderr: 'hf affected: 0 tasks selected from 0 changed files\n0 succeeded, 0 failed, 0 skipped\n',
      started: 0,
    })
  })

  it('selects nothing for a target no project has', async () => {
    const { stderr } = await hf(['affected', '-t', 'absent', '--base=HEAD'])
    expect(stderr).toContain('hf affected: 0 tasks selected')
  })

  it('selects nothing for a target the selection has no answer for', async () => {
    mockSelect.mockReturnValueOnce(createMap())
    writeFileSync(join(workspace.path, 'libs/alpha/src/index.ts'), 'export const alpha = 2\n')
    const { stderr } = await hf(['affected', '-t', 'build', '--base=HEAD'])
    expect(stderr).toContain('hf affected: 0 tasks selected from 1 changed files\n')
  })
})

describe('runWorkspaceCli format', () => {
  it('runs the prettier the workspace installs on this Node, from the workspace root, over the files named', async () => {
    await hf(['format', '--check', '--files=a.ts,b.ts'])
    expect(mockSpawn.mock.calls).toEqual([
      [
        process.execPath,
        [
          join(workspace.path, 'node_modules/prettier/bin/prettier.cjs'),
          '--check',
          '--ignore-unknown',
          '--log-level=warn',
          '--',
          'a.ts',
          'b.ts',
        ],
        { cwd: workspace.path, stdio: 'inherit' },
      ],
    ])
  })

  it('formats the changed and untracked files unless told otherwise', async () => {
    writeFileSync(join(workspace.path, 'libs/alpha/src/index.ts'), 'export const alpha = 2\n')
    writeFileSync(join(workspace.path, 'added.ts'), 'export {}\n')
    await hf(['format', '--write'])
    expect(formatted()).toEqual([['libs/alpha/src/index.ts', 'added.ts']])
  })

  it('leaves a deleted file out of the changed files', async () => {
    rmSync(join(workspace.path, 'libs/beta/package.json'))
    await hf(['format', '--write'])
    expect(formatted()).toEqual([])
  })

  it('starts nothing when nothing changed', async () => {
    const run = await hf(['format', '--check'])
    expect({ run, started: mockSpawn.mock.calls.length }).toEqual({ run: { code: 0, stdout: '', stderr: '' }, started: 0 })
  })

  it('formats every tracked and untracked file that exists under --all', async () => {
    writeFileSync(join(workspace.path, 'added.ts'), 'export {}\n')
    rmSync(join(workspace.path, 'libs/beta/package.json'))
    await hf(['format', '--check', '--all'])
    const files = formatted().flat()
    expect({
      alpha: files.includes('libs/alpha/src/index.ts'),
      added: files.includes('added.ts'),
      deleted: files.includes('libs/beta/package.json'),
    }).toEqual({ alpha: true, added: true, deleted: false })
  })

  it('answers with the exit code of prettier', async () => {
    childrenExit(2)
    expect((await hf(['format', '--check', '--files=a.ts'])).code).toBe(2)
  })

  it('answers with the highest exit code of its runs', async () => {
    childrenExit(3, 0)
    const files = Array.from({ length: FILES_PER_RUN + 1 }, (_, index) => `${index}.ts`).join(',')
    expect((await hf(['format', '--check', `--files=${files}`])).code).toBe(3)
  })

  it('refuses a workspace without prettier', async () => {
    rmSync(join(workspace.path, 'node_modules/prettier'), { recursive: true })
    expect(await hf(['format', '--check', '--files=a.ts'])).toEqual({
      code: 1,
      stdout: '',
      stderr: `hf format: prettier is not installed in the workspace; install it to format\n${FORMAT_USAGE}\n`,
    })
  })
})

describe('runWorkspaceCli generate', () => {
  it('writes what the generator of the workspace created and prints each change', async () => {
    const run = await hf(['generate', 'note', 'hello'])
    expect({ run, written: readFileSync(join(workspace.path, 'notes/hello.txt'), 'utf8') }).toEqual({
      run: { code: 0, stdout: 'CREATE notes/hello.txt\n', stderr: '' },
      written: 'hello',
    })
  })

  it('prints the changes and writes nothing under --dry-run', async () => {
    const run = await hf(['generate', 'note', 'hello', '--dry-run'])
    expect({ run, written: existsSync(join(workspace.path, 'notes/hello.txt')) }).toEqual({
      run: { code: 0, stdout: 'CREATE notes/hello.txt\n', stderr: 'hf generate: dry run, nothing written\n' },
      written: false,
    })
  })

  it('runs where it started when there is no workspace file yet', async () => {
    rmSync(join(workspace.path, 'hf.json'))
    await hf(['generate', 'note', 'first'])
    expect(existsSync(join(workspace.path, 'notes/first.txt'))).toBe(true)
  })

  it('reports a call it cannot read with its usage', async () => {
    expect(await hf(['generate'])).toEqual({ code: 1, stdout: '', stderr: `hf generate: name the generator\n${GENERATE_USAGE}\n` })
  })
})

describe('runWorkspaceCli show', () => {
  it('prints the projects with a target in name order', async () => {
    expect(await hf(['show', 'projects', '--with-target=check'])).toEqual({ code: 0, stdout: 'lib-alpha\n', stderr: '' })
  })

  it('reports a call it cannot read with its usage', async () => {
    expect(await hf(['show'])).toEqual({
      code: 1,
      stdout: '',
      stderr: `hf show: hf show lists projects alone, got nothing\n${SHOW_USAGE}\n`,
    })
  })
})

describe('runWorkspaceCli graph', () => {
  it('writes the result on standard output', async () => {
    const { code, stdout } = await hf(['graph', 'projects', '--json'])
    expect({ code, alpha: parse(stdout).some((project: { name: string }) => project.name === 'lib-alpha') }).toEqual({
      code: 0,
      alpha: true,
    })
  })

  it('reports a call it cannot read with its usage', async () => {
    expect(await hf(['graph', 'nope'])).toEqual({ code: 1, stdout: '', stderr: `hf graph: unknown command nope\n${GRAPH_USAGE}\n` })
  })
})

describe('runWorkspaceCli calls it cannot read', () => {
  it.each([
    [['run-many'], 'hf run-many: ', 'name the targets with -t', MANY_USAGE],
    [['run-many', '-t', 'build'], 'hf run-many: ', 'name the projects with -p, or pass --all', MANY_USAGE],
    [['affected'], 'hf affected: ', 'name the targets with -t', AFFECTED_USAGE],
    [['format'], 'hf format: ', 'pass exactly one of --check and --write', FORMAT_USAGE],
    [['format', '--check', '--nope'], 'hf format: ', 'unknown argument --nope', FORMAT_USAGE],
  ])('reports %j with what is wrong and its usage', async (argv, prefix, message, usage) => {
    const { code, stdout, stderr } = await hf(argv)
    expect({
      code,
      stdout,
      prefix: stderr.startsWith(prefix),
      message: stderr.includes(message),
      usage: stderr.endsWith(`${usage}\n`),
    }).toEqual({
      code: 1,
      stdout: '',
      prefix: true,
      message: true,
      usage: true,
    })
  })
})
