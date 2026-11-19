import type { ChildProcess } from 'node:child_process'
import type { Mock } from '@hyperfrontend/testing'
import type { TempDir } from '@hyperfrontend/testing/fs'
import type { PlannedTask } from '../runner/many'
import type { TaskRun } from './tasks'
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { queueMicrotask } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { createFakeChildProcess } from '@hyperfrontend/testing/process'
import { taskLogPath } from '../progress/log'
import { LOG_DIRECTORY, runChild, runTasks } from './tasks'

jest.mock('node:child_process', () => ({
  ...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
  spawn: jest.fn(),
}))

const mockSpawn = spawn as unknown as Mock

/** A lint and a build of a library, and the build of an application that waits on the library's. */
const TASKS: readonly PlannedTask[] = [
  { id: 'lib-a:lint', requested: true, after: [] },
  { id: 'lib-a:build', requested: true, after: [] },
  { id: 'app:build', requested: true, after: ['lib-a:build'] },
]

/** How a child of a case ends. */
interface Ending {
  /** The exit code. */
  readonly code: number
  /** What the task leaves in its log before it ends. */
  readonly log?: string
}

/** What a run answered and wrote. */
interface Ran {
  /** The exit code. */
  readonly code: number
  /** The lines of the progress view, or of anything else written to the stream. */
  readonly lines: string[]
  /** The command line's own lines. */
  readonly notes: string[]
  /** The ids of the tasks started, in order. */
  readonly started: string[]
}

let root: TempDir

/**
 * The task a child was started for.
 *
 * @param args - The arguments the child was started with
 * @returns The id after `run`
 */
function taskOf(args: readonly string[]): string {
  return args[args.indexOf('run') + 1] as string
}

/**
 * Runs the tasks of the fixture in two stages, the lint and then the builds.
 *
 * @param endings - How the child of a task ends, by id; a task not named exits with 0
 * @param run - How the run differs from the fixture's
 * @returns The exit code and what was written
 */
async function ran(endings: Readonly<Record<string, Ending>> = {}, run: Partial<TaskRun> = {}): Promise<Ran> {
  mockSpawn.mockImplementation((_: string, args: readonly string[]) => {
    const child = createFakeChildProcess()
    const { code, log } = endings[taskOf(args)] ?? { code: 0 }
    queueMicrotask(() => {
      if (log !== undefined) writeFileSync(join(root.path, taskLogPath(taskOf(args), LOG_DIRECTORY)), log)
      child.exit(code)
    })
    return child as unknown as ChildProcess
  })
  const written: string[] = []
  const notes: string[] = []
  const code = await runTasks(
    { tasks: TASKS, args: [], stages: [['lint'], ['build']], stream: false, ...run },
    { root: root.path, note: (line) => notes.push(line), sink: { write: (text) => written.push(text) } }
  )
  const started = mockSpawn.mock.calls.map(([, args]) => taskOf(args as string[]))
  return { code, lines: written.join('').split(/\r?\n/), notes, started }
}

beforeEach(() => {
  mockSpawn.mockReset()
  root = createTempDir({ prefix: 'cli-tasks-' })
})

afterEach(() => root.remove())

describe('runTasks', () => {
  it('says so when there is no task to run', async () => {
    expect(await ran({}, { tasks: [] })).toEqual({ code: 0, lines: [''], notes: ['no task to run'], started: [] })
  })

  it('starts each task the way this process was started, with no input and both outputs in one file', async () => {
    await ran()
    expect(mockSpawn.mock.calls[0]).toEqual([
      process.execPath,
      [...process.execArgv, process.argv[1], 'run', 'lib-a:lint'],
      { cwd: root.path, stdio: ['ignore', expect.any(Number), expect.any(Number)] },
    ])
  })

  it('keeps a log per task under the log directory', async () => {
    await ran()
    expect(TASKS.filter((task) => !existsSync(join(root.path, taskLogPath(task.id, LOG_DIRECTORY))))).toEqual([])
  })

  it('writes a line per task as it ends and nothing through the command line', async () => {
    const { lines, notes } = await ran()
    expect({ lines: lines.slice(0, 5), notes }).toEqual({
      lines: [
        'stage 1 of 2: lint (1 task)',
        expect.stringMatching(/^✓ lib-a:lint {2}\S+ {2}\[1\/3\]$/),
        'stage 2 of 2: build (2 tasks)',
        expect.stringMatching(/^✓ lib-a:build {2}\S+ {2}\[2\/3\]$/),
        expect.stringMatching(/^✓ app:build {2}\S+ {2}\[3\/3\]$/),
      ],
      notes: [],
    })
  })

  it('exits cleanly and ends on the matrix when every task succeeds', async () => {
    const { code, lines } = await ran()
    expect({ code, matrix: lines.slice(6, 9) }).toEqual({ code: 0, matrix: ['       lint  build', 'app          ✓', 'lib-a  ✓     ✓'] })
  })

  it('starts no task of a later stage after a stage with a failure, and exits with 1', async () => {
    const { code, started, lines } = await ran({ 'lib-a:lint': { code: 2 } })
    expect({ code, started, stopped: lines.includes('stage 1 (lint) did not succeed: 2 tasks not run') }).toEqual({
      code: 1,
      started: ['lib-a:lint'],
      stopped: true,
    })
  })

  it('shows what a failed task left in its log, and where the log is', async () => {
    const { lines } = await ran({ 'lib-a:lint': { code: 1, log: 'src/a.ts:1 error\n' } })
    expect(lines.slice(2, 4)).toEqual(['    src/a.ts:1 error', `    log: ${LOG_DIRECTORY}/lib-a__lint.log`])
  })

  it('shows a task skipped after a failed prerequisite with the prerequisite, and no log', async () => {
    const { lines } = await ran({ 'lib-a:build': { code: 1 } })
    expect(lines.slice(4, 6)).toEqual([`    log: ${LOG_DIRECTORY}/lib-a__build.log`, '- app:build  lib-a:build did not succeed  [3/3]'])
  })

  it('passes the arguments to the requested tasks', async () => {
    await ran({}, { args: ['--fix'], tasks: [{ id: 'lib-a:lint', requested: true, after: [] }] })
    expect((mockSpawn.mock.calls[0]?.[1] as string[]).slice(-3)).toEqual(['run', 'lib-a:lint', '--fix'])
  })
})

describe('runTasks, streaming', () => {
  it('starts each task with the standard streams of this process', async () => {
    await ran({}, { stream: true })
    expect(mockSpawn.mock.calls[0]?.[2]).toEqual({ cwd: root.path, stdio: 'inherit' })
  })

  it('writes the lines of the runner and the stages through the command line, and no view', async () => {
    const { lines, notes } = await ran({}, { stream: true })
    expect({ lines, notes: notes.slice(0, 5) }).toEqual({
      lines: [''],
      notes: [
        'hf run-many: stage 1 of 2: lint',
        'hf run-many: lib-a:lint',
        'hf run-many: stage 2 of 2: build',
        'hf run-many: lib-a:build',
        'hf run-many: app:build',
      ],
    })
  })

  it('names no stage when the run has one', async () => {
    const { notes } = await ran({}, { stream: true, stages: [['lint', 'build']] })
    expect(notes[0]).toBe('hf run-many: lib-a:lint')
  })

  it('ends on the list of the tasks that ran', async () => {
    const { code, notes } = await ran({}, { stream: true })
    expect({ code, last: notes.at(-1) }).toEqual({ code: 0, last: '3 succeeded, 0 failed, 0 skipped' })
  })

  it('ends on the stage that stopped the run and how many tasks it kept from running', async () => {
    const { code, notes } = await ran({ 'lib-a:lint': { code: 1 } }, { stream: true })
    expect({ code, last: notes.slice(-2) }).toEqual({
      code: 1,
      last: ['0 succeeded, 1 failed, 0 skipped', 'stage 1 (lint) did not succeed: 2 tasks not run'],
    })
  })
})

describe('runChild', () => {
  it('answers 1 for a child that could not start', async () => {
    mockSpawn.mockImplementationOnce(() => {
      const child = createFakeChildProcess()
      queueMicrotask(() => child.fail(createError('spawn ENOENT')))
      return child as unknown as ChildProcess
    })
    expect(await runChild(root.path, 'absent', [], taskLogPath('absent:task', LOG_DIRECTORY))).toBe(1)
  })

  it('answers 1 for a child a signal ended', async () => {
    mockSpawn.mockImplementationOnce(() => {
      const child = createFakeChildProcess()
      queueMicrotask(() => child.exit(null, 'SIGTERM'))
      return child as unknown as ChildProcess
    })
    expect(await runChild(root.path, 'node', [])).toBe(1)
  })
})
