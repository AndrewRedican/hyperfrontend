/**
 * The run of one environment's chains in a workflow: every task that keeps an earlier outcome
 * gets its result before anything starts, the scheduler runs the rest, each task's log is
 * replayed as it ends, the results are rewritten after every task, and the chains' check runs
 * follow along.
 *
 * @module pipeline/environment
 */

import type { ChainChecks } from './checks'
import type { RunOutcome } from './execute'
import type { LocalTask } from './local'
import type { Chain, Environment, Plan, PlanTask, RunIdentity, RunResults, TaskResult } from './model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { replayLines } from './execute'
import { scheduledNeeds } from './inherit'
import { errorAnnotation, inheritedResults, taskResult } from './report'
import { runSchedule } from './schedule'

/** What the run of an environment needs. */
export interface EnvironmentRunOptions {
  /** The plan, marked or not. */
  readonly plan: Plan
  /** Which environment's chains run. */
  readonly environment: Environment
  /** How many light tasks run at once. */
  readonly parallel: number
  /** How many heavy tasks run at once. */
  readonly heavy: number
  /** Runs one task. */
  readonly run: (task: LocalTask) => Promise<RunOutcome>
  /** Reads a log file by its workspace-relative path. */
  readonly readLog: (path: string) => string
  /** The check-run hooks, or null when the run keeps none. */
  readonly checks: ChainChecks | null
  /** Writes a line of the job's log. */
  readonly say: (line: string) => void
  /** Writes the results file: before anything runs when tasks inherit, and after every task that ends. */
  readonly write: (results: RunResults) => void
  /** Whether the log folds each task's output and lists a failure as an annotation, as a workflow's does. */
  readonly grouped: boolean
  /** The workflow run the results are written by, or null. */
  readonly identity: RunIdentity | null
  /** The Node.js release the tasks run on, as `process.version` names it. */
  readonly node: string
  /** The clock. */
  readonly now: () => number
  /** Cancels what has not started. */
  readonly signal?: AbortSignal
}

/**
 * Runs the chains a plan holds for one environment.
 *
 * @param options - The plan, the environment, the budgets, the runner, the check runs and where the log and the results go
 * @returns The results of the run: every task of the environment in chain order, the inherited ones as successes that did not run
 */
export async function runEnvironmentPlan(options: EnvironmentRunOptions): Promise<RunResults> {
  const { plan, environment, checks, say, readLog, now } = options
  const chains = plan.chains.filter((chain) => chain.environment === environment)
  const tasks: LocalTask[] = chains.flatMap((chain) => chain.tasks.map((task) => ({ ...task, order: chain.order })))
  const chainOf = createMap<string, Chain>(chains.flatMap((chain) => chain.tasks.map((task) => [task.id, chain] as const)))
  const inherited = inheritedResults(tasks)
  // why: an inherited task has its result before anything runs, so a chain counts it among its ended tasks from the start
  const settled = createMap<string, TaskResult>(inherited.map((result) => [result.id, result]))
  const startedChains = createSet<string>()
  const hooks: Promise<void>[] = []
  const open = (chain: Chain): void => {
    if (checks === null || startedChains.has(chain.project)) return
    startedChains.add(chain.project)
    hooks.push(checks.onStart(chain))
  }
  const endedOf = (members: readonly PlanTask[]): TaskResult[] =>
    members.filter((member) => settled.has(member.id)).map((member) => settled.get(member.id) as TaskResult)
  const startedAt = now()
  const snapshot = (complete: boolean): RunResults => {
    const endedAt = now()
    return {
      environment,
      base: plan.base,
      head: plan.head,
      mode: plan.mode,
      startedAt,
      endedAt,
      durationMs: endedAt - startedAt,
      complete,
      tasks: endedOf(tasks),
      tested: plan.tested,
      run: options.identity,
      node: options.node,
    }
  }
  if (inherited.length > 0) {
    // why: written before anything runs, so a run cancelled early still hands its inherited outcomes on to the next
    options.write(snapshot(false))
    for (const chain of checks === null ? [] : chains) {
      if (chain.tasks.every((task) => task.inherited !== undefined)) hooks.push(checks.onInherited(chain, endedOf(chain.tasks)))
    }
  }
  await runSchedule({
    tasks: scheduledNeeds(tasks),
    parallel: options.parallel,
    heavy: options.heavy,
    run: options.run,
    signal: options.signal,
    now,
    onStart: (task) => {
      say(`▶ ${task.id}`)
      open(chainOf.get(task.id) as Chain)
    },
    onEnd: (task, result) => {
      const finished = taskResult(task, result, readLog)
      settled.set(task.id, finished)
      const heading = `${task.id} (${result.outcome}${result.detail === null ? '' : `, ${result.detail}`}, ${round(result.durationMs / 1000)}s)`
      for (const line of replayLines(heading, result.log === null ? '' : readLog(result.log), options.grouped)) say(line)
      // why: the replayed log is folded among hundreds of others, so a failure also raises an annotation the run page lists with its excerpt
      if (options.grouped && finished.excerpt !== undefined) say(errorAnnotation(task.id, finished.excerpt))
      // why: the file is rewritten after every task, so a job killed by its time limit still leaves what had ended
      options.write(snapshot(false))
      if (checks === null) return
      const chain = chainOf.get(task.id) as Chain
      // why: a chain whose tasks all end unstarted (skipped or cancelled) never saw onStart, and every planned chain ends with a concluded check run
      open(chain)
      const members = endedOf(chain.tasks)
      hooks.push(members.length === chain.tasks.length ? checks.onEnd(chain, members) : checks.onTask(chain, members))
    },
  })
  await promiseAll(hooks)
  return snapshot(true)
}
