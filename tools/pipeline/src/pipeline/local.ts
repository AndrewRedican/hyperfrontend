/**
 * The local run of a plan: three stages (the type checks and lints, the tests, then everything
 * else), each run by the scheduler to its end, a stage that did not succeed whole ending the run,
 * and the progress view in place of each task's replayed log. The tasks that keep an earlier
 * outcome are counted on one line and take no part in the stages.
 *
 * @module pipeline/local
 */

import type { ProgressView, TaskEnd, Terminal } from '@hyperfrontend/workspace/progress'
import type { RunOutcome } from './execute'
import type { Environment, Outcome as OutcomeKind, Plan, PlanTask, RunResults, TaskResult } from './model'
import type { ScheduleResult, ScheduleTask } from './schedule'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { clearInterval, setInterval } from '@hyperfrontend/immutable-api-utils/built-in-copy/timers'
import { assignStages, createProgressView, Ending, failureExcerpt, runStages } from '@hyperfrontend/workspace/progress'
import { inheritedFrom, scheduledNeeds } from './inherit'
import { Outcome, PipelineRule } from './model'
import { inheritedResults, planLine, taskResult } from './report'
import { runSchedule } from './schedule'

/** The targets of each stage of a local run; the last names none, and takes every target the others leave. */
export const LOCAL_STAGES: readonly (readonly string[])[] = freeze([freeze(['typecheck', 'lint']), freeze(['test']), freeze([])])

/** How often the view is asked to show what has been running long, in milliseconds. */
const TICK_MS = 1000

/** A task of a local run: a plan task with its chain's rank. */
export type LocalTask = PlanTask & ScheduleTask

/** What a local run needs. */
export interface LocalRunOptions<Task extends LocalTask> {
  /** The tasks of this environment. */
  readonly tasks: readonly Task[]
  /** How many light tasks run at once. */
  readonly parallel: number
  /** How many heavy tasks run at once. */
  readonly heavy: number
  /** Runs one task. */
  readonly run: (task: Task) => Promise<RunOutcome>
  /** Reads a log file by its workspace-relative path. */
  readonly readLog: (path: string) => string
  /** Where the progress is written. */
  readonly terminal: Terminal
  /** The clock. */
  readonly now: () => number
  /** Cancels what has not started. */
  readonly signal?: AbortSignal
}

/** What the local run of a plan needs: everything a local run does, but the plan in place of its tasks. */
export interface LocalPlanOptions extends Omit<LocalRunOptions<LocalTask>, 'tasks'> {
  /** The plan. */
  readonly plan: Plan
  /** Which environment's chains run. */
  readonly environment: Environment
  /** The Node.js release the tasks run on, as `process.version` names it. */
  readonly node: string
}

/** The ending the view shows for each outcome. */
const ENDINGS: Readonly<Record<OutcomeKind, Ending>> = freeze({
  [Outcome.Success]: Ending.Passed,
  [Outcome.Failure]: Ending.Failed,
  [Outcome.Skipped]: Ending.Skipped,
  [Outcome.Cancelled]: Ending.NotRun,
})

/**
 * What the view is told of a task that ended.
 *
 * @param result - What the scheduler recorded
 * @param readLog - Reads a log file by its workspace-relative path
 * @returns The end of the task, with the excerpt of its log when it failed
 */
function endOf(result: ScheduleResult, readLog: (path: string) => string): TaskEnd {
  const { id, outcome, durationMs, detail, log } = result
  return {
    id,
    ending: ENDINGS[outcome],
    durationMs,
    detail,
    excerpt: outcome === Outcome.Failure && log !== null ? failureExcerpt(readLog(log)) : null,
    log,
  }
}

/**
 * Runs one stage through the scheduler, telling the view of every task that starts and ends.
 *
 * @param options - The budgets, the runner and the signal of the run
 * @param tasks - The members of the stage, whose needs outside it are already met
 * @param view - What is told of every task that starts and ends
 * @returns Every task's result, by id
 */
function runStage<Task extends LocalTask>(
  options: LocalRunOptions<Task>,
  tasks: readonly Task[],
  view: ProgressView
): Promise<Map<string, ScheduleResult>> {
  const own = createSet(tasks.map((task) => task.id))
  return runSchedule({
    // why: a need outside the stage belongs to an earlier one, which succeeded whole or the run would have ended
    tasks: tasks.map((task) => ({ ...task, needs: task.needs.filter((need) => own.has(need)) })),
    parallel: options.parallel,
    heavy: options.heavy,
    run: options.run,
    signal: options.signal,
    now: options.now,
    onStart: (task) => view.started(task.id),
    onEnd: (_, result) => {
      // why: a task the interruption kept from starting is shown with the rest that did not run, not on a line of its own
      if (result.outcome !== Outcome.Cancelled) view.ended(endOf(result, options.readLog))
    },
  })
}

/**
 * Runs the tasks of a local run in stages and shows the run as it goes.
 *
 * @param options - The tasks, the budgets, the runner, where to write and the clock
 * @returns Every task's result, by id; a task of a stage that never started is skipped, naming the stage that ended the run
 */
export async function runLocal<Task extends LocalTask>(options: LocalRunOptions<Task>): Promise<Map<string, ScheduleResult>> {
  const { tasks, terminal } = options
  const results = createMap<string, ScheduleResult>()
  if (tasks.length === 0) {
    terminal.line('Nothing to run.')
    return results
  }
  const stageOf = assignStages(tasks, LOCAL_STAGES)
  const view = createProgressView({
    tasks: tasks.map(({ id, project, target }) => ({ id, project, target, stage: stageOf.get(id) as number })),
    stages: LOCAL_STAGES.length,
    terminal,
    now: options.now,
  })
  const timer = setInterval(view.tick, TICK_MS)
  const { stopped, notRun } = await runStages({
    tasks,
    stageOf,
    runStage: async (members, stage) => {
      view.stage(stage)
      const ended = await runStage(options, members, view)
      for (const [id, result] of ended) results.set(id, result)
      return [...ended.values()].every((result) => result.outcome === Outcome.Success)
    },
  })
  clearInterval(timer)
  for (const id of notRun) {
    // why: a task is left not run only by a stage that ended the run
    const detail = `${PipelineRule.StageFailed}: stage ${(stopped as number) + 1}`
    results.set(id, { id, outcome: Outcome.Skipped, exitCode: null, detail, startedAt: null, endedAt: null, durationMs: 0, log: null })
  }
  view.finish(stopped)
  return results
}

/**
 * Runs the chains a plan holds for one environment locally, under the sentence describing the
 * plan and, when tasks keep an earlier outcome, one line counting them.
 *
 * @param options - The plan, the environment, the budgets, the runner, where to write and the clock
 * @returns The results of the run, as a run file records them: every task of the environment in chain order, the inherited ones as successes that did not run
 */
export async function runLocalPlan(options: LocalPlanOptions): Promise<RunResults> {
  const { plan, environment, now, readLog } = options
  options.terminal.line(planLine(plan))
  const tasks: LocalTask[] = plan.chains
    .filter((chain) => chain.environment === environment)
    .flatMap((chain) => chain.tasks.map((task) => ({ ...task, order: chain.order })))
  const kept = createMap<string, TaskResult>(inheritedResults(tasks).map((result) => [result.id, result]))
  if (kept.size > 0) {
    const origins = tasks.flatMap((task) => (task.inherited === undefined ? [] : [task.inherited]))
    const [tasksInherited, read] = kept.size === 1 ? ['task', 'it reads'] : ['tasks', 'they read']
    options.terminal.line(`${kept.size} ${tasksInherited} inherited from ${inheritedFrom(origins)}: nothing ${read} changed since`)
  }
  const startedAt = now()
  const results = await runLocal({ ...options, tasks: scheduledNeeds(tasks) })
  const endedAt = now()
  return {
    environment,
    base: plan.base,
    head: plan.head,
    mode: plan.mode,
    startedAt,
    endedAt,
    durationMs: endedAt - startedAt,
    complete: true,
    tasks: tasks.map((task) => kept.get(task.id) ?? taskResult(task, results.get(task.id) as ScheduleResult, readLog)),
    tested: plan.tested,
    run: null,
    node: options.node,
    local: true,
  }
}
