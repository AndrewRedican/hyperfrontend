/**
 * The view of a run in progress: a line for every task as it ends, a sign of life while a task
 * runs long, the excerpt of a failed task's log in place of the log, and at the end the matrix of
 * projects by targets with the totals. Nothing here knows how a task is executed.
 *
 * @module progress/view
 */

import type { Terminal } from './terminal'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { formatDuration } from './log'
import { Ending, ENDINGS, markOf, matrixLines } from './matrix'
import { Style } from './terminal'

/** One task of the run, as the view names and places it. */
export interface ViewTask {
  /** `<project>:<target>`. */
  readonly id: string
  /** The row of the matrix it belongs to. */
  readonly project: string
  /** The column of the matrix it belongs to. */
  readonly target: string
  /** The stage it runs in, counted from 0. */
  readonly stage: number
}

/** How one task ended. */
export interface TaskEnd {
  /** `<project>:<target>`. */
  readonly id: string
  /** Whether it passed, failed, or was skipped. */
  readonly ending: Ending
  /** How long it ran, in milliseconds. */
  readonly durationMs: number
  /** Why it did not run or did not reach an exit, shown in place of the duration, or null. */
  readonly detail: string | null
  /** The part of a failed task's log that explains the failure, or null. */
  readonly excerpt: string | null
  /** Where the task's log is, or null when it wrote none. */
  readonly log: string | null
}

/** What a view needs. */
export interface ViewOptions {
  /** Every task of the run. */
  readonly tasks: readonly ViewTask[]
  /** How many stages the run has. */
  readonly stages: number
  /** Where the lines and the status go. */
  readonly terminal: Terminal
  /** The current time in milliseconds. */
  readonly now: () => number
  /** How long a task runs before a terminal shows it as running; 3 seconds unless given. */
  readonly thresholdMs?: number
  /** How long a task runs between two lines saying so on plain output; 30 seconds unless given. */
  readonly intervalMs?: number
}

/** The view of one run. */
export interface ProgressView {
  /** Says a stage starts. */
  readonly stage: (stage: number) => void
  /** Notes that a task started. */
  readonly started: (id: string) => void
  /** Writes the line of a task that ended, and under a failed one its excerpt and where its log is. */
  readonly ended: (end: TaskEnd) => void
  /** Shows what has been running long; meant to be called every second or so. */
  readonly tick: () => void
  /** Writes the matrix and the totals; the tasks that never ended are shown as not run. */
  readonly finish: (stopped: number | null) => void
}

/** A task that started and has not ended. */
interface Running {
  /** When it started. */
  readonly startedAt: number
  /** How long it has to have run before plain output says so again. */
  due: number
}

/** How long a task runs before a terminal shows it as running, in milliseconds. */
const THRESHOLD_MS = 3000

/** How long a task runs between two lines saying so on plain output, in milliseconds. */
const INTERVAL_MS = 30_000

/**
 * A count of things, in words, as every line about a run words it.
 *
 * @param count - How many there are
 * @param noun - What one of them is called
 * @returns The count and the noun, plural unless the count is one
 *
 * @example One and several
 * ```typescript
 * counted(1, 'task') // => '1 task'
 * counted(0, 'changed file') // => '0 changed files'
 * ```
 */
export function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

/**
 * The line that names the stage a run stopped at, as every report of a run words it.
 *
 * @param stopped - The stage that did not succeed, counted from 0
 * @param targets - The targets of that stage, as the report names them
 * @param notRun - How many tasks the stage kept from running
 * @param stages - How many stages the run has
 * @returns The line, or null for the only stage of a run that kept no task from running
 *
 * @example A stage that kept tasks from running, the last stage, and the only one
 * ```typescript
 * stoppedLine(0, 'typecheck, lint', 3, 3) // => 'stage 1 (typecheck, lint) did not succeed: 3 tasks not run'
 * stoppedLine(2, 'build', 0, 3) // => 'stage 3 (build) did not succeed'
 * stoppedLine(0, 'test', 0, 1) // => null: the only stage of the run, and it kept no task from running
 * ```
 */
export function stoppedLine(stopped: number, targets: string, notRun: number, stages: number): string | null {
  if (notRun === 0 && stages === 1) return null
  const line = `stage ${stopped + 1} (${targets}) did not succeed`
  return notRun === 0 ? line : `${line}: ${counted(notRun, 'task')} not run`
}

/**
 * The view of a run: call it as stages start and tasks start and end, and once at the end.
 *
 * @param options - The tasks, the stages, where to write and the clock
 * @returns What the run calls as it goes
 *
 * @example One task that fails, and what the run ends on
 * ```typescript
 * import { createProgressView, createTerminal, Ending } from '@hyperfrontend/workspace/progress'
 *
 * const view = createProgressView({
 *   tasks: [
 *     { id: 'lib-core:lint', project: 'lib-core', target: 'lint', stage: 0 },
 *     { id: 'lib-core:test', project: 'lib-core', target: 'test', stage: 1 },
 *   ],
 *   stages: 2,
 *   terminal: createTerminal(process.stderr, process.env),
 *   now: Date.now,
 * })
 * view.stage(0)
 * view.started('lib-core:lint')
 * view.ended({
 *   id: 'lib-core:lint',
 *   ending: Ending.Failed,
 *   durationMs: 4200,
 *   detail: null,
 *   excerpt: 'src/index.ts:3:1 error no-default-export',
 *   log: '.hf/logs/lib-core__lint.log',
 * })
 * view.finish(0)
 * // stage 1 of 2: lint (1 task)
 * // ✗ lib-core:lint  4.2s  [1/2]
 * //     src/index.ts:3:1 error no-default-export
 * //     log: .hf/logs/lib-core__lint.log
 * // stage 1 (lint) did not succeed: 1 task not run
 * //
 * //           lint  test
 * // lib-core  ✗     ·
 * // ✓ passed  ✗ failed  - skipped  · not run
 * //
 * // 2 tasks in 4.2s: 1 failed, 1 not run
 * // ✗ lib-core:lint  .hf/logs/lib-core__lint.log
 * ```
 */
export function createProgressView(options: ViewOptions): ProgressView {
  const { tasks, stages, terminal, now } = options
  const threshold = options.thresholdMs ?? THRESHOLD_MS
  const interval = options.intervalMs ?? INTERVAL_MS
  const began = now()
  const endings = createMap<string, Ending>()
  const running = createMap<string, Running>()
  const failed: TaskEnd[] = []
  const membersOf = (stage: number): ViewTask[] => tasks.filter((task) => task.stage === stage)
  const targetsOf = (stage: number): string => [...createSet(membersOf(stage).map((task) => task.target))].join(', ')
  return {
    stage: (stage) => {
      if (stages === 1) return
      terminal.line(
        terminal.paint(`stage ${stage + 1} of ${stages}: ${targetsOf(stage)} (${counted(membersOf(stage).length, 'task')})`, Style.Bold)
      )
    },
    started: (id) => void running.set(id, { startedAt: now(), due: interval }),
    ended: (end) => {
      running.delete(end.id)
      endings.set(end.id, end.ending)
      const position = terminal.paint(`[${endings.size}/${tasks.length}]`, Style.Dim)
      terminal.line(`${markOf(end.ending, terminal.paint)} ${end.id}  ${end.detail ?? formatDuration(end.durationMs)}  ${position}`)
      if (end.ending !== Ending.Failed) return
      failed.push(end)
      for (const line of end.excerpt === null ? [] : end.excerpt.split(/\r?\n/)) terminal.line(`    ${line}`)
      if (end.log !== null) terminal.line(`    log: ${end.log}`)
    },
    tick: () => {
      const at = now()
      const long = [...running].filter(([, run]) => at - run.startedAt >= (terminal.plain ? run.due : threshold))
      if (!terminal.plain) {
        if (long.length > 0) terminal.status(long.map(([id, run]) => `… ${id} ${formatDuration(at - run.startedAt)}`).join(', '))
        return
      }
      for (const [id, run] of long) {
        terminal.line(`… ${id} still running (${formatDuration(at - run.startedAt)})`)
        run.due = at - run.startedAt + interval
      }
    },
    finish: (stopped) => {
      const notRun = tasks.filter((task) => !endings.has(task.id))
      for (const task of notRun) endings.set(task.id, Ending.NotRun)
      const stoppedAt = stopped === null ? null : stoppedLine(stopped, targetsOf(stopped), notRun.length, stages)
      if (stoppedAt !== null) terminal.line(terminal.paint(stoppedAt, Style.Red))
      terminal.line('')
      const ended = tasks.map((task) => ({ ...task, ending: endings.get(task.id) as Ending }))
      for (const line of matrixLines(ended, terminal.paint)) terminal.line(line)
      terminal.line('')
      const totals = ENDINGS.map((ending) => [ending, ended.filter((task) => task.ending === ending).length] as const)
        .filter(([, count]) => count > 0)
        .map(([ending, count]) => `${count} ${ending.replace('-', ' ')}`)
      terminal.line(`${counted(tasks.length, 'task')} in ${formatDuration(now() - began)}: ${totals.join(', ')}`)
      for (const end of failed) terminal.line(`${markOf(Ending.Failed, terminal.paint)} ${end.id}${end.log === null ? '' : `  ${end.log}`}`)
    },
  }
}
