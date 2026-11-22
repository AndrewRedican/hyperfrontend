/**
 * Runs planned tasks for the command line, stage by stage, each task in a child started the way
 * this process was. Unless asked to stream, a task writes to a log of its own under `.hf/logs`
 * and the progress view says what runs, what ended and how; streaming, a task writes straight to
 * the terminal and the run ends on a list.
 *
 * @module cli/tasks
 */

import type { ProgressSink } from '../progress/terminal'
import type { TaskEnd, ViewTask } from '../progress/view'
import type { ManyHost, PlannedTask, TaskOutcome } from '../runner/many'
import { spawn } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createPromise } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { failureExcerpt, taskLogPath } from '../progress/log'
import { Ending } from '../progress/matrix'
import { assignStages, runStages } from '../progress/stages'
import { createTerminal } from '../progress/terminal'
import { createProgressView, stoppedLine } from '../progress/view'
import { manySummary, runPlanned } from '../runner/many'
import { selfCommand } from '../runner/self'

/** Where each task's log is written, workspace-relative. */
export const LOG_DIRECTORY = '.hf/logs'

/** How often the view is asked to show what has been running long, in milliseconds. */
const TICK_MS = 1000

/** The tasks to run and how. */
export interface TaskRun {
  /** The tasks, each after its prerequisites. */
  readonly tasks: readonly PlannedTask[]
  /** The arguments every requested task receives. */
  readonly args: readonly string[]
  /** The targets of each stage, in the order the stages run. */
  readonly stages: readonly (readonly string[])[]
  /** Whether each task writes straight to the terminal. */
  readonly stream: boolean
}

/** Where the tasks run and where the run is reported. */
export interface TaskSession {
  /** The workspace root, absolute. */
  readonly root: string
  /** Writes a line of the command line's own. */
  readonly note: (line: string) => void
  /** The stream the command line's own lines go to. */
  readonly sink: ProgressSink
}

/** How a run is reported while its stages run and when it ends. */
interface Reporter {
  /** How a task runs and what is told of it. */
  readonly host: ManyHost
  /** Says a stage starts. */
  readonly stage: (stage: number) => void
  /** Reports the end of the run. */
  readonly finish: (stopped: number | null, notRun: number, outcomes: readonly TaskOutcome[]) => void
}

/** The ending the view shows for each status of the runner. */
const ENDINGS: Readonly<Record<TaskOutcome['status'], Ending>> = {
  succeeded: Ending.Passed,
  failed: Ending.Failed,
  skipped: Ending.Skipped,
}

/**
 * Runs a program in a child from the workspace root, with inherited standard streams or, given a
 * log, with no input and both outputs written to that file.
 *
 * @param root - The workspace root, absolute
 * @param command - The program
 * @param args - Its arguments
 * @param log - The file both outputs go to, workspace-relative, or null to inherit the streams
 * @returns The exit code
 *
 * @example A program whose output is kept in a file
 * ```typescript
 * await runChild(root, process.execPath, ['--version'], '.hf/logs/node-version.log')
 * // => 0, and the file holds what the program printed
 * ```
 */
export function runChild(root: string, command: string, args: readonly string[], log: string | null = null): Promise<number> {
  return createPromise((resolve) => {
    const child = log === null ? spawn(command, args, { cwd: root, stdio: 'inherit' }) : spawnLogged(root, command, args, log)
    child.on('error', () => resolve(1))
    child.on('close', (code) => resolve(code ?? 1))
  })
}

/**
 * Starts a child whose outputs go to a file, in the order they are written.
 *
 * @param root - The workspace root, absolute
 * @param command - The program
 * @param args - Its arguments
 * @param log - The file, workspace-relative
 * @returns The child
 */
function spawnLogged(root: string, command: string, args: readonly string[], log: string): ReturnType<typeof spawn> {
  mkdirSync(dirname(join(root, log)), { recursive: true })
  const file = openSync(join(root, log), 'w')
  try {
    return spawn(command, args, { cwd: root, stdio: ['ignore', file, file] })
  } finally {
    // why: the child holds its own copy of the descriptor from the moment it is started
    closeSync(file)
  }
}

/**
 * Starts one task the way this process was started.
 *
 * @param root - The workspace root, absolute
 * @param id - The task, `<project>:<target>`
 * @param args - The arguments after it
 * @param log - The task's log, workspace-relative, or null to inherit the streams
 * @returns The exit code
 */
function startTask(root: string, id: string, args: readonly string[], log: string | null): Promise<number> {
  const [program, ...rest] = selfCommand(process, ['run', id, ...args]) as [string, ...string[]]
  return runChild(root, program, rest, log)
}

/**
 * The reporter of a streamed run: the runner's own lines, and the list of tasks at the end.
 *
 * @param run - The stages
 * @param session - Where the tasks run and where to write
 * @returns How the tasks run and what is written as stages start and the run ends
 */
function streamReporter(run: TaskRun, session: TaskSession): Reporter {
  const targetsOf = (stage: number): string => (run.stages[stage] as readonly string[]).join(', ')
  return {
    host: { runChild: (id, args) => startTask(session.root, id, args, null), now: dateNow, write: session.note },
    stage: (stage) => {
      if (run.stages.length > 1) session.note(`hf run-many: stage ${stage + 1} of ${run.stages.length}: ${targetsOf(stage)}`)
    },
    finish: (stopped, notRun, outcomes) => {
      for (const line of manySummary(outcomes)) session.note(line)
      const stoppedAt = stopped === null ? null : stoppedLine(stopped, targetsOf(stopped), notRun, run.stages.length)
      if (stoppedAt !== null) session.note(stoppedAt)
    },
  }
}

/**
 * The reporter of a run behind the progress view: each task writes to its log, and the view is
 * told as tasks start and end.
 *
 * @param run - The stages
 * @param session - Where the tasks run and where to write
 * @param tasks - The tasks as the view names and places them
 * @returns How the tasks run and what the view is told as stages start and the run ends
 */
function viewReporter(run: TaskRun, session: TaskSession, tasks: readonly ViewTask[]): Reporter {
  const view = createProgressView({ tasks, stages: run.stages.length, terminal: createTerminal(session.sink, process.env), now: dateNow })
  const timer = setInterval(view.tick, TICK_MS)
  const ended = (outcome: TaskOutcome): TaskEnd => {
    const log = outcome.status === 'skipped' ? null : taskLogPath(outcome.id, LOG_DIRECTORY)
    return {
      id: outcome.id,
      ending: ENDINGS[outcome.status],
      durationMs: outcome.durationMs,
      detail: outcome.blockedBy === undefined ? null : `${outcome.blockedBy} did not succeed`,
      excerpt: outcome.status === 'failed' ? failureExcerpt(readFileSync(join(session.root, log as string), 'utf8')) : null,
      log,
    }
  }
  return {
    host: {
      runChild: (id, args) => startTask(session.root, id, args, taskLogPath(id, LOG_DIRECTORY)),
      now: dateNow,
      write: () => undefined,
      onStart: view.started,
      onEnd: (outcome) => view.ended(ended(outcome)),
    },
    stage: view.stage,
    finish: (stopped) => {
      clearInterval(timer)
      view.finish(stopped)
    },
  }
}

/**
 * Runs planned tasks stage by stage and reports the run.
 *
 * @param run - The tasks, the arguments the requested ones receive, the stages and whether to stream
 * @param session - Where the tasks run and where to write
 * @returns The exit code: 0 when every task succeeded, 1 otherwise
 *
 * @example The lints first, and the tests only when every lint passed
 * ```typescript
 * const code = await runTasks(
 *   { tasks: planMany(graph, request), args: [], stages: [['lint'], ['test']], stream: false },
 *   { root, note: (line) => process.stderr.write(`${line}\n`), sink: process.stderr }
 * )
 * // => 1 when a lint failed; no test started, and the view ended on the matrix
 * ```
 */
export async function runTasks(run: TaskRun, session: TaskSession): Promise<number> {
  if (run.tasks.length === 0) {
    session.note('no task to run')
    return 0
  }
  const staged = run.tasks.map((task) => ({
    id: task.id,
    project: task.id.slice(0, task.id.indexOf(':')),
    target: task.id.slice(task.id.indexOf(':') + 1),
    needs: task.after,
  }))
  const stageOf = assignStages(staged, run.stages)
  const reporter = run.stream
    ? streamReporter(run, session)
    : viewReporter(
        run,
        session,
        staged.map((task) => ({ ...task, stage: stageOf.get(task.id) as number }))
      )
  const outcomes: TaskOutcome[] = []
  const { stopped, notRun } = await runStages({
    tasks: run.tasks,
    stageOf,
    runStage: async (tasks, stage) => {
      reporter.stage(stage)
      const ended = await runPlanned(tasks, run.args, reporter.host)
      outcomes.push(...ended)
      return ended.every((outcome) => outcome.status === 'succeeded')
    },
  })
  reporter.finish(stopped, notRun.length, outcomes)
  return stopped === null ? 0 : 1
}
